import React, { useState, useEffect, useRef } from 'react'
import { Check, RotateCcw, Send, ArrowLeft, Trash2 } from 'lucide-react'

const CommentDiscussionView = ({ thread, onBack, onReply, onResolve, onReopen, onDeleteThread, onDeleteReply, currentUser, noteOwner }) => {
    const [replyText, setReplyText] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const messagesEndRef = useRef(null)

    const isResolved = thread.status === 'resolved'

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    // Scroll to bottom when new replies are added
    useEffect(() => {
        scrollToBottom()
    }, [thread.replies?.length])

    const handleReplySubmit = async (e) => {
        e.preventDefault()
        if (!replyText.trim() || replyText.length > 1000 || isSubmitting) return

        try {
            setIsSubmitting(true)
            await onReply(thread._id, replyText)
            setReplyText('')
        } finally {
            setIsSubmitting(false)
        }
    }

    const formatFullTime = (dateString) => {
        if (!dateString) return ''
        const date = new Date(dateString)
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const resolveAuthorName = (item) => {
        const author = item.createdBy || item.author
        return author?.fullName || author?.name || author?.username || 'Unknown User'
    }

    const commentsArray = Array.isArray(thread.comments) ? thread.comments : []
    const mainComment = commentsArray.length > 0 ? commentsArray[0] : null
    const sortedReplies = commentsArray.slice(1).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

    const isSameUser = (u1, u2) => {
        if (!u1 || !u2) return false;
        const id1 = u1._id || u1.id || u1;
        const id2 = u2._id || u2.id || u2;
        return String(id1) === String(id2);
    }

    const canDeleteThread = isSameUser(currentUser, noteOwner) || isSameUser(currentUser, mainComment?.createdBy || mainComment?.author)

    const renderMessage = (item, isMain = false) => {
        const canDeleteReply = isSameUser(currentUser, noteOwner) || isSameUser(currentUser, item.createdBy || item.author)
        if (!item) return null
        return (
            <div key={item._id || Math.random()} style={{
                marginBottom: '16px',
                padding: '12px',
                backgroundColor: 'var(--surface-color)',
                borderRadius: '8px',
                border: isMain ? '1px solid var(--accent)' : '1px solid var(--border)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-color)' }}>
                        {resolveAuthorName(item)}
                    </div>
                    {!isMain && canDeleteReply && (
                        <button 
                            onClick={() => onDeleteReply(thread._id, item._id)}
                            className="icon-button"
                            title="Delete reply"
                            style={{ padding: '2px', color: 'var(--muted)', height: 'auto', width: 'auto' }}
                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger, #ef4444)'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted)'}
                        >
                            <Trash2 size={12} />
                        </button>
                    )}
                </div>
                <div style={{ fontSize: '14px', color: 'var(--text-color)', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>
                    {item.body || <span style={{ fontStyle: 'italic', color: 'var(--muted)' }}>No comment body</span>}
                </div>
                <div style={{ textAlign: 'right', fontSize: '10px', color: 'var(--muted)', marginTop: '6px' }}>
                    {formatFullTime(item.createdAt)}
                </div>
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                paddingBottom: '12px', 
                borderBottom: '1px solid var(--border)',
                marginBottom: '16px'
            }}>
                <button 
                    onClick={onBack}
                    className="ghost-button" 
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '4px 8px', marginLeft: '-8px' }}
                >
                    <ArrowLeft size={14} /> Back
                </button>

                <div style={{ display: 'flex', gap: '8px' }}>
                    {canDeleteThread && (
                        <button
                            onClick={() => onDeleteThread(thread._id)}
                            className="ghost-button"
                            style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--danger, #ef4444)' }}
                        >
                            <Trash2 size={14} /> Delete
                        </button>
                    )}
                    {isResolved ? (
                        <button
                            onClick={() => onReopen(thread._id)}
                            className="ghost-button"
                            style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                            <RotateCcw size={14} /> Reopen
                        </button>
                    ) : (
                        <button
                            onClick={() => onResolve(thread._id)}
                            className="ghost-button"
                            style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--success, #10b981)' }}
                        >
                            <Check size={14} /> Resolve
                        </button>
                    )}
                </div>
            </div>

            {/* Quoted Text */}
            <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px', paddingLeft: '12px' }}>
                    Attached to
                </div>
                <div style={{
                    fontSize: '13px',
                    color: 'var(--muted)',
                    padding: '0 0 0 12px',
                    borderLeft: '2px solid var(--border)',
                    fontStyle: 'italic',
                    lineHeight: '1.4'
                }}>
                    "{thread.selectedText || 'Unknown text'}"
                </div>
            </div>

            {/* Scrollable Discussion Area */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', paddingBottom: '16px' }}>
                {mainComment ? renderMessage(mainComment, true) : (
                    <div style={{ padding: '12px', color: 'var(--muted)', fontStyle: 'italic', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '16px' }}>
                        No main comment found
                    </div>
                )}
                {sortedReplies.map(reply => renderMessage(reply, false))}
                <div ref={messagesEndRef} />
            </div>

            {/* Sticky Reply Input */}
            {!isResolved && (
                <div style={{ 
                    borderTop: '1px solid var(--border)', 
                    paddingTop: '12px',
                    marginTop: 'auto'
                }}>
                    <form onSubmit={handleReplySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Write a reply..."
                            disabled={isSubmitting}
                            rows={2}
                            style={{
                                width: '100%',
                                padding: '10px',
                                fontSize: '13px',
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                backgroundColor: 'var(--surface-color)',
                                color: 'var(--text-color)',
                                resize: 'none',
                                outline: 'none',
                                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
                            }}
                            onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                            onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                            <span style={{ fontSize: '11px', color: replyText.length > 1000 ? 'var(--danger, #ef4444)' : 'var(--muted)' }}>
                                {replyText.length} / 1000
                            </span>
                            <button
                                type="submit"
                                disabled={!replyText.trim() || replyText.length > 1000 || isSubmitting}
                                className="primary-button"
                                style={{ padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                            >
                                <Send size={14} />
                                {isSubmitting ? 'Sending...' : 'Reply'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    )
}

export default CommentDiscussionView
