import React from 'react'
import { MessageSquare } from 'lucide-react'

const CommentSummaryCard = ({ thread, onClick }) => {
    const isResolved = thread.status === 'resolved'
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
            onClick={onClick}
            style={{
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '8px',
                backgroundColor: 'var(--surface-color)',
                cursor: 'pointer',
                opacity: isResolved ? 0.6 : 1,
                transition: 'background-color 0.2s ease, opacity 0.2s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-color)' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface-color)' }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {thread.isUnread && (
                        <span style={{ width: '6px', height: '6px', backgroundColor: 'var(--danger, #ef4444)', borderRadius: '50%' }} aria-label="Unread" />
                    )}
                    {resolveAuthorName(mainComment || thread)}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    {getRelativeTime(thread.createdAt)}
                </span>
            </div>

            <div style={{
                fontSize: '12px',
                color: 'var(--muted)',
                fontStyle: 'italic',
                borderLeft: '2px solid var(--border)',
                paddingLeft: '8px',
                marginBottom: '8px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
            }}>
                "{thread.selectedText || 'Unknown text'}"
            </div>

            <p style={{ 
                margin: '0 0 8px 0', 
                fontSize: '13px', 
                color: 'var(--text-color)',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
            }}>
                {mainComment?.body || <span style={{ fontStyle: 'italic', color: 'var(--muted)' }}>No comment body</span>}
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--muted)', fontSize: '11px' }}>
                    <MessageSquare size={12} />
                    <span>{replyCount} {replyCount === 1 ? 'reply' : 'replies'}</span>
                </div>
                {isResolved && (
                    <span style={{ fontSize: '10px', backgroundColor: 'var(--bg-color)', padding: '2px 6px', borderRadius: '4px', color: 'var(--muted)' }}>
                        Resolved
                    </span>
                )}
            </div>
        </div>
    )
}

export default CommentSummaryCard
