import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getSharedUsers, removeSharedUser, shareNote } from "../../api/notes.api"
import { EmptyState, ErrorState, LoadingRows } from "../ui/AppUI"
import { IconClose, IconUsers } from "../ui/Icons"
import { getDisplayName, getInitials } from "../ui/uiUtils"

const getSharedUsersFromResponse = (response) => {
    return response?.data?.users || response?.data?.data?.users || response?.data?.data || response?.data || []
}

const getId = (value) => {
    return value?._id || value?.id || value
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

const PresenceMarks = ({ isOnline, isTyping }) => (
    <>
        {isOnline && <span className="presence-dot" aria-hidden="true" />}
        {isTyping && <span className="typing-pulse" aria-hidden="true" />}
    </>
)

const getUsersFromNoteField = (users = [], currentUser) => {
    return Array.isArray(users)
        ? users
            .map((user) => {
                if (user && typeof user === "object") return user
                return getId(user) === getId(currentUser) ? currentUser : null
            })
            .filter(Boolean)
        : []
}

const ShareNoteModal = ({
    noteId,
    owner,
    currentUser,
    fallbackCollaborators = [],
    activeUsers = [],
    typingUsers = [],
    onClose
}) => {
    const [recipient, setRecipient] = useState("")
    const [sharedUsers, setSharedUsers] = useState([])
    const [isInviteOpen, setIsInviteOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [isSharing, setIsSharing] = useState(false)
    const [error, setError] = useState("")
    const panelRef = useRef(null)
    const fallbackUsers = useMemo(
        () => getUsersFromNoteField(fallbackCollaborators, currentUser),
        [currentUser, fallbackCollaborators]
    )
    const ownerId = getId(owner)
    const currentUserId = getId(currentUser)
    const canManage = Boolean(ownerId && currentUserId && ownerId === currentUserId)
    const ownerUser = canManage ? currentUser : (owner && typeof owner === "object" ? owner : null)
    const ownerName = canManage ? "You" : (ownerUser ? getDisplayName(ownerUser) : "Note owner")
    const ownerInitialSource = ownerUser ? ownerUser : (canManage ? currentUser : "Owner")
    const isOwnerOnline = isUserInList(ownerUser || currentUser, activeUsers)
    const isOwnerTyping = isUserInList(ownerUser || currentUser, typingUsers)

    const fetchSharedUsers = useCallback(async () => {
        setIsLoading(true)
        setError("")

        // Editors are now authorized to fetch the full roster from the backend
        // so we don't need to artificially short-circuit them.

        try {
            const response = await getSharedUsers(noteId)
            setSharedUsers(getSharedUsersFromResponse(response))
        } catch {
            setSharedUsers(fallbackUsers)
            setError("Unable to load collaborators.")
        } finally {
            setIsLoading(false)
        }
    }, [canManage, fallbackUsers, noteId])

    useEffect(() => {
        fetchSharedUsers()
    }, [fetchSharedUsers])

    useEffect(() => {
        const handlePointerDown = (event) => {
            if (!panelRef.current?.contains(event.target)) onClose()
        }

        const handleKeyDown = (event) => {
            if (event.key === "Escape") onClose()
        }

        document.addEventListener("pointerdown", handlePointerDown)
        document.addEventListener("keydown", handleKeyDown)

        return () => {
            document.removeEventListener("pointerdown", handlePointerDown)
            document.removeEventListener("keydown", handleKeyDown)
        }
    }, [onClose])

    const handleShare = async (event) => {
        event.preventDefault()

        if (!recipient.trim() || !canManage) return

        setIsSharing(true)
        setError("")

        try {
            const value = recipient.trim()
            const shareData = value.includes("@") ? { email: value } : { username: value }
            await shareNote(noteId, shareData)
            setRecipient("")
            setIsInviteOpen(false)
            await fetchSharedUsers()
        } catch {
            setError("Unable to invite collaborator.")
        } finally {
            setIsSharing(false)
        }
    }

    const handleRemoveUser = async (userId) => {
        if (!canManage) return

        setError("")

        try {
            await removeSharedUser(noteId, userId)
            await fetchSharedUsers()
        } catch {
            setError("Unable to remove collaborator.")
        }
    }

    return (
        <div className="modal-backdrop">
            <section
                className="modal-card collaboration-modal-card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="collaboration-panel-title"
                ref={panelRef}
            >
                <header className="modal-header">
                    <div>
                        <p className="eyebrow">Collaboration</p>
                        <h2 id="collaboration-panel-title">Manage access</h2>
                    </div>
                    <button
                        className="icon-button"
                        type="button"
                        onClick={onClose}
                        aria-label="Close collaboration panel"
                    >
                        <IconClose size={15} />
                    </button>
                </header>

                {/* Owner */}
                <div className="collaboration-section">
                    <p className="collaboration-section-title">Owner</p>
                    <div className="collaboration-user-row">
                        <span className={`collaboration-user-avatar presence-avatar ${isOwnerTyping ? "is-typing" : ""}`}>
                            {getInitials(ownerInitialSource).slice(0, 1)}
                            <PresenceMarks isOnline={isOwnerOnline} isTyping={isOwnerTyping} />
                        </span>
                        <span>
                            <strong>{ownerName}</strong>
                            <small className="status-indicator">
                                {isOwnerTyping ? (
                                    <><span className="status-dot-inline typing" aria-hidden="true" /> Typing…</>
                                ) : isOwnerOnline ? (
                                    <><span className="status-dot-inline online" aria-hidden="true" /> Online</>
                                ) : (
                                    <><span className="status-dot-inline offline" aria-hidden="true" /> Owner</>
                                )}
                            </small>
                        </span>
                    </div>
                </div>

                <ErrorState message={error} />

                {/* Editors */}
                <div className="collaboration-section">
                    <p className="collaboration-section-title">Editors</p>
                    {isLoading ? (
                        <LoadingRows count={2} />
                    ) : sharedUsers.length === 0 ? (
                        <EmptyState
                            icon="users"
                            title="No editors yet"
                            description="Invite a teammate to collaborate on this note."
                        />
                    ) : (
                        <ul className="shared-user-list collaboration-user-list">
                            {sharedUsers.map((user, index) => {
                                const isOnline = isUserInList(user, activeUsers)
                                const isTyping = isUserInList(user, typingUsers)

                                return (
                                    <li key={user._id || user.id || user.email || index}>
                                        <span className="collaboration-user-info">
                                            <span className={`collaboration-user-avatar presence-avatar ${isTyping ? "is-typing" : ""}`}>
                                                {getInitials(user).slice(0, 1)}
                                                <PresenceMarks isOnline={isOnline} isTyping={isTyping} />
                                            </span>
                                            <span>
                                                <strong>{getDisplayName(user)}</strong>
                                                <small className="status-indicator">
                                                    {isTyping ? (
                                                        <><span className="status-dot-inline typing" aria-hidden="true" /> Typing…</>
                                                    ) : isOnline ? (
                                                        <><span className="status-dot-inline online" aria-hidden="true" /> Online</>
                                                    ) : (
                                                        <><span className="status-dot-inline offline" aria-hidden="true" /> Offline</>
                                                    )}
                                                </small>
                                            </span>
                                        </span>
                                        {canManage && (
                                            <button
                                                className="ghost-button"
                                                type="button"
                                                onClick={() => handleRemoveUser(user._id || user.id)}
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </div>

                {canManage && (
                    <div className="invite-collaborator">
                        {isInviteOpen ? (
                            <form className="share-form" onSubmit={handleShare}>
                                <input
                                    type="text"
                                    value={recipient}
                                    onChange={(event) => setRecipient(event.target.value)}
                                    placeholder="Email or username"
                                    aria-label="Email or username"
                                    // eslint-disable-next-line jsx-a11y/no-autofocus
                                    autoFocus
                                />
                                <button className="primary-button" type="submit" disabled={isSharing}>
                                    {isSharing ? "Inviting…" : "Invite"}
                                </button>
                            </form>
                        ) : (
                            <button
                                className="secondary-button invite-button"
                                type="button"
                                onClick={() => setIsInviteOpen(true)}
                            >
                                <IconUsers size={15} />
                                Invite collaborator
                            </button>
                        )}
                    </div>
                )}
            </section>
        </div>
    )
}

export default ShareNoteModal
