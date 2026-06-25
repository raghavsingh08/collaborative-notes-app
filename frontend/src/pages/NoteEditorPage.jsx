import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { deleteNote, getNoteById, updateNote } from "../api/notes.api"
import ShareNoteModal from "../components/notes/ShareNoteModal"
import { AvatarStack, EmptyState, ErrorState, LoadingRows } from "../components/ui/AppUI"
import { getDisplayName } from "../components/ui/uiUtils"
import { useAuth } from "../context/AuthContext"
import useNoteSocket from "../hooks/useNoteSocket"

const getNoteFromResponse = (response) => {
    return response?.data?.note || response?.data?.data?.note || response?.data?.data || response?.data
}

const saveStatusClassMap = {
    "Saved": "saved",
    "Saving...": "saving",
    "Unsaved changes": "unsaved-changes",
    "Save failed": "save-failed"
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

const NoteEditorPage = () => {
    const { noteId } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const [title, setTitle] = useState("")
    const [content, setContent] = useState("")
    const [noteOwner, setNoteOwner] = useState(null)
    const [noteCollaborators, setNoteCollaborators] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [saveStatus, setSaveStatus] = useState("Saved")
    const [error, setError] = useState("")
    const [isShareOpen, setIsShareOpen] = useState(false)
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
    const [isEditorMoreOpen, setIsEditorMoreOpen] = useState(false)
    const hasLoadedNote = useRef(false)
    const isApplyingRemoteUpdate = useRef(false)
    const editorMoreRef = useRef(null)

    const handleRemoteUpdate = useCallback((payload) => {
        if (payload?.noteId !== noteId) {
            return
        }

        isApplyingRemoteUpdate.current = true
        setTitle(payload.title || "")
        setContent(payload.content || "")
    }, [noteId])

    const handleNoteSaved = useCallback((payload) => {
        if (payload?.noteId !== noteId) {
            return
        }

        setSaveStatus("Saved")
    }, [noteId])

    const {
        activeUsers,
        typingUsers,
        socketError,
        emitUpdate,
        emitSave,
        emitTyping
    } = useNoteSocket(noteId, handleRemoteUpdate, handleNoteSaved)

    useEffect(() => {
        const fetchNote = async () => {
            setIsLoading(true)
            setError("")

            try {
                const response = await getNoteById(noteId)
                const note = getNoteFromResponse(response)

                setTitle(note?.title || "")
                setContent(note?.content || "")
                setNoteOwner(note?.owner || note?.ownerId || note?.createdBy || null)
                setNoteCollaborators(Array.isArray(note?.sharedWith) ? note.sharedWith : [])
                hasLoadedNote.current = true
            } catch {
                setError("Unable to load note.")
            } finally {
                setIsLoading(false)
            }
        }

        fetchNote()
    }, [noteId])

    useEffect(() => {
        if (!hasLoadedNote.current || isLoading) {
            return undefined
        }

        if (isApplyingRemoteUpdate.current) {
            isApplyingRemoteUpdate.current = false
            return undefined
        }

        const saveTimer = setTimeout(() => {
            setSaveStatus("Saving...")
            emitSave(title, content)
        }, 1000)

        return () => clearTimeout(saveTimer)
    }, [title, content, isLoading, emitSave])

    useEffect(() => {
        if (socketError && saveStatus === "Saving...") {
            setSaveStatus("Save failed")
        }
    }, [socketError, saveStatus])

    useEffect(() => {
        if (!isEditorMoreOpen) {
            return undefined
        }

        const handlePointerDown = (event) => {
            if (!editorMoreRef.current?.contains(event.target)) {
                setIsEditorMoreOpen(false)
            }
        }

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                setIsEditorMoreOpen(false)
            }
        }

        document.addEventListener("pointerdown", handlePointerDown)
        document.addEventListener("keydown", handleKeyDown)

        return () => {
            document.removeEventListener("pointerdown", handlePointerDown)
            document.removeEventListener("keydown", handleKeyDown)
        }
    }, [isEditorMoreOpen])

    const handleTitleChange = (event) => {
        const nextTitle = event.target.value

        setTitle(nextTitle)
        setSaveStatus("Unsaved changes")
        emitUpdate(nextTitle, content)
        emitTyping()
    }

    const handleContentChange = (event) => {
        const nextContent = event.target.value

        setContent(nextContent)
        setSaveStatus("Unsaved changes")
        emitUpdate(title, nextContent)
        emitTyping()
    }

    const handleSave = async () => {
        setIsSaving(true)
        setSaveStatus("Saving...")
        setError("")

        try {
            await updateNote(noteId, { title, content })
            setSaveStatus("Saved")
        } catch {
            setError("Unable to save note.")
            setSaveStatus("Save failed")
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async () => {
        setError("")

        try {
            await deleteNote(noteId)
            navigate("/dashboard")
        } catch {
            setError("Unable to delete note.")
        }
    }

    if (isLoading) {
        return (
            <main className="editor-shell">
                <section className="editor-loading">
                    <LoadingRows count={5} />
                </section>
            </main>
        )
    }

    return (
        <main className="editor-shell">
            <header className="editor-toolbar">
                <div className="toolbar-left">
                    <button className="ghost-button" type="button" onClick={() => navigate("/dashboard")}>
                        Back
                    </button>
                    <button className="ghost-button" type="button" onClick={() => navigate("/settings")}>
                        Settings
                    </button>
                    <span
                        className={`save-indicator save-${saveStatusClassMap[saveStatus]}`}
                        data-mobile-label={saveStatus === "Unsaved changes" ? "Unsaved" : saveStatus === "Saving..." ? "Saving" : saveStatus === "Save failed" ? "Error" : "Saved"}
                    >
                        {saveStatus}
                    </span>
                </div>

                <div className="toolbar-actions">
                    <div className="toolbar-collaborators">
                        <AvatarStack users={activeUsers} typingUsers={typingUsers} />
                        <span>{activeUsers.length} active</span>
                    </div>
                    <button className="secondary-button save-button" type="button" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? "Saving..." : "Save"}
                    </button>
                    <button className="secondary-button collaboration-entry-button" type="button" onClick={() => setIsShareOpen(true)}>
                        <span className="desktop-label">Collaborators</span>
                        <span className="mobile-label">Collab</span>
                    </button>
                    <button className="danger-button" type="button" onClick={() => setIsDeleteConfirmOpen(true)}>
                        Delete
                    </button>
                    <div className="editor-more" ref={editorMoreRef}>
                        <button
                            className="secondary-button editor-more-trigger"
                            type="button"
                            onClick={() => setIsEditorMoreOpen((currentValue) => !currentValue)}
                            aria-haspopup="menu"
                            aria-expanded={isEditorMoreOpen}
                        >
                            More
                        </button>
                        {isEditorMoreOpen && (
                            <div className="editor-more-menu" role="menu">
                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                        setIsEditorMoreOpen(false)
                                        setIsShareOpen(true)
                                    }}
                                >
                                    Collaborators
                                </button>
                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                        setIsEditorMoreOpen(false)
                                        navigate("/settings")
                                    }}
                                >
                                    Settings
                                </button>
                                <button
                                    className="danger-menu-item"
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                        setIsEditorMoreOpen(false)
                                        setIsDeleteConfirmOpen(true)
                                    }}
                                >
                                    Delete
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <div className="editor-grid">
                <section className="document-surface" aria-labelledby="title">
                    <ErrorState message={error} />
                    <ErrorState message={socketError} />

                    <input
                        id="title"
                        className="title-input"
                        type="text"
                        value={title}
                        onChange={handleTitleChange}
                        placeholder="Untitled"
                        aria-label="Note title"
                    />

                    <textarea
                        id="content"
                        className="content-editor"
                        value={content}
                        onChange={handleContentChange}
                        placeholder="Start writing..."
                        aria-label="Note content"
                    />
                </section>

                <aside className="collaboration-panel" aria-label="Active collaborators">
                    <div>
                        <p className="eyebrow">Live session</p>
                        <h2>Collaborators</h2>
                    </div>

                    {typingUsers.length > 0 && (
                        <div className="typing-indicators" role="status" aria-live="polite">
                            {typingUsers.map((typingUser) => (
                                <p key={typingUser._id || typingUser.id || typingUser.email || typingUser.username}>
                                    {getDisplayName(typingUser)} is typing...
                                </p>
                            ))}
                        </div>
                    )}

                    {activeUsers.length === 0 ? (
                        <EmptyState
                            title="Just you for now"
                            description="Invite teammates to edit together in real time."
                        />
                    ) : (
                        <ul className="collaborator-list">
                            {activeUsers.map((activeUser, index) => (
                                <li key={activeUser?._id || activeUser?.id || activeUser?.email || index}>
                                    <span className={`avatar presence-avatar ${isUserInList(activeUser, typingUsers) ? "is-typing" : ""}`}>
                                        {getDisplayName(activeUser).slice(0, 2).toUpperCase()}
                                        <span className="presence-dot" aria-hidden="true" />
                                        {isUserInList(activeUser, typingUsers) && <span className="typing-pulse" aria-hidden="true" />}
                                    </span>
                                    <span className="collaborator-live-info">
                                        <span>{getDisplayName(activeUser)}</span>
                                        <small>{isUserInList(activeUser, typingUsers) ? "Typing..." : "Online"}</small>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </aside>
            </div>

            {isShareOpen && (
                <ShareNoteModal
                    noteId={noteId}
                    owner={noteOwner}
                    currentUser={user}
                    fallbackCollaborators={noteCollaborators}
                    activeUsers={activeUsers}
                    typingUsers={typingUsers}
                    onClose={() => setIsShareOpen(false)}
                />
            )}

            {isDeleteConfirmOpen && (
                <div className="modal-backdrop">
                    <section className="modal-card delete-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-note-title">
                        <header className="modal-header">
                            <div>
                                <p className="eyebrow">Delete note</p>
                                <h2 id="delete-note-title">Confirm deletion</h2>
                            </div>
                        </header>

                        <p>Are you sure you want to delete this note? This action cannot be undone.</p>

                        <div className="modal-actions">
                            <button className="ghost-button" type="button" onClick={() => setIsDeleteConfirmOpen(false)}>
                                Cancel
                            </button>
                            <button className="danger-button" type="button" onClick={handleDelete}>
                                Delete note
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </main>
    )
}

export default NoteEditorPage
