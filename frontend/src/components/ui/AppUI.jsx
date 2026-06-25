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
    owner = null,
    currentUser = null,
    limit = 3,
    activeUsers = [],
    typingUsers = [],
    onClick,
    label = "Manage collaborators"
}) => {
    let stackUsers = []
    
    const ownerKey = owner ? getUserKey(owner) : null
    const currentUserKey = currentUser ? getUserKey(currentUser) : null
    const isOwner = Boolean(ownerKey && currentUserKey && ownerKey === currentUserKey)

    if (isOwner) {
        // Logged-in user is the owner: show ONLY collaborators (do not include owner's own avatar)
        stackUsers = users.filter(u => getUserKey(u) !== ownerKey)
    } else {
        // Logged-in user is an editor: show Owner FIRST, then editors
        const editors = users.filter(u => getUserKey(u) !== ownerKey)
        stackUsers = owner ? [owner, ...editors] : [...editors]
    }

    const visibleUsers = stackUsers.filter(Boolean).slice(0, limit)
    const overflow = Math.max(stackUsers.length - visibleUsers.length, 0)

    if (stackUsers.length === 0) return null

    return (
        <button
            className="collaborator-avatar-group"
            type="button"
            onClick={onClick}
            aria-label={label}
        >
            {visibleUsers.map((user, index) => {
                const isUserOwner = ownerKey && getUserKey(user) === ownerKey
                const isUserCurrent = currentUserKey && getUserKey(user) === currentUserKey
                
                const avatarClass = `collaborator-avatar presence-avatar ${isUserInList(user, typingUsers) ? "is-typing" : ""} ${isUserOwner ? "is-owner" : ""} ${isUserCurrent && !isUserOwner ? "is-current-user" : ""}`
                
                let tooltip = getDisplayName(user, isUserOwner ? "Owner" : "Editor")
                if (isUserOwner) tooltip += "\nOwner"
                else if (isUserCurrent) tooltip += "\nYou"
                else tooltip += "\nEditor"

                // Pass the correct fallback to getInitials as well (indirectly by wrapping in an object if it's a string, or just using getDisplayName)
                // Actually getInitials calls getDisplayName(value) internally without fallback.
                // So let's extract the exact display name first.
                const finalDisplayName = getDisplayName(user, isUserOwner ? "Owner" : "Editor")
                const finalInitial = getInitials(finalDisplayName).slice(0, 1)

                return (
                    <span
                        className={avatarClass}
                        title={tooltip}
                        key={getUserKey(user) || index}
                    >
                        {finalInitial}
                        <PresenceMarks
                            isOnline={isUserInList(user, activeUsers)}
                            isTyping={isUserInList(user, typingUsers)}
                        />
                        {isUserCurrent && !isUserOwner && (
                            <span className="current-user-indicator" aria-hidden="true" title="You">
                                <IconCheck size={10} />
                            </span>
                        )}
                    </span>
                )
            })}
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
