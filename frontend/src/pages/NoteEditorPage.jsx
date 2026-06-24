import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { deleteNote, getNoteById, updateNote } from "../api/notes.api"
import ShareNoteModal from "../components/notes/ShareNoteModal"
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
    const [error, setError] = useState("")
    const [isShareOpen, setIsShareOpen] = useState(false)
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
            emitSave(title, content)
        }, 1000)

        return () => clearTimeout(saveTimer)
    }, [title, content, isLoading, emitSave])

    const handleTitleChange = (event) => {
        const nextTitle = event.target.value

        setTitle(nextTitle)
        emitUpdate(nextTitle, content)
    }

    const handleContentChange = (event) => {
        const nextContent = event.target.value

        setContent(nextContent)
        emitUpdate(title, nextContent)
    }

    const handleSave = async () => {
        setIsSaving(true)
        setError("")

        try {
            await updateNote(noteId, { title, content })
        } catch {
            setError("Unable to save note.")
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
        return <p>Loading...</p>
    }

    return (
        <main>
            <button type="button" onClick={() => navigate("/dashboard")}>
                Back
            </button>

            <h1>Edit Note</h1>

            {error && <p role="alert">{error}</p>}
            {socketError && <p role="alert">{socketError}</p>}

            <p>Active users: {activeUsers.length}</p>

            <div>
                <label htmlFor="title">Title</label>
                <input
                    id="title"
                    type="text"
                    value={title}
                    onChange={handleTitleChange}
                />
            </div>

            <div>
                <label htmlFor="content">Content</label>
                <textarea
                    id="content"
                    value={content}
                    onChange={handleContentChange}
                    rows="10"
                />
            </div>
            
            <button type="button" onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={() => setIsShareOpen(true)}>
                Share
            </button>

            <button type="button" onClick={handleDelete}>
                Delete
            </button>
            {isShareOpen && (
            <ShareNoteModal
            noteId={noteId}
            onClose={() => setIsShareOpen(false)}
            />
        )}
        </main>
    )
}

export default NoteEditorPage
