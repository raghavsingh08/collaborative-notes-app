import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { createNote, getNotes, getSharedUsers } from "../api/notes.api"
import { useAuth } from "../context/AuthContext"
import ShareNoteModal from "../components/notes/ShareNoteModal"
import { Badge, CollaboratorAvatarGroup, EmptyState, ErrorState, LoadingRows } from "../components/ui/AppUI"
import UserMenu from "../components/ui/UserMenu"
import { formatDateTime } from "../components/ui/uiUtils"

const getNotesFromResponse = (response) => {
    return response?.data?.notes || response?.data?.data?.notes || response?.data?.data || response?.data || []
}

const getSharedUsersFromResponse = (response) => {
    return response?.data?.users || response?.data?.data?.users || response?.data?.data || response?.data || []
}

const getId = (value) => {
    return value?._id || value?.id || value
}

const getCollaboratorsFromNote = (note) => {
    const collaborators = note?.sharedWith || note?.collaborators || note?.sharedUsers || []

    return Array.isArray(collaborators)
        ? collaborators.filter((collaborator) => collaborator && typeof collaborator === "object")
        : []
}

const DashboardPage = () => {
    const navigate = useNavigate()
    const { user } = useAuth()
    const [notes, setNotes] = useState([])
    const [noteCollaborators, setNoteCollaborators] = useState({})
    const [collaborationNote, setCollaborationNote] = useState(null)
    const [title, setTitle] = useState("")
    const [query, setQuery] = useState("")
    const [activeFilter, setActiveFilter] = useState("all")
    const [selectedNoteId, setSelectedNoteId] = useState("")
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState("")

    const isOwnedNote = useCallback((note) => {
        return getId(note.owner || note.ownerId || note.createdBy) === getId(user)
    }, [user])

    const loadOwnedCollaborators = useCallback(async (nextNotes) => {
        const ownedNotesWithShares = nextNotes.filter((note) => {
            const sharedWith = note?.sharedWith || []
            return isOwnedNote(note) && Array.isArray(sharedWith) && sharedWith.length > 0
        })

        if (ownedNotesWithShares.length === 0) {
            return
        }

        const collaboratorEntries = await Promise.all(
            ownedNotesWithShares.map(async (note) => {
                const noteId = note._id || note.id

                try {
                    const response = await getSharedUsers(noteId)
                    return [noteId, getSharedUsersFromResponse(response)]
                } catch {
                    return [noteId, getCollaboratorsFromNote(note)]
                }
            })
        )

        setNoteCollaborators((currentCollaborators) => ({
            ...currentCollaborators,
            ...Object.fromEntries(collaboratorEntries)
        }))
    }, [isOwnedNote])

    const fetchNotes = useCallback(async () => {
        setIsLoading(true)
        setError("")

        try {
            const response = await getNotes()
            const fetchedNotes = getNotesFromResponse(response)

            setNotes(fetchedNotes)
            await loadOwnedCollaborators(fetchedNotes)
        } catch {
            setError("Unable to load notes.")
        } finally {
            setIsLoading(false)
        }
    }, [loadOwnedCollaborators])

    useEffect(() => {
        fetchNotes()
    }, [fetchNotes])

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

    const getCollaboratorsForNote = (note) => {
        const noteId = note._id || note.id
        const collaborators = noteCollaborators[noteId] || getCollaboratorsFromNote(note)
        const sharedWith = note?.sharedWith || []

        if (
            collaborators.length === 0 &&
            Array.isArray(sharedWith) &&
            sharedWith.some((collaborator) => getId(collaborator) === getId(user))
        ) {
            return [user]
        }

        return collaborators
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
            ? "No shared notes yet"
            : "Start your first note"

    const filterEmptyDescription = activeFilter === "owned"
        ? "Notes you create will appear here."
        : activeFilter === "shared"
            ? "When someone shares a note with you, it will appear here."
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
                        icon={!query && activeFilter === "shared" ? null : undefined}
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
                            const collaborators = getCollaboratorsForNote(note)

                            return (
                                <div
                                    className={`note-row ${selectedNoteId === noteId ? "selected" : ""}`}
                                    role="listitem"
                                    tabIndex={0}
                                    key={noteId}
                                    onClick={() => {
                                        setSelectedNoteId(noteId)
                                        navigate(`/notes/${noteId}`)
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault()
                                            setSelectedNoteId(noteId)
                                            navigate(`/notes/${noteId}`)
                                        }
                                    }}
                                >
                                    <span className="note-row-main">
                                        <strong>{note.title || "Untitled"}</strong>
                                        <small>{formatDateTime(note.updatedAt || note.createdAt)}</small>
                                    </span>
                                    <span className="note-row-meta">
                                        <CollaboratorAvatarGroup
                                            users={collaborators}
                                            onClick={(event) => {
                                                event.stopPropagation()
                                                setCollaborationNote(note)
                                            }}
                                            label={`Manage collaborators for ${note.title || "Untitled"}`}
                                        />
                                        <Badge tone={isOwned ? "success" : "info"}>
                                            {isOwned ? "Owned" : "Shared"}
                                        </Badge>
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                )}
            </section>

            {collaborationNote && (
                <ShareNoteModal
                    noteId={collaborationNote._id || collaborationNote.id}
                    owner={collaborationNote.owner || collaborationNote.ownerId || collaborationNote.createdBy}
                    currentUser={user}
                    fallbackCollaborators={getCollaboratorsForNote(collaborationNote)}
                    onClose={async () => {
                        setCollaborationNote(null)
                        await fetchNotes()
                    }}
                />
            )}
        </main>
    )
}

export default DashboardPage
