import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { createNote, getNotes } from "../api/notes.api"
import { useAuth } from "../context/AuthContext"

const getNotesFromResponse = (response) => {
    return response?.data?.notes || response?.data?.data?.notes || response?.data?.data || response?.data || []
}

const getId = (value) => {
    return value?._id || value?.id || value
}

const DashboardPage = () => {
    const navigate = useNavigate()
    const { user } = useAuth()
    const [notes, setNotes] = useState([])
    const [title, setTitle] = useState("")
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState("")

    const fetchNotes = async () => {
        setIsLoading(true)
        setError("")

        try {
            const response = await getNotes()
            setNotes(getNotesFromResponse(response))
        } catch {
            setError("Unable to load notes.")
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchNotes()
    }, [])

    const handleCreateNote = async (event) => {
        event.preventDefault()

        if (!title.trim()) {
            return
        }

        try {
            await createNote({ title: title.trim() })
            setTitle("")
            await fetchNotes()
        } catch {
            setError("Unable to create note.")
        }
    }

    return (
        <main>
            <h1>Dashboard</h1>

            <form onSubmit={handleCreateNote}>
                <input
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Note title"
                    aria-label="Note title"
                />
                <button type="submit">Create Note</button>
            </form>

            {error && <p role="alert">{error}</p>}

            {isLoading ? (
                <p>Loading...</p>
            ) : (
                <ul>
                    {notes.map((note) => (
                        <li key={note._id || note.id}>
                            <button
                                type="button"
                                onClick={() => navigate(`/notes/${note._id || note.id}`)}
                            >
                                <span>{note.title}</span>
                                {" "}
                                <span>
                                    {getId(note.owner || note.ownerId || note.createdBy) === getId(user)
                                        ? "Owned by you"
                                        : "Shared with you"}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </main>
    )
}

export default DashboardPage
