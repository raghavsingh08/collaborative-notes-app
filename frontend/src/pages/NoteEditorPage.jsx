import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { deleteNote, getNoteById, updateNote } from "../api/notes.api"
import ShareNoteModal from "../components/notes/ShareNoteModal"
import { AvatarStack, EmptyState, ErrorState, LoadingRows } from "../components/ui/AppUI"
import { getDisplayName } from "../components/ui/uiUtils"
import useNoteSocket from "../hooks/useNoteSocket"

const getNoteFromResponse = (response) => {
    return response?.data?.note || response?.data?.data?.note || response?.data?.data || response?.data
}

const NoteEditorPage = () => {
    const { noteId } = useParams()
    const navigate = useNavigate()
    const [title, setTitle] = useState("")
    const [content, setContent] = useState("")
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [saveStatus, setSaveStatus] = useState("Saved")
    const [error, setError] = useState("")
    const [isShareOpen, setIsShareOpen] = useState(false)
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
    const hasLoadedNote = useRef(false)
    const isApplyingRemoteUpdate = useRef(false)

    const handleRemoteUpdate = useCallback((payload) => {
        if (payload?.noteId !== noteId) {
            return
        }

        isApplyingRemoteUpdate.current = true
        setTitle(payload.title || "")
        setContent(payload.content || "")
    }, [noteId])

    const {
        activeUsers,
        socketError,
        emitUpdate,
        emitSave
    } = useNoteSocket(noteId, handleRemoteUpdate)

    useEffect(() => {
        const fetchNote = async () => {
            setIsLoading(true)
            setError("")

            try {
                const response = await getNoteById(noteId)
                const note = getNoteFromResponse(response)

                setTitle(note?.title || "")
                setContent(note?.content || "")
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
            setSaveStatus("Saving")
            emitSave(title, content)
            setSaveStatus("Saved")
        }, 1000)

        return () => clearTimeout(saveTimer)
    }, [title, content, isLoading, emitSave])

    const handleTitleChange = (event) => {
        const nextTitle = event.target.value

        setTitle(nextTitle)
        setSaveStatus("Editing")
        emitUpdate(nextTitle, content)
    }

    const handleContentChange = (event) => {
        const nextContent = event.target.value

        setContent(nextContent)
        setSaveStatus("Editing")
        emitUpdate(title, nextContent)
    }

    const handleSave = async () => {
        setIsSaving(true)
        setSaveStatus("Saving")
        setError("")

        try {
            await updateNote(noteId, { title, content })
            setSaveStatus("Saved")
        } catch {
            setError("Unable to save note.")
            setSaveStatus("Needs attention")
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
                    <span className={`save-indicator save-${saveStatus.toLowerCase().replace(/\s+/g, "-")}`}>
                        {saveStatus}
                    </span>
                </div>

                <div className="toolbar-actions">
                    <div className="toolbar-collaborators">
                        <AvatarStack users={activeUsers} />
                        <span>{activeUsers.length} active</span>
                    </div>
                    <button className="secondary-button" type="button" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? "Saving" : "Save"}
                    </button>
                    <button className="primary-button" type="button" onClick={() => setIsShareOpen(true)}>
                        Share
                    </button>
                    <button className="danger-button" type="button" onClick={() => setIsDeleteConfirmOpen(true)}>
                        Delete
                    </button>
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

                    {activeUsers.length === 0 ? (
                        <EmptyState
                            title="Just you for now"
                            description="Invite teammates to edit together in real time."
                        />
                    ) : (
                        <ul className="collaborator-list">
                            {activeUsers.map((activeUser, index) => (
                                <li key={activeUser?._id || activeUser?.id || activeUser?.email || index}>
                                    <span className="avatar">{getDisplayName(activeUser).slice(0, 2).toUpperCase()}</span>
                                    <span>{getDisplayName(activeUser)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </aside>
            </div>

            {isShareOpen && (
                <ShareNoteModal
                    noteId={noteId}
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
