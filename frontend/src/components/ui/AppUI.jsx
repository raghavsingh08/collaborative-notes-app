import { getDisplayName, getInitials } from "./uiUtils"

const Badge = ({ tone = "neutral", children }) => {
    return <span className={`badge badge-${tone}`}>{children}</span>
}

const EmptyState = ({ title, description, action }) => {
    return (
        <section className="empty-state">
            <div className="empty-state-icon" aria-hidden="true">+</div>
            <h2>{title}</h2>
            <p>{description}</p>
            {action}
        </section>
    )
}

const ErrorState = ({ message }) => {
    if (!message) {
        return null
    }

    return (
        <div className="notice notice-error" role="alert">
            {message}
        </div>
    )
}

const LoadingRows = ({ count = 5 }) => {
    return (
        <div className="loading-list" aria-label="Loading">
            {Array.from({ length: count }).map((_, index) => (
                <div className="loading-row" key={index}>
                    <span />
                    <span />
                </div>
            ))}
        </div>
    )
}

const AvatarStack = ({ users = [], limit = 4 }) => {
    const visibleUsers = users.slice(0, limit)
    const overflow = Math.max(users.length - visibleUsers.length, 0)

    return (
        <div className="avatar-stack" aria-label={`${users.length} active collaborators`}>
            {visibleUsers.map((user, index) => (
                <span className="avatar" title={getDisplayName(user)} key={user?._id || user?.id || user?.email || index}>
                    {getInitials(user)}
                </span>
            ))}
            {overflow > 0 && <span className="avatar avatar-overflow">+{overflow}</span>}
        </div>
    )
}

export {
    AvatarStack,
    Badge,
    EmptyState,
    ErrorState,
    LoadingRows
}
