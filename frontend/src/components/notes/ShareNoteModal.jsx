import { useCallback, useEffect, useState } from "react"
import { getSharedUsers, removeSharedUser, shareNote } from "../../api/notes.api"

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
        <div role="dialog" aria-modal="true" aria-labelledby="share-note-title">
            <h2 id="share-note-title">Share Note</h2>

            <form onSubmit={handleShare}>
                <input
                    type="text"
                    value={recipient}
                    onChange={(event) => setRecipient(event.target.value)}
                    placeholder="Email or username"
                    aria-label="Email or username"
                />
                <button type="submit" disabled={isSharing}>
                    {isSharing ? "Sharing..." : "Share"}
                </button>
            </form>

            {error && <p role="alert">{error}</p>}

            {isLoading ? (
                <p>Loading...</p>
            ) : (
                <ul>
                    {sharedUsers.map((user) => (
                        <li key={user._id || user.id}>
                            <span>{user.username || user.email}</span>
                            <button
                                type="button"
                                onClick={() => handleRemoveUser(user._id || user.id)}
                            >
                                Remove
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <button type="button" onClick={onClose}>
                Close
            </button>
        </div>
    )
}

export default ShareNoteModal
