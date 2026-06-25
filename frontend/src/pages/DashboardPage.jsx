import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { createNote, getNotes } from "../api/notes.api"
import { useAuth } from "../context/AuthContext"
import { Badge, EmptyState, ErrorState, LoadingRows } from "../components/ui/AppUI"
import UserMenu from "../components/ui/UserMenu"
import { formatDateTime } from "../components/ui/uiUtils"

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
    const [query, setQuery] = useState("")
    const [activeFilter, setActiveFilter] = useState("all")
    const [selectedNoteId, setSelectedNoteId] = useState("")
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
        await createNoteFromTitle(title)
    }

    const createNoteFromTitle = async (nextTitle) => {
        if (!nextTitle.trim()) {
            return
        }

        try {
            const response = await createNote({ title: nextTitle.trim() })
            const note = response?.data?.note || response?.data?.data?.note || response?.data?.data || response?.data

            setTitle("")
            await fetchNotes()

            if (note?._id || note?.id) {
                navigate(`/notes/${note._id || note.id}`)
            }
        } catch {
            setError("Unable to create note.")
        }
    }

    const handleCreateFirstNote = () => {
        createNoteFromTitle("Untitled note")
    }

    const isOwnedNote = (note) => {
        return getId(note.owner || note.ownerId || note.createdBy) === getId(user)
    }

    const filteredByOwnership = notes.filter((note) => {
        if (activeFilter === "owned") {
            return isOwnedNote(note)
        }

        if (activeFilter === "shared") {
            return !isOwnedNote(note)
        }

        return true
    })

    const filteredNotes = filteredByOwnership.filter((note) => {
        const noteTitle = note.title || "Untitled"
        return noteTitle.toLowerCase().includes(query.trim().toLowerCase())
    })

    const ownedCount = notes.filter(isOwnedNote).length
    const sharedCount = Math.max(notes.length - ownedCount, 0)
    const displayName = user?.username || user?.name || user?.email || "Workspace"
    const filterEmptyTitle = activeFilter === "owned"
        ? "No owned notes"
        : activeFilter === "shared"
            ? "No shared notes"
            : "Start your first note"

    const filterEmptyDescription = activeFilter === "owned"
        ? "Notes you create will appear here."
        : activeFilter === "shared"
            ? "Notes shared with you will appear here."
            : "Create a blank note and start writing with your team."

    return (
        <main className="app-shell">
            <aside className="sidebar">
                <div className="brand-row">
                    <UserMenu />
                    <div>
                        <p className="eyebrow">Collaborative Notes</p>
                        <h1>{displayName}</h1>
                    </div>
                </div>

                <form className="create-note-form" onSubmit={handleCreateNote}>
                    <label htmlFor="new-note-title">New note</label>
                    <div className="create-note-control">
                        <input
                            id="new-note-title"
                            type="text"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="Note title"
                            aria-label="Note title"
                        />
                        <button type="submit">Create</button>
                    </div>
                </form>

                <nav className="sidebar-nav" aria-label="Workspace">
                    <button
                        className={`nav-item ${activeFilter === "all" ? "active" : ""}`}
                        type="button"
                        onClick={() => setActiveFilter("all")}
                    >
                        All notes <strong>{notes.length}</strong>
                    </button>
                    <button
                        className={`nav-item ${activeFilter === "owned" ? "active" : ""}`}
                        type="button"
                        onClick={() => setActiveFilter("owned")}
                    >
                        Owned <strong>{ownedCount}</strong>
                    </button>
                    <button
                        className={`nav-item ${activeFilter === "shared" ? "active" : ""}`}
                        type="button"
                        onClick={() => setActiveFilter("shared")}
                    >
                        Shared <strong>{sharedCount}</strong>
                    </button>
                </nav>
            </aside>

            <section className="dashboard-panel" aria-labelledby="dashboard-title">
                <header className="dashboard-header">
                    <div>
                        <p className="eyebrow">Workspace</p>
                        <h2 id="dashboard-title">Notes</h2>
                    </div>
                    <div className="search-wrap">
                        <span aria-hidden="true">/</span>
                        <input
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search notes"
                            aria-label="Search notes"
                        />
                    </div>
                </header>

                <ErrorState message={error} />

                {isLoading ? (
                    <LoadingRows count={6} />
                ) : filteredNotes.length === 0 ? (
                    <EmptyState
                        title={query ? "No notes found" : filterEmptyTitle}
                        description={query ? "Try another search or clear the search field." : filterEmptyDescription}
                        action={!query && activeFilter !== "shared" && (
                            <button className="primary-button" type="button" onClick={handleCreateFirstNote}>
                                {activeFilter === "owned" ? "Create owned note" : "Create first note"}
                            </button>
                        )}
                    />
                ) : (
                    <div className="notes-list" role="list">
                        {filteredNotes.map((note) => {
                            const noteId = note._id || note.id
                            const isOwned = isOwnedNote(note)

                            return (
                                <button
                                    className={`note-row ${selectedNoteId === noteId ? "selected" : ""}`}
                                    type="button"
                                    role="listitem"
                                    key={noteId}
                                    onClick={() => {
                                        setSelectedNoteId(noteId)
                                        navigate(`/notes/${noteId}`)
                                    }}
                                >
                                    <span className="note-row-main">
                                        <strong>{note.title || "Untitled"}</strong>
                                        <small>{formatDateTime(note.updatedAt || note.createdAt)}</small>
                                    </span>
                                    <Badge tone={isOwned ? "success" : "info"}>
                                        {isOwned ? "Owned" : "Shared"}
                                    </Badge>
                                </button>
                            )
                        })}
                    </div>
                )}
            </section>
        </main>
    )
}

export default DashboardPage
