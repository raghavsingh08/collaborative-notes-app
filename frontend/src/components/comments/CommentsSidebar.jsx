import React, { useEffect, useState, useCallback, useRef } from 'react'
import { getComments, createComment, replyToComment, resolveComment, reopenComment } from '../../api/comments.api'
import CommentSummaryCard from './CommentSummaryCard'
import CommentDiscussionView from './CommentDiscussionView'
import { Plus, MessageSquare, X } from 'lucide-react'
import socket from '../../api/socket'

const CommentsSidebar = ({ noteId, currentUser: _currentUser }) => {
    const [threads, setThreads] = useState([])
    const [activeThreadId, setActiveThreadId] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)
    
    // Modal state for adding a temporary comment manually
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [newSelectedText, setNewSelectedText] = useState('')
    const [newCommentText, setNewCommentText] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const commentsListRef = useRef(null)

    const fetchComments = useCallback(async (background = false) => {
        const scrollContainer = commentsListRef.current
        const previousScrollTop = background ? scrollContainer?.scrollTop : null

        try {
            if (!background) setIsLoading(true)
            setError(null)
            const response = await getComments(noteId)
            
            // Normalize common API response shapes into an array
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

            if (background && scrollContainer && previousScrollTop !== null) {
                requestAnimationFrame(() => {
                    scrollContainer.scrollTop = previousScrollTop
                })
            }
        } catch (err) {
            console.error('Failed to load comments:', err)
            setError('Failed to load comments')
        } finally {
            if (!background) setIsLoading(false)
        }
    }, [noteId])

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

    const handleCreateComment = async (e) => {
        e.preventDefault()
        if (!newSelectedText.trim() || !newCommentText.trim() || isSubmitting) return

        try {
            setIsSubmitting(true)
            await createComment(noteId, {
                body: newCommentText,
                selectedText: newSelectedText,
                anchorId: `manual-${Date.now()}`
            })
            setIsAddModalOpen(false)
            setNewSelectedText('')
            setNewCommentText('')
        } catch (err) {
            console.error('Failed to create comment:', err)
            alert('Failed to create comment')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleReply = async (threadId, content) => {
        try {
            await replyToComment(threadId, content)
        } catch (err) {
            console.error('Failed to reply:', err)
            alert('Failed to post reply')
        }
    }

    const handleResolve = async (threadId) => {
        try {
            await resolveComment(threadId)
        } catch (err) {
            console.error('Failed to resolve:', err)
            alert('Failed to resolve thread')
        }
    }

    const handleReopen = async (threadId) => {
        try {
            await reopenComment(threadId)
        } catch (err) {
            console.error('Failed to reopen:', err)
            alert('Failed to reopen thread')
        }
    }

    const safeThreads = Array.isArray(threads) ? threads : []
    const openThreads = safeThreads.filter(t => t.status !== 'resolved')
    const resolvedThreads = safeThreads.filter(t => t.status === 'resolved')
    
    const activeThread = activeThreadId ? safeThreads.find(t => t._id === activeThreadId) : null

    return (
        <aside className="collaboration-panel comments-sidebar" aria-label="Comments" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                    <p className="eyebrow">Discussion</p>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MessageSquare size={18} />
                        Comments
                    </h2>
                </div>
                {!activeThreadId && (
                    <button 
                        className="icon-button" 
                        onClick={() => setIsAddModalOpen(true)}
                        aria-label="New comment"
                        title="New comment"
                    >
                        <Plus size={18} />
                    </button>
                )}
            </div>

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
                        />
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {openThreads.length === 0 && resolvedThreads.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted)' }}>
                                    <MessageSquare size={24} style={{ opacity: 0.5, marginBottom: '8px' }} />
                                    <p style={{ fontSize: '13px', margin: 0 }}>No comments yet.</p>
                                </div>
                            )}

                            {openThreads.map(thread => (
                                <CommentSummaryCard
                                    key={thread._id}
                                    thread={thread}
                                    onClick={() => setActiveThreadId(thread._id)}
                                />
                            ))}

                            {resolvedThreads.length > 0 && (
                                <div style={{ marginTop: '24px' }}>
                                    <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
                                        Resolved ({resolvedThreads.length})
                                    </h3>
                                    {resolvedThreads.map(thread => (
                                        <CommentSummaryCard
                                            key={thread._id}
                                            thread={thread}
                                            onClick={() => setActiveThreadId(thread._id)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
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
                                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: 600 }}>Selected Text (Manual Input for now)</label>
                                <input
                                    type="text"
                                    value={newSelectedText}
                                    onChange={e => setNewSelectedText(e.target.value)}
                                    placeholder="e.g. This is a great point"
                                    required
                                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)' }}
                                />
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: 600 }}>Comment</label>
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
                                <button type="submit" className="primary-button" disabled={isSubmitting}>
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
