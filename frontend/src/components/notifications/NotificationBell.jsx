import { Bell } from "lucide-react"
import { useNotifications } from "../../context/NotificationContext"

const formatUnreadCount = (count) => (count > 99 ? "99+" : String(count))

const NotificationBell = ({ className = "" }) => {
    const {
        isPanelOpen,
        togglePanel,
        unreadCount
    } = useNotifications()
    const safeUnreadCount = Number.isInteger(unreadCount) && unreadCount > 0 ? unreadCount : 0
    const label = safeUnreadCount > 0
        ? `Notifications, ${safeUnreadCount} unread`
        : "Notifications"

    return (
        <button
            className={`notification-bell ${className}`.trim()}
            type="button"
            data-notification-bell
            onClick={togglePanel}
            aria-label={label}
            aria-haspopup="dialog"
            aria-expanded={isPanelOpen}
        >
            <Bell size={17} aria-hidden="true" />
            {safeUnreadCount > 0 && (
                <span className="notification-bell-badge" aria-hidden="true">
                    {formatUnreadCount(safeUnreadCount)}
                </span>
            )}
            <span className="sr-only">{safeUnreadCount > 0 ? `${safeUnreadCount} unread notifications` : "No unread notifications"}</span>
        </button>
    )
}

export default NotificationBell