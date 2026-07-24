import React, { useEffect, useState, useCallback, useRef } from 'react'
import { getComments, createComment, replyToComment, resolveComment, reopenComment, deleteCommentThread, deleteCommentReply, markCommentThreadAsRead } from '../../api/comments.api'
import CommentSummaryCard from './CommentSummaryCard'
import CommentDiscussionView from './CommentDiscussionView'
import CommentDeleteConfirmDialog from './CommentDeleteConfirmDialog'
import { Plus, MessageSquare, X } from 'lucide-react'
import socket from '../../api/socket'

const CommentsSidebar = ({ noteId, currentUser, noteOwner, activeThreadId, setActiveThreadId, editorSelection, onCommentCreated, onCommentDeleted, isOpen, onClose, onDeleteDialogOpenChange }) => {
    const [threads, setThreads] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)
    
    // Modal state for adding a temporary comment manually
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [newCommentText, setNewCommentText] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [threadFilter, setThreadFilter] = useState('open')
    const [deleteTarget, setDeleteTarget] = useState(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const deleteOperationRef = useRef(null)
    const commentsListRef = useRef(null)
    const pendingThreadActionRef = useRef(null)
    const [pendingThreadAction, setPendingThreadAction] = useState(null)
    const activeCommentsFetchRef = useRef(null)
    const pendingCommentsRefreshRef = useRef(null)
    const isMountedRef = useRef(false)
    const noteIdRef = useRef(noteId)

    noteIdRef.current = noteId

    useEffect(() => {
        deleteOperationRef.current = null
        setDeleteTarget(null)
        setIsDeleting(false)
    }, [noteId])

    useEffect(() => {
        onDeleteDialogOpenChange?.(Boolean(deleteTarget))
    }, [deleteTarget, onDeleteDialogOpenChange])

    useEffect(() => () => {
        deleteOperationRef.current = null
        onDeleteDialogOpenChange?.(false)
    }, [onDeleteDialogOpenChange])

    const fetchComments = useCallback((background = false) => {
        if (!noteId) {
            return Promise.resolve()
        }

        const queuedRefresh = pendingCommentsRefreshRef.current

        if (queuedRefresh && String(queuedRefresh.noteId) === String(noteId)) {
            queuedRefresh.background = queuedRefresh.background && background
        } else {
            pendingCommentsRefreshRef.current = { noteId, background }
        }

        if (activeCommentsFetchRef.current) {
            return activeCommentsFetchRef.current
        }

        const refreshWorker = (async () => {
            while (pendingCommentsRefreshRef.current) {
                const refresh = pendingCommentsRefreshRef.current
                pendingCommentsRefreshRef.current = null

                const scrollContainer = commentsListRef.current
                const previousScrollTop = refresh.background ? scrollContainer?.scrollTop : null
                const canApplyResult = () => (
                    isMountedRef.current &&
                    String(noteIdRef.current) === String(refresh.noteId)
                )

                try {
                    if (canApplyResult()) {
                        if (!refresh.background) setIsLoading(true)
                        setError(null)
                    }

                    const response = await getComments(refresh.noteId)

                    if (!canApplyResult()) {
                        continue
                    }

                    let normalized = []
                    if (Array.isArray(response)) {
                        normalized = response
                    } else if (response && typeof response === 'object') {
                        if (Array.isArray(response.data)) normalized = response.data
                        else if (Array.isArray(response.comments)) normalized = response.comments
                        else if (Array.isArray(response.threads)) normalized = response.threads
                        else if (response.data && Array.isArray(response.data.comments)) normalized = response.data.comments
                        else if (response.data && Array.isArray(response.data.threads)) normalized = response.data.threads
                    }

                    setThreads(normalized)

                    if (refresh.background && scrollContainer && previousScrollTop !== null) {
                        requestAnimationFrame(() => {
                            if (canApplyResult()) {
                                scrollContainer.scrollTop = previousScrollTop
                            }
                        })
                    }
                } catch (err) {
                    if (canApplyResult()) {
                        console.error('Failed to load comments:', err)
                        setError('Failed to load comments')
                    }
                } finally {
                    if (canApplyResult() && !refresh.background) {
                        setIsLoading(false)
                    }
                }
            }
        })()

        activeCommentsFetchRef.current = refreshWorker
        refreshWorker.finally(() => {
            if (activeCommentsFetchRef.current === refreshWorker) {
                activeCommentsFetchRef.current = null
            }
        })

        return refreshWorker
    }, [noteId])

    useEffect(() => {
        isMountedRef.current = true

        return () => {
            isMountedRef.current = false
        }
    }, [])

    useEffect(() => {
        if (!noteId) return undefined

        const handleCommentsUpdated = (payload) => {
            if (String(payload?.noteId) !== String(noteId)) return

            fetchComments(true)
        }

        socket.on('comments:updated', handleCommentsUpdated)

        return () => {
            socket.off('comments:updated', handleCommentsUpdated)
        }
    }, [noteId, fetchComments])

    useEffect(() => {
        if (noteId) {
            fetchComments()
        }
    }, [noteId, fetchComments])

    const normalizedSelection = editorSelection?.selectedText ? editorSelection.selectedText.trim() : "";

    const handleCreateComment = async (e) => {
        e.preventDefault()
        if (normalizedSelection.length < 2 || !newCommentText.trim() || newCommentText.length > 1000 || isSubmitting) return

        try {
            setIsSubmitting(true)
            const anchorId = `anchor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            await createComment(noteId, {
                body: newCommentText,
                selectedText: normalizedSelection,
                anchorId: anchorId
            })
            setIsAddModalOpen(false)
            setNewCommentText('')
            if (onCommentCreated) {
                onCommentCreated(anchorId)
            }
        } catch (err) {
            console.error('Failed to create comment:', err)
            alert('Failed to create comment')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleThreadClick = async (threadId) => {
        setActiveThreadId(threadId)
        
        const thread = threads.find(t => t._id === threadId)
        if (thread && thread.isUnread) {
            try {
                await markCommentThreadAsRead(threadId)
                // Update local state only after successful response
                setThreads(prev => prev.map(t => 
                    t._id === threadId ? { ...t, isUnread: false } : t
                ))
            } catch (err) {
                console.error('Failed to mark thread as read:', err)
            }
        }
    }

    const handleReply = async (threadId, content) => {
        try {
            await replyToComment(threadId, content)
            return true
        } catch (err) {
            console.error('Failed to reply:', err)
            if (err?.response?.data?.code === 'COMMENT_THREAD_RESOLVED') {
                await fetchComments(true)
                alert('This thread was resolved before your reply could be posted.')
            } else {
                alert('Failed to post reply')
            }
            return false
        }
    }

    const handleThreadStatusAction = async (threadId, action, request, failureMessage) => {
        if (pendingThreadActionRef.current?.threadId === threadId) return

        const pendingAction = { threadId, action }
        pendingThreadActionRef.current = pendingAction
        setPendingThreadAction(pendingAction)

        try {
            await request(threadId)
        } catch (err) {
            console.error('Failed to ' + action + ':', err)
            alert(failureMessage)
        } finally {
            if (pendingThreadActionRef.current === pendingAction) {
                pendingThreadActionRef.current = null
                setPendingThreadAction(null)
            }
        }
    }

    const handleResolve = (threadId) => {
        return handleThreadStatusAction(
            threadId,
            'resolve',
            resolveComment,
            'Failed to resolve thread'
        )
    }

    const handleReopen = (threadId) => {
        return handleThreadStatusAction(
            threadId,
            'reopen',
            reopenComment,
            'Failed to reopen thread'
        )
    }

    const openThreadDeleteConfirmation = useCallback((threadId) => {
        if (isDeleting || deleteOperationRef.current) return
        setDeleteTarget({ type: 'thread', threadId })
    }, [isDeleting])

    const openReplyDeleteConfirmation = useCallback((threadId, replyId) => {
        if (isDeleting || deleteOperationRef.current) return
        setDeleteTarget({ type: 'reply', threadId, replyId })
    }, [isDeleting])

    const closeDeleteConfirmation = useCallback(() => {
        if (isDeleting) return
        setDeleteTarget(null)
    }, [isDeleting])

    const handleConfirmedDelete = useCallback(async () => {
        const target = deleteTarget
        if (!target || deleteOperationRef.current) return

        const operation = { noteId: String(noteId), target }
        deleteOperationRef.current = operation
        setIsDeleting(true)

        const isCurrentOperation = () => (
            deleteOperationRef.current === operation &&
            String(noteIdRef.current) === operation.noteId
        )

        try {
            if (target.type === 'thread') {
                const thread = threads.find((item) => item._id === target.threadId)
                await deleteCommentThread(target.threadId)

                if (!isCurrentOperation()) return

                if (thread?.anchorId && onCommentDeleted) {
                    onCommentDeleted(thread.anchorId)
                }
                setActiveThreadId(null)
            } else {
                await deleteCommentReply(target.threadId, target.replyId)

                if (!isCurrentOperation()) return
            }

            setDeleteTarget(null)
        } catch (err) {
            if (!isCurrentOperation()) return

            console.error(`Failed to delete ${target.type}:`, err)
            alert(target.type === 'thread' ? 'Failed to delete thread' : 'Failed to delete reply')
        } finally {
            if (deleteOperationRef.current === operation) {
                deleteOperationRef.current = null
                setIsDeleting(false)
            }
        }
    }, [deleteTarget, noteId, onCommentDeleted, setActiveThreadId, threads])

    const safeThreads = Array.isArray(threads) ? threads : []
    const isResolvedThread = (thread) => thread.resolved === true || thread.status === 'resolved'
    const openThreads = safeThreads.filter(thread => !isResolvedThread(thread))
    const resolvedThreads = safeThreads.filter(isResolvedThread)
    const visibleThreads = threadFilter === 'resolved'
        ? resolvedThreads
        : threadFilter === 'all'
            ? safeThreads
            : openThreads
    
    const activeThread = activeThreadId ? safeThreads.find(t => t._id === activeThreadId) : null

    useEffect(() => {
        const currentThreads = Array.isArray(threads) ? threads : []

        if (activeThreadId && !currentThreads.some(thread => thread._id === activeThreadId)) {
            setActiveThreadId(null)
        }
    }, [activeThreadId, threads, setActiveThreadId])
    useEffect(() => {
        const handleEditorHover = (e) => {
            const { anchorId, isHovering } = e.detail;
            const card = document.getElementById(`comment-card-${anchorId}`);
            if (card) {
                if (isHovering) {
                    card.classList.add('comment-card-highlighted');
                    // Scroll into view gently if outside viewport
                    const rect = card.getBoundingClientRect();
                    const containerRect = commentsListRef.current?.getBoundingClientRect();
                    if (containerRect && (rect.top < containerRect.top || rect.bottom > containerRect.bottom)) {
                        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                } else {
                    card.classList.remove('comment-card-highlighted');
                }
            }
        };

        const handleScrollToComment = (e) => {
            const { anchorId } = e.detail;
            // Wait slightly to ensure rendering if sidebar was closed
            setTimeout(() => {
                const card = document.getElementById(`comment-card-${anchorId}`);
                if (card) {
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    card.classList.remove('comment-card-flashed');
                    // trigger reflow
                    void card.offsetWidth;
                    card.classList.add('comment-card-flashed');
                }
            }, 50);
        };

        window.addEventListener('editor:comment-hover', handleEditorHover);
        window.addEventListener('sidebar:scroll-to-comment', handleScrollToComment);

        return () => {
            window.removeEventListener('editor:comment-hover', handleEditorHover);
            window.removeEventListener('sidebar:scroll-to-comment', handleScrollToComment);
        };
    }, []);
    const isSelectionValid = normalizedSelection.length >= 2 && normalizedSelection.length <= 300;
    const canAddComment = editorSelection && isSelectionValid && !editorSelection.hasExistingComment;
    const commentWarning = editorSelection?.hasExistingComment 
        ? "This text already has a comment." 
        : (normalizedSelection.length > 300 ? "Please select a shorter text (maximum 300 characters)." : "");

    return (
        <aside className={`collaboration-panel comments-sidebar mobile-overlay-panel ${isOpen ? 'panel-open' : ''}`} aria-label="Comments" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {onClose && (
                        <button className="icon-button mobile-panel-close-btn mobile-only" onClick={onClose} aria-label="Close panel" style={{ display: 'none', padding: '4px', marginLeft: '-4px' }}>
                            <X size={18} />
                        </button>
                    )}
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '600', margin: 0, color: 'var(--text)' }}>
                        <MessageSquare size={16} color="var(--muted-strong)" />
                        Comments
                    </h2>
                </div>
                {!activeThreadId && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {commentWarning && (
                            <span style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic', maxWidth: '140px', textAlign: 'right', lineHeight: '1.2' }}>
                                {commentWarning}
                            </span>
                        )}
                        <button 
                            className="icon-button" 
                            onClick={() => setIsAddModalOpen(true)}
                            disabled={!canAddComment}
                            style={{ opacity: canAddComment ? 1 : 0.5, cursor: canAddComment ? 'pointer' : 'not-allowed', color: 'var(--text)', backgroundColor: canAddComment ? 'var(--skeleton-base)' : 'transparent' }}
                            aria-label="New comment"
                            title={commentWarning || "New comment"}
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                )}
            </div>

            {!activeThreadId && (
                <div className="comment-filter-tabs" role="tablist" aria-label="Filter comment threads">
                    {[
                        { id: 'open', label: 'Open', count: openThreads.length },
                        { id: 'resolved', label: 'Resolved', count: resolvedThreads.length },
                        { id: 'all', label: 'All', count: safeThreads.length }
                    ].map(filter => (
                        <button
                            key={filter.id}
                            className={`comment-filter-tab ${threadFilter === filter.id ? 'is-active' : ''}`}
                            type="button"
                            role="tab"
                            aria-selected={threadFilter === filter.id}
                            onClick={() => setThreadFilter(filter.id)}
                        >
                            {filter.label}
                            <span>{filter.count}</span>
                        </button>
                    ))}
                </div>
            )}

            {isLoading && threads.length === 0 && <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Loading comments...</p>}
            {error && <p style={{ fontSize: '13px', color: 'var(--danger, #ef4444)' }}>{error}</p>}

            {!error && (!isLoading || threads.length > 0) && (
                <div ref={commentsListRef} className="comments-list" style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column' }}>
                    {activeThread ? (
                        <CommentDiscussionView 
                            thread={activeThread}
                            onBack={() => setActiveThreadId(null)}
                            onReply={handleReply}
                            onResolve={handleResolve}
                            onReopen={handleReopen}
                            onDeleteThread={openThreadDeleteConfirmation}
                            onDeleteReply={openReplyDeleteConfirmation}
                            pendingThreadAction={pendingThreadAction?.threadId === activeThread._id
                                ? pendingThreadAction.action
                                : null}
                            currentUser={currentUser}
                            noteOwner={noteOwner}
                        />
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                            {safeThreads.length === 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, textAlign: 'center', padding: '40px 16px', color: 'var(--muted-strong)' }}>
                                    <MessageSquare size={28} style={{ opacity: 0.3, marginBottom: '16px', color: 'var(--text)' }} />
                                    <p style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 6px 0', color: 'var(--text)' }}>Discussion</p>
                                    <p style={{ fontSize: '13px', margin: 0, color: 'var(--muted)', lineHeight: '1.4' }}>Highlight any text in the document<br/>to start the first discussion.</p>
                                </div>
                            )}

                            {safeThreads.length > 0 && visibleThreads.length === 0 && (
                                <div className="comment-filter-empty">
                                    No {threadFilter} comment threads.
                                </div>
                            )}

                            {visibleThreads.map(thread => (
                                <CommentSummaryCard
                                    key={thread._id}
                                    thread={thread}
                                    onClick={() => handleThreadClick(thread._id)}
                                />
                            ))}

                        </div>
                    )}
                </div>
            )}

            {deleteTarget && (
                <CommentDeleteConfirmDialog
                    target={deleteTarget}
                    isDeleting={isDeleting}
                    onConfirm={handleConfirmedDelete}
                    onCancel={closeDeleteConfirmation}
                />
            )}

            {/* Temporary Add Comment Modal */}
            {isAddModalOpen && (
                <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'rgba(15, 23, 42, 0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="modal-card" style={{ width: '400px', backgroundColor: 'var(--bg-color, #1e293b)', padding: '24px', borderRadius: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '16px' }}>New Comment</h3>
                            <button className="icon-button" onClick={() => setIsAddModalOpen(false)}>
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateComment}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: 600 }}>Selected Text</label>
                                <div style={{ 
                                    padding: '8px 12px', 
                                    borderRadius: '6px', 
                                    backgroundColor: 'rgba(0,0,0,0.2)', 
                                    borderLeft: '2px solid var(--accent)',
                                    color: 'var(--muted)',
                                    fontSize: '13px',
                                    fontStyle: 'italic',
                                    wordBreak: 'break-word'
                                }}>
                                    "{normalizedSelection}"
                                </div>
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Comment</label>
                                    <span style={{ fontSize: '11px', color: newCommentText.length > 1000 ? 'var(--danger, #ef4444)' : 'var(--muted)' }}>
                                        {newCommentText.length} / 1000
                                    </span>
                                </div>
                                <textarea
                                    value={newCommentText}
                                    onChange={e => setNewCommentText(e.target.value)}
                                    placeholder="Leave your thought..."
                                    required
                                    rows={3}
                                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', resize: 'vertical' }}
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <button type="button" className="ghost-button" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                                <button type="submit" className="primary-button" disabled={isSubmitting || newCommentText.length > 1000 || !newCommentText.trim()}>
                                    {isSubmitting ? 'Posting...' : 'Post Comment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </aside>
    )
}

export default CommentsSidebar
