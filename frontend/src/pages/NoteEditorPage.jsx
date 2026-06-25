import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { deleteNote, getNoteById, updateNote } from "../api/notes.api"
import ShareNoteModal from "../components/notes/ShareNoteModal"
import { AvatarStack, EmptyState, ErrorState, LoadingRows } from "../components/ui/AppUI"
import {
    IconArrowLeft,
    IconClose,
    IconMoreHorizontal,
    IconSave,
    IconSettings,
    IconTrash,
    IconUsers,
} from "../components/ui/Icons"
import { getDisplayName } from "../components/ui/uiUtils"
import { useAuth } from "../context/AuthContext"
import useNoteSocket from "../hooks/useNoteSocket"
import usePageTitle from "../hooks/usePageTitle"

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

const getId = (user) => user?._id || user?.id || user

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
    const [loadError, setLoadError] = useState(false)
    const [isShareOpen, setIsShareOpen] = useState(false)
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
    const [isEditorMoreOpen, setIsEditorMoreOpen] = useState(false)
    const hasLoadedNote = useRef(false)
    const isApplyingRemoteUpdate = useRef(false)
    const editorMoreRef = useRef(null)

    const currentUserId = String(user?._id || user?.id || "")
    const ownerId = String(noteOwner?._id || noteOwner?.id || noteOwner?.ownerId || noteOwner?.createdBy || noteOwner || "")
    const isOwner = Boolean(currentUserId && ownerId && currentUserId === ownerId && currentUserId !== "undefined" && ownerId !== "undefined")

    usePageTitle(title || "Editor")

    const handleRemoteUpdate = useCallback((payload) => {
        if (payload?.noteId !== noteId) return

        isApplyingRemoteUpdate.current = true
        setTitle(payload.title || "")
        setContent(payload.content || "")
    }, [noteId])

    const handleNoteSaved = useCallback((payload) => {
        if (payload?.noteId !== noteId) return
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

    const sortedActiveUsers = useMemo(() => {
        const ownerIdString = String(getId(noteOwner) || "")
        return [...activeUsers].sort((a, b) => {
            const aId = String(getId(a) || "")
            const bId = String(getId(b) || "")
            if (ownerIdString && aId === ownerIdString) return -1
            if (ownerIdString && bId === ownerIdString) return 1
            return 0
        })
    }, [activeUsers, noteOwner])

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
                setLoadError(true)
            } finally {
                setIsLoading(false)
            }
        }

        fetchNote()
    }, [noteId])

    useEffect(() => {
        if (!hasLoadedNote.current || isLoading) return undefined

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
        if (!isEditorMoreOpen) return undefined

        const handlePointerDown = (event) => {
            if (!editorMoreRef.current?.contains(event.target)) {
                setIsEditorMoreOpen(false)
            }
        }

        const handleKeyDown = (event) => {
            if (event.key === "Escape") setIsEditorMoreOpen(false)
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

    if (loadError) {
        return (
            <main className="editor-shell">
                <section className="editor-loading">
                    <EmptyState
                        icon="note"
                        title="Note not found"
                        description="This note may have been deleted or you may not have access to it."
                        action={
                            <button
                                className="primary-button"
                                type="button"
                                onClick={() => navigate("/dashboard")}
                            >
                                <IconArrowLeft size={14} />
                                Back to dashboard
                            </button>
                        }
                    />
                </section>
            </main>
        )
    }

    return (
        <main className="editor-shell">
            <header className="editor-toolbar">
                <div className="editor-toolbar-left">
                    <button
                        className="ghost-button"
                        type="button"
                        onClick={() => navigate("/dashboard")}
                        aria-label="Back to dashboard"
                    >
                        <IconArrowLeft size={15} />
                        <span className="desktop-label">Back</span>
                    </button>

                    <span
                        className={`save-indicator save-${saveStatusClassMap[saveStatus]}`}
                        aria-live="polite"
                    >
                        {saveStatus === "Unsaved changes" ? "Unsaved" : saveStatus}
                    </span>
                </div>

                <div className="editor-toolbar-status">
                    {sortedActiveUsers.length > 0 && (
                        <div 
                            className="toolbar-collaborators" 
                            aria-label={`${sortedActiveUsers.length} active users`}
                            onClick={() => setIsShareOpen(true)}
                            role="button"
                            tabIndex={0}
                        >
                            <AvatarStack users={sortedActiveUsers} typingUsers={typingUsers} />
                            <span className="desktop-label">{sortedActiveUsers.length} active</span>
                        </div>
                    )}
                </div>

                <div className="editor-toolbar-actions">
                    <button
                        className="ghost-button collaboration-entry-button"
                        type="button"
                        onClick={() => setIsShareOpen(true)}
                    >
                        <IconUsers size={15} />
                        <span className="desktop-label">Share</span>
                    </button>

                    <button
                        className="primary-button save-button"
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        <IconSave size={15} />
                        <span className="desktop-label">{isSaving ? "Saving…" : "Save"}</span>
                    </button>

                    <div className="editor-more" ref={editorMoreRef}>
                        <button
                            className="icon-button editor-more-trigger"
                            type="button"
                            onClick={() => setIsEditorMoreOpen((v) => !v)}
                            aria-haspopup="menu"
                            aria-expanded={isEditorMoreOpen}
                            aria-label="More options"
                        >
                            <IconMoreHorizontal size={15} />
                        </button>
                        {isEditorMoreOpen && (
                            <div className="editor-more-menu" role="menu">
                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                        setIsEditorMoreOpen(false)
                                        navigate("/settings")
                                    }}
                                >
                                    <IconSettings size={14} />
                                    Settings
                                </button>
                                {isOwner && (
                                    <>
                                        <div className="menu-separator" aria-hidden="true" />
                                        <button
                                            className="danger-menu-item"
                                            type="button"
                                            role="menuitem"
                                            onClick={() => {
                                                setIsEditorMoreOpen(false)
                                                setIsDeleteConfirmOpen(true)
                                            }}
                                        >
                                            <IconTrash size={14} />
                                            Delete
                                        </button>
                                    </>
                                )}
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

                    <hr className="content-divider" aria-hidden="true" />

                    <textarea
                        id="content"
                        className="content-editor"
                        value={content}
                        onChange={handleContentChange}
                        placeholder="Start writing…"
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
                                    {getDisplayName(typingUser)} is typing…
                                </p>
                            ))}
                        </div>
                    )}

                    {sortedActiveUsers.length === 0 ? (
                        <EmptyState
                            icon="users"
                            title="Just you for now"
                            description="Invite teammates to edit together in real time."
                        />
                    ) : (
                        <ul className="collaborator-list">
                            {sortedActiveUsers.map((activeUser, index) => (
                                <li key={activeUser?._id || activeUser?.id || activeUser?.email || index}>
                                    <span
                                        className={`avatar presence-avatar ${isUserInList(activeUser, typingUsers) ? "is-typing" : ""}`}
                                    >
                                        {getDisplayName(activeUser).slice(0, 2).toUpperCase()}
                                        <span className="presence-dot" aria-hidden="true" />
                                        {isUserInList(activeUser, typingUsers) && (
                                            <span className="typing-pulse" aria-hidden="true" />
                                        )}
                                    </span>
                                    <span className="collaborator-live-info">
                                        <span>{getDisplayName(activeUser)}</span>
                                        <small>
                                            {isUserInList(activeUser, typingUsers) ? "Typing…" : "Online"}
                                        </small>
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
                    <section
                        className="modal-card delete-confirm-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="delete-note-title"
                    >
                        <header className="modal-header">
                            <div>
                                <p className="eyebrow">Delete note</p>
                                <h2 id="delete-note-title">Confirm deletion</h2>
                            </div>
                            <button
                                className="icon-button"
                                type="button"
                                onClick={() => setIsDeleteConfirmOpen(false)}
                                aria-label="Cancel"
                            >
                                <IconClose size={15} />
                            </button>
                        </header>

                        <p>Are you sure you want to delete this note? This action cannot be undone.</p>

                        <div className="modal-actions">
                            <button
                                className="ghost-button"
                                type="button"
                                onClick={() => setIsDeleteConfirmOpen(false)}
                            >
                                Cancel
                            </button>
                            <button className="danger-button" type="button" onClick={handleDelete}>
                                <IconTrash size={14} />
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
