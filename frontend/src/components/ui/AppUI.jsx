import { IconAlertCircle, IconCheck, IconNote, IconPlus, IconUsers } from "./Icons"
import { getDisplayName, getInitials } from "./uiUtils"

/* ─── Badge ──────────────────────────────────────────── */
const Badge = ({ tone = "neutral", children }) => {
    return <span className={`badge badge-${tone}`}>{children}</span>
}

/* ─── Empty State ─────────────────────────────────────── */
const emptyIcons = {
    note: <IconNote size={18} />,
    users: <IconUsers size={18} />,
    plus: <IconPlus size={18} />,
}

const EmptyState = ({ title, description, action, icon = "note" }) => {
    const iconEl = icon !== null
        ? (typeof icon === "string" ? emptyIcons[icon] ?? emptyIcons.note : icon)
        : null

    return (
        <section className="empty-state">
            {iconEl !== null && (
                <div className="empty-state-icon" aria-hidden="true">
                    {iconEl}
                </div>
            )}
            <h2>{title}</h2>
            <p>{description}</p>
            {action}
        </section>
    )
}

/* ─── Error State ─────────────────────────────────────── */
const ErrorState = ({ message }) => {
    if (!message) return null

    return (
        <div className="notice notice-error" role="alert">
            <IconAlertCircle size={15} />
            {message}
        </div>
    )
}

/* ─── Loading Rows — Polished skeleton that mirrors note-row ── */
const LoadingRows = ({ count = 5 }) => {
    return (
        <div className="loading-list" aria-label="Loading notes" aria-busy="true">
            {Array.from({ length: count }).map((_, index) => (
                <div className="loading-row" key={index} aria-hidden="true">
                    <div className="loading-row-main">
                        <span
                            className="skel skel-title"
                            style={{ width: `${48 + (index % 3) * 14}%` }}
                        />
                        <span className="skel skel-meta" />
                    </div>
                    <div className="loading-row-meta">
                        <span className="skel skel-avatar" />
                        <span className="skel skel-badge" />
                    </div>
                </div>
            ))}
        </div>
    )
}

/* ─── Avatar utilities ────────────────────────────────── */
const getUserKey = (user) => {
    return user?._id || user?.id || user?.email || user?.username || user
}

const isUserInList = (user, users = []) => {
    const userKeys = [
        user?._id,
        user?.id,
        user?.email,
        user?.username
    ].filter(Boolean)

    return users.some((listUser) => {
        const listUserKeys = [
            listUser?._id,
            listUser?.id,
            listUser?.email,
            listUser?.username
        ].filter(Boolean)

        return userKeys.some((key) => listUserKeys.includes(key))
    })
}

/* ─── Presence marks (dot + typing pulse) ─────────────── */
const PresenceMarks = ({ isOnline, isTyping }) => (
    <>
        {isOnline && <span className="presence-dot" aria-hidden="true" />}
        {isTyping && <span className="typing-pulse" aria-hidden="true" />}
    </>
)

/* ─── Avatar Stack (toolbar) ──────────────────────────── */
const AvatarStack = ({ users = [], limit = 4, typingUsers = [] }) => {
    const visibleUsers = users.slice(0, limit)
    const overflow = Math.max(users.length - visibleUsers.length, 0)

    return (
        <div className="avatar-stack" aria-label={`${users.length} active collaborators`}>
            {visibleUsers.map((user, index) => (
                <span
                    className={`avatar presence-avatar ${isUserInList(user, typingUsers) ? "is-typing" : ""}`}
                    title={getDisplayName(user)}
                    key={getUserKey(user) || index}
                >
                    {getInitials(user)}
                    <PresenceMarks isOnline isTyping={isUserInList(user, typingUsers)} />
                </span>
            ))}
            {overflow > 0 && <span className="avatar avatar-overflow">+{overflow}</span>}
        </div>
    )
}

/* ─── Collaborator Avatar Group (note cards) ──────────── */
const CollaboratorAvatarGroup = ({
    users = [],
    limit = 3,
    activeUsers = [],
    typingUsers = [],
    onClick,
    label = "Manage collaborators"
}) => {
    const visibleUsers = users.filter(Boolean).slice(0, limit)
    const overflow = Math.max(users.length - visibleUsers.length, 0)

    if (visibleUsers.length === 0) return null

    return (
        <button
            className="collaborator-avatar-group"
            type="button"
            onClick={onClick}
            aria-label={label}
        >
            {visibleUsers.map((user, index) => (
                <span
                    className={`collaborator-avatar presence-avatar ${isUserInList(user, typingUsers) ? "is-typing" : ""}`}
                    title={getDisplayName(user)}
                    key={getUserKey(user) || index}
                >
                    {getInitials(user).slice(0, 1)}
                    <PresenceMarks
                        isOnline={isUserInList(user, activeUsers)}
                        isTyping={isUserInList(user, typingUsers)}
                    />
                </span>
            ))}
            {overflow > 0 && (
                <span className="collaborator-avatar collaborator-overflow">+{overflow}</span>
            )}
        </button>
    )
}

/* ─── Success Notice ──────────────────────────────────── */
const SuccessNotice = ({ message }) => {
    if (!message) return null
    return (
        <div className="notice notice-success" role="status">
            <IconCheck size={15} />
            {message}
        </div>
    )
}

export {
    AvatarStack,
    Badge,
    CollaboratorAvatarGroup,
    EmptyState,
    ErrorState,
    LoadingRows,
    SuccessNotice,
}
