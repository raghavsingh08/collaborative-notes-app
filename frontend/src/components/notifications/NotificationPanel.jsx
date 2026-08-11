import { useEffect, useRef } from "react"
import { Bell, CheckCheck, RefreshCw, X } from "lucide-react"
import { formatRelativeTime } from "../../utils/activityFormatter"
import { formatNotificationMessage } from "../../utils/notificationFormatter"

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
                <div>
                    <p className="eyebrow">Updates</p>
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
                        className="icon-button"
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
                {isLoading && !hasNotifications && (
                    <p className="notification-panel-state">Loading notifications...</p>
                )}

                {!isLoading && !hasNotifications && !error && (
                    <div className="notification-panel-empty">
                        <Bell size={22} aria-hidden="true" />
                        <p>No notifications yet</p>
                    </div>
                )}

                {notifications.map((notification) => {
                    const isUnread = !notification.readAt
                    const isPending = pendingReadIds.has(String(notification._id))
                    const message = formatNotificationMessage(notification)
                    const timestamp = formatRelativeTime(notification.createdAt)

                    return (
                        <button
                            key={notification._id}
                            className={`notification-row ${isUnread ? "is-unread" : ""}`}
                            type="button"
                            onClick={() => onNotificationClick(notification)}
                            disabled={isPending}
                            aria-label={`${message}. ${timestamp}.${isUnread ? " Unread." : " Read."}`}
                        >
                            <span className="notification-row-indicator" aria-hidden="true" />
                            <span className="notification-row-content">
                                <strong>{message}</strong>
                                <span title={new Date(notification.createdAt).toLocaleString()}>{timestamp}</span>
                            </span>
                        </button>
                    )
                })}
            </div>

            {nextCursor && (
                <footer className="notification-panel-footer">
                    <button
                        className="ghost-button"
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