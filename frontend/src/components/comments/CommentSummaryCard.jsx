import React from 'react'
import { MessageSquare } from 'lucide-react'

const CommentSummaryCard = ({ thread, onClick }) => {
    const isResolved = thread.resolved === true || thread.status === 'resolved'
    const commentsArray = Array.isArray(thread.comments) ? thread.comments : []
    const mainComment = commentsArray.length > 0 ? commentsArray[0] : null
    const replyCount = Math.max(commentsArray.length - 1, 0)

    const getRelativeTime = (dateString) => {
        if (!dateString) return ''
        const date = new Date(dateString)
        const diffInSeconds = Math.floor((new Date() - date) / 1000)
        
        if (diffInSeconds < 60) return 'Just now'
        const diffInMinutes = Math.floor(diffInSeconds / 60)
        if (diffInMinutes < 60) return `${diffInMinutes}m`
        const diffInHours = Math.floor(diffInMinutes / 60)
        if (diffInHours < 24) return `${diffInHours}h`
        const diffInDays = Math.floor(diffInHours / 24)
        if (diffInDays < 7) return `${diffInDays}d`
        return date.toLocaleDateString()
    }

    const resolveAuthorName = (item) => {
        const author = item?.createdBy || item?.author
        return author?.fullName || author?.name || author?.username || 'Unknown User'
    }

    return (
        <div 
            id={`comment-card-${thread.anchorId}`}
            className={`comment-summary-card comment-card-animate ${isResolved ? 'is-resolved' : ''}`}
            onClick={onClick}
            style={{
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '12px',
                backgroundColor: 'var(--surface-color)',
                cursor: 'pointer',
                opacity: isResolved ? 0.6 : 1,
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-color)'
                window.dispatchEvent(new CustomEvent('sidebar:comment-hover', { detail: { anchorId: thread.anchorId, isHovering: true } }))
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--surface-color)'
                window.dispatchEvent(new CustomEvent('sidebar:comment-hover', { detail: { anchorId: thread.anchorId, isHovering: false } }))
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {thread.isUnread && (
                        <span style={{ width: '8px', height: '8px', backgroundColor: 'var(--amber)', borderRadius: '50%' }} aria-label="Unread" />
                    )}
                    {resolveAuthorName(mainComment || thread)}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: '500' }}>
                    {getRelativeTime(thread.createdAt)}
                </span>
            </div>

            <div style={{
                fontSize: '13px',
                color: 'var(--muted-strong)',
                fontStyle: 'italic',
                borderLeft: '2px solid var(--accent, #7c3aed)',
                paddingLeft: '10px',
                marginBottom: '10px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                backgroundColor: 'var(--skeleton-base)',
                padding: '4px 8px',
                borderRadius: '0 4px 4px 0'
            }}>
                "{thread.selectedText || 'Unknown text'}"
            </div>

            <p style={{
                margin: '0 0 12px 0',
                fontSize: '14px',
                color: 'var(--text)',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: '1.5'
            }}>
                {mainComment?.body || <span style={{ fontStyle: 'italic', color: 'var(--muted)' }}>No comment body</span>}
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--muted-strong)', fontSize: '12px', fontWeight: '500' }}>
                    <MessageSquare size={14} />
                    <span>{replyCount} {replyCount === 1 ? 'reply' : 'replies'}</span>
                </div>
                {isResolved && (
                    <span style={{ fontSize: '11px', fontWeight: '600', backgroundColor: 'var(--skeleton-base)', padding: '2px 8px', borderRadius: '100px', color: 'var(--muted-strong)' }}>
                        Resolved
                    </span>
                )}
            </div>
        </div>
    )
}

export default CommentSummaryCard
