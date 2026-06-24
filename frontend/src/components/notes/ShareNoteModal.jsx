import { useCallback, useEffect, useState } from "react"
import { getSharedUsers, removeSharedUser, shareNote } from "../../api/notes.api"
import { EmptyState, ErrorState, LoadingRows } from "../ui/AppUI"

const getSharedUsersFromResponse = (response) => {
    return response?.data?.users || response?.data?.data?.users || response?.data?.data || response?.data || []
}

const ShareNoteModal = ({ noteId, onClose }) => {
    const [recipient, setRecipient] = useState("")
    const [sharedUsers, setSharedUsers] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSharing, setIsSharing] = useState(false)
    const [error, setError] = useState("")

    const fetchSharedUsers = useCallback(async () => {
        setIsLoading(true)
        setError("")

        try {
            const response = await getSharedUsers(noteId)
            setSharedUsers(getSharedUsersFromResponse(response))
        } catch {
            setError("Unable to load shared users.")
        } finally {
            setIsLoading(false)
        }
    }, [noteId])

    useEffect(() => {
        fetchSharedUsers()
    }, [fetchSharedUsers])

    const handleShare = async (event) => {
        event.preventDefault()

        if (!recipient.trim()) {
            return
        }   

        setIsSharing(true)
        setError("")

        try {
            const value = recipient.trim()

            const shareData = value.includes("@")
                ? { email: value }
                : { username: value }

            await shareNote(noteId, shareData)
            setRecipient("")
            await fetchSharedUsers()
        } catch {
            setError("Unable to share note.")
        } finally {
            setIsSharing(false)
        }
}

    const handleRemoveUser = async (userId) => {
        setError("")

        try {
            await removeSharedUser(noteId, userId)
            await fetchSharedUsers()
        } catch {
            setError("Unable to remove shared user.")
        }
    }

    return (
        <div className="modal-backdrop">
            <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="share-note-title">
                <header className="modal-header">
                    <div>
                        <p className="eyebrow">Access</p>
                        <h2 id="share-note-title">Share note</h2>
                    </div>
                    <button className="icon-button" type="button" onClick={onClose} aria-label="Close share dialog">
                        x
                    </button>
                </header>

                <form className="share-form" onSubmit={handleShare}>
                    <input
                        type="text"
                        value={recipient}
                        onChange={(event) => setRecipient(event.target.value)}
                        placeholder="Email or username"
                        aria-label="Email or username"
                    />
                    <button className="primary-button" type="submit" disabled={isSharing}>
                        {isSharing ? "Sharing" : "Share"}
                    </button>
                </form>

                <ErrorState message={error} />

                {isLoading ? (
                    <LoadingRows count={3} />
                ) : sharedUsers.length === 0 ? (
                    <EmptyState
                        title="No shared users"
                        description="Add a teammate above to give them access."
                    />
                ) : (
                    <ul className="shared-user-list">
                        {sharedUsers.map((user) => (
                            <li key={user._id || user.id}>
                                <span>{user.username || user.email}</span>
                                <button
                                    className="ghost-button"
                                    type="button"
                                    onClick={() => handleRemoveUser(user._id || user.id)}
                                >
                                    Remove
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    )
}

export default ShareNoteModal
