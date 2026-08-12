import { useEffect, useRef } from "react"
import { Bell, CheckCheck, CheckCircle2, MessageCircle, RefreshCw, RotateCcw, Share2, X } from "lucide-react"
import { formatRelativeTime } from "../../utils/activityFormatter"
import { formatNotificationMessage } from "../../utils/notificationFormatter"

const getNotificationIcon = (type) => {
    switch (type) {
        case "NOTE_SHARED":
            return Share2
        case "COMMENT_REPLY":
            return MessageCircle
        case "COMMENT_RESOLVED":
            return CheckCircle2
        case "COMMENT_REOPENED":
            return RotateCcw
        default:
            return Bell
    }
}

const NotificationSkeleton = () => (
    <div className="notification-skeleton-list" aria-label="Loading notifications">
        {[0, 1, 2, 3].map((item) => (
            <div className="notification-skeleton-row" key={item} aria-hidden="true">
                <span className="notification-skeleton-icon" />
                <span className="notification-skeleton-lines">
                    <span />
                    <span />
                </span>
            </div>
        ))}
    </div>
)

const NotificationPanel = ({
    error,
    isLoading,
    isLoadingMore,
    isMarkingAll,
    isOpen,
    nextCursor,
    notifications,
    onClose,
    onLoadMore,
    onMarkAllAsRead,
    onNotificationClick,
    onRetry,
    pendingReadIds
}) => {
    const panelRef = useRef(null)

    useEffect(() => {
        if (!isOpen) return undefined

        const handlePointerDown = (event) => {
            if (panelRef.current?.contains(event.target)) return
            if (event.target instanceof Element && event.target.closest("[data-notification-bell]")) return
            onClose()
        }

        const handleEscape = (event) => {
            if (event.key !== "Escape" || event.repeat || event.defaultPrevented) return

            event.preventDefault()
            event.stopPropagation()
            onClose()
        }

        document.addEventListener("pointerdown", handlePointerDown, true)
        document.addEventListener("keydown", handleEscape, true)

        return () => {
            document.removeEventListener("pointerdown", handlePointerDown, true)
            document.removeEventListener("keydown", handleEscape, true)
        }
    }, [isOpen, onClose])

    if (!isOpen) return null

    const hasNotifications = notifications.length > 0

    return (
        <section
            ref={panelRef}
            className="notification-panel"
            role="dialog"
            aria-modal="false"
            aria-labelledby="notification-panel-title"
        >
            <header className="notification-panel-header">
                <div className="notification-panel-heading">
                    <p className="eyebrow">Inbox</p>
                    <h2 id="notification-panel-title">Notifications</h2>
                </div>
                <div className="notification-panel-actions">
                    <button
                        className="ghost-button notification-mark-all-button"
                        type="button"
                        onClick={onMarkAllAsRead}
                        disabled={isMarkingAll || !hasNotifications}
                    >
                        <CheckCheck size={15} aria-hidden="true" />
                        <span>{isMarkingAll ? "Marking..." : "Mark all read"}</span>
                    </button>
                    <button
                        className="icon-button notification-close-button"
                        type="button"
                        onClick={onClose}
                        aria-label="Close notifications"
                    >
                        <X size={16} aria-hidden="true" />
                    </button>
                </div>
            </header>

            {error && (
                <div className="notification-panel-error" role="status">
                    <span>{error}</span>
                    <button className="ghost-button" type="button" onClick={onRetry}>
                        <RefreshCw size={14} aria-hidden="true" />
                        Retry
                    </button>
                </div>
            )}

            <div className="notification-panel-list" aria-live="polite">
                {isLoading && !hasNotifications && <NotificationSkeleton />}

                {!isLoading && !hasNotifications && !error && (
                    <div className="notification-panel-empty">
                        <span className="notification-empty-icon" aria-hidden="true"><Bell size={20} /></span>
                        <div>
                            <p>No notifications yet</p>
                            <span>Updates from collaboration will appear here.</span>
                        </div>
                    </div>
                )}

                {notifications.map((notification) => {
                    const isUnread = !notification.readAt
                    const isPending = pendingReadIds.has(String(notification._id))
                    const message = formatNotificationMessage(notification)
                    const timestamp = formatRelativeTime(notification.createdAt)
                    const TypeIcon = getNotificationIcon(notification.type)

                    return (
                        <button
                            key={notification._id}
                            className={`notification-row ${isUnread ? "is-unread" : ""}`}
                            type="button"
                            onClick={() => onNotificationClick(notification)}
                            disabled={isPending}
                            aria-label={`${message}. ${timestamp}.${isUnread ? " Unread." : " Read."}`}
                        >
                            <span className="notification-type-icon" aria-hidden="true">
                                <TypeIcon size={16} />
                            </span>
                            <span className="notification-row-content">
                                <strong>{message}</strong>
                                <span title={new Date(notification.createdAt).toLocaleString()}>{timestamp}</span>
                            </span>
                            <span className="notification-row-indicator" aria-hidden="true" />
                        </button>
                    )
                })}
            </div>

            {nextCursor && (
                <footer className="notification-panel-footer">
                    <button
                        className="ghost-button notification-load-more-button"
                        type="button"
                        onClick={onLoadMore}
                        disabled={isLoadingMore}
                    >
                        {isLoadingMore ? "Loading..." : "Load more"}
                    </button>
                </footer>
            )}
        </section>
    )
}

export default NotificationPanel