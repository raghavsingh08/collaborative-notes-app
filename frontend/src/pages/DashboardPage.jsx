import { useCallback, useEffect, useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { createNote, getNotes, getSharedUsers, deleteNote, removeSharedUser } from "../api/notes.api"
import { useAuth } from "../context/AuthContext"
import ShareNoteModal from "../components/notes/ShareNoteModal"
import { AvatarStack, Badge, CollaboratorAvatarGroup, EmptyState, ErrorState, LoadingRows } from "../components/ui/AppUI"
import { IconChevronDown, IconNote, IconPlus, IconSearch, IconUsers, IconMoreHorizontal } from "../components/ui/Icons"
import { Menu } from "lucide-react"
import UserMenu from "../components/ui/UserMenu"
import { formatDateTime, getInitials, getDisplayName } from "../components/ui/uiUtils"
import usePageTitle from "../hooks/usePageTitle"
import useWorkspacePresence from "../hooks/useWorkspacePresence"

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

const ActiveNotePresence = ({ users = [] }) => {
    if (users.length === 0) {
        return null
    }

    const firstUserName = users[0]?.name || users[0]?.username || users[0]?.email || "Someone"
    const label = users.length === 1 ? `${firstUserName} editing` : `${users.length} active`

    return (
        <div className="workspace-note-presence" title={label} aria-label={label}>
            <span className="workspace-live-dot" aria-hidden="true" />
            <span className="workspace-presence-label">{label}</span>
        </div>
    )
}

const renderStructuredPreview = (content) => {
    if (!content || !content.trim()) {
        return (
            <div className="mock-document-content empty-preview">
                <p>No content yet. Start writing...</p>
            </div>
        )
    }

    const lines = content.split('\n').filter(line => line.trim().length > 0).slice(0, 5)
    const elements = []
    let currentList = []
    
    const flushList = () => {
        if (currentList.length > 0) {
            elements.push(<ul key={`ul-${elements.length}`}>{currentList}</ul>)
            currentList = []
        }
    }

    lines.forEach((line, index) => {
        if (line.startsWith('# ')) {
            flushList()
            elements.push(<h1 key={index}>{line.substring(2).trim()}</h1>)
        } else if (line.startsWith('## ')) {
            flushList()
            elements.push(<h2 key={index}>{line.substring(3).trim()}</h2>)
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
            currentList.push(<li key={index}>{line.substring(2).trim()}</li>)
        } else if (line.startsWith('- [ ] ') || line.startsWith('- [x] ')) {
            currentList.push(<li key={index} className="preview-checklist-item">{line.substring(6).trim()}</li>)
        } else {
            flushList()
            elements.push(<p key={index}>{line.trim()}</p>)
        }
    })
    flushList()

    return (
        <div className="mock-document-content">
            {elements}
            {content.split('\n').filter(l => l.trim().length > 0).length > 5 && (
                <p className="preview-ellipsis">...</p>
            )}
        </div>
    )
}

const DashboardPage = () => {
    usePageTitle("Dashboard")
    const navigate = useNavigate()
    const { user } = useAuth()
    const presenceByNoteId = useWorkspacePresence()
    const [notes, setNotes] = useState([])
    const [noteCollaborators, setNoteCollaborators] = useState({})
    const [collaborationNote, setCollaborationNote] = useState(null)
    const [title, setTitle] = useState("")
    const [query, setQuery] = useState("")
    const [activeFilter, setActiveFilter] = useState("all")
    const [selectedNoteId, setSelectedNoteId] = useState(null)
    const [activeDropdownNoteId, setActiveDropdownNoteId] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState("")
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
    const dropdownRef = useRef(null)

    useEffect(() => {
        if (!activeDropdownNoteId) return undefined

        const handlePointerDown = (event) => {
            if (!dropdownRef.current?.contains(event.target)) {
                setActiveDropdownNoteId(null)
            }
        }

        const handleKeyDown = (event) => {
            if (event.key === "Escape") setActiveDropdownNoteId(null)
        }

        document.addEventListener("pointerdown", handlePointerDown)
        document.addEventListener("keydown", handleKeyDown)

        return () => {
            document.removeEventListener("pointerdown", handlePointerDown)
            document.removeEventListener("keydown", handleKeyDown)
        }
    }, [activeDropdownNoteId])

    // Derived state for validation
    const trimmedTitle = title.trim()
    const isTitleValid = trimmedTitle.length >= 2
    const showTitleError = title.length > 0 && !isTitleValid

    const isOwnedNote = useCallback((note) => {
        return getId(note.owner || note.ownerId || note.createdBy) === getId(user)
    }, [user])

    const loadOwnedCollaborators = useCallback(async (nextNotes) => {
        const ownedNotesWithShares = nextNotes.filter((note) => {
            const sharedWith = note?.sharedWith || []
            return isOwnedNote(note) && Array.isArray(sharedWith) && sharedWith.length > 0
        })

        if (ownedNotesWithShares.length === 0) return

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

        setNoteCollaborators((current) => ({
            ...current,
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
        if (isTitleValid) {
            await createNoteFromTitle(trimmedTitle)
        }
    }

    const createNoteFromTitle = async (nextTitle) => {
        const titleToCreate = nextTitle.trim()
        if (titleToCreate.length < 2) return

        try {
            const response = await createNote({ title: titleToCreate })
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
        createNoteFromTitle("Untitled document")
    }

    const getCollaboratorsForNote = (note) => {
        const noteId = note._id || note.id
        return noteCollaborators[noteId] || getCollaboratorsFromNote(note)
    }

    const getActiveUsersForNote = (note) => {
        return presenceByNoteId[String(note._id || note.id)] || []
    }

    const filteredByOwnership = notes.filter((note) => {
        if (activeFilter === "owned") return isOwnedNote(note)
        if (activeFilter === "shared") return !isOwnedNote(note)
        return true
    })

    const filteredNotes = filteredByOwnership.filter((note) => {
        const noteTitle = note.title || "Untitled document"
        return noteTitle.toLowerCase().includes(query.trim().toLowerCase())
    })

    const sortedFilteredNotes = [...filteredNotes].sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt || 0)
        const dateB = new Date(b.updatedAt || b.createdAt || 0)
        return dateB - dateA
    })

    const showRecent = !query && (activeFilter === "all" || activeFilter === "owned") && sortedFilteredNotes.length > 0
    const recentNotes = showRecent ? sortedFilteredNotes.slice(0, 3) : []
    const listNotes = showRecent ? sortedFilteredNotes.slice(3) : sortedFilteredNotes

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
            {/* ── Mobile Top Header (hidden on desktop) ── */}
            <header className="mobile-top-header">
                <h1>{displayName}'s Workspace</h1>
                <button className="mobile-menu-btn" onClick={() => setIsMobileNavOpen(true)} aria-label="Open menu">
                    <Menu size={20} />
                </button>
            </header>

            {/* ── Mobile Backdrop ── */}
            <div 
                className={`mobile-backdrop ${isMobileNavOpen ? 'visible' : ''}`} 
                onClick={() => setIsMobileNavOpen(false)}
                aria-hidden="true"
            />

            {/* ── Sidebar ── */}
            <aside className={`sidebar ${isMobileNavOpen ? 'mobile-open' : ''}`}>
                <div className="sidebar-workspace">
                    <UserMenu />
                    <div className="sidebar-workspace-info">
                        <span className="sidebar-workspace-name">
                            {displayName}'s Workspace
                            <IconChevronDown size={14} />
                        </span>
                        <span className="sidebar-workspace-plan">Free Plan</span>
                    </div>
                </div>

                <div className="sidebar-new-action">
                    <button 
                        className="new-document-button" 
                        onClick={() => { handleCreateFirstNote(); setIsMobileNavOpen(false); }}
                    >
                        <span className="new-document-icon">
                            <IconPlus size={16} />
                        </span>
                        <div className="new-document-text">
                            <strong>New Document</strong>
                            <span>Start writing or planning</span>
                        </div>
                    </button>
                </div>

                <nav className="sidebar-nav" aria-label="Workspace filters">
                    <button
                        className={`nav-item ${activeFilter === "all" ? "active" : ""}`}
                        type="button"
                        onClick={() => { setActiveFilter("all"); setIsMobileNavOpen(false); }}
                    >
                        <span className="nav-item-inner">
                            <IconNote size={14} />
                            All notes
                        </span>
                        <span className="nav-item-count">{notes.length}</span>
                    </button>
                    <button
                        className={`nav-item ${activeFilter === "owned" ? "active" : ""}`}
                        type="button"
                        onClick={() => { setActiveFilter("owned"); setIsMobileNavOpen(false); }}
                    >
                        <span className="nav-item-inner">
                            <IconNote size={14} />
                            Owned
                        </span>
                        <span className="nav-item-count">{ownedCount}</span>
                    </button>
                    <button
                        className={`nav-item ${activeFilter === "shared" ? "active" : ""}`}
                        type="button"
                        onClick={() => { setActiveFilter("shared"); setIsMobileNavOpen(false); }}
                    >
                        <span className="nav-item-inner">
                            <IconUsers size={14} />
                            Shared with me
                        </span>
                        <span className="nav-item-count">{sharedCount}</span>
                    </button>
                </nav>
            </aside>

            {/* ── Dashboard content ── */}
            <section className="dashboard-panel" aria-labelledby="dashboard-title">
                <header className="dashboard-header">
                    <div className="dashboard-header-titles">
                        <h2 id="dashboard-title">
                            {activeFilter === "all" ? "All Documents" : activeFilter === "owned" ? "Owned by You" : "Shared with You"}
                        </h2>
                        <span className="dashboard-header-subtitle">
                            {activeFilter === "all" ? "Manage your notes, shared work, and collaboration." : `${filteredNotes.length} documents`}
                        </span>
                    </div>
                    <label className="dashboard-search" htmlFor="search-notes">
                        <IconSearch size={14} className="dashboard-search-icon" />
                        <input
                            id="search-notes"
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search documents..."
                            aria-label="Search notes"
                        />
                    </label>
                </header>

                <ErrorState message={error} />

                {isLoading ? (
                    <LoadingRows count={6} />
                ) : filteredNotes.length === 0 ? (
                    <EmptyState
                        title={query ? "No notes found" : filterEmptyTitle}
                        description={
                            query
                                ? "Try another search or clear the search field."
                                : filterEmptyDescription
                        }
                        icon={!query && activeFilter === "shared" ? "users" : "note"}
                        action={
                            !query && activeFilter !== "shared" && (
                                <button
                                    className="primary-button"
                                    type="button"
                                    onClick={handleCreateFirstNote}
                                >
                                    <IconPlus size={14} />
                                    {activeFilter === "owned" ? "Create owned note" : "Create first note"}
                                </button>
                            )
                        }
                    />
                ) : (
                    <div className="dashboard-content-scroll">
                        {showRecent && recentNotes.length > 0 && (
                            <div className="dashboard-section recent-work-section">
                                <h3 className="dashboard-section-title">Continue Working</h3>
                                <div className="editorial-grid">
                                    {/* Primary Featured Card (2/3 width) */}
                                    {(() => {
                                        const featuredNote = recentNotes[0]
                                        const noteId = featuredNote._id || featuredNote.id
                                        const isOwned = isOwnedNote(featuredNote)
                                        const collaborators = getCollaboratorsForNote(featuredNote)
                                        const activeUsers = getActiveUsersForNote(featuredNote)

                                        return (
                                            <div
                                                className={`featured-card ${selectedNoteId === noteId ? "selected" : ""}`}
                                                role="button"
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
                                                <div className="featured-card-body">
                                                    <h3 className="featured-card-title" style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: '600', color: 'var(--text)' }}>
                                                        {featuredNote.title || "Untitled document"}
                                                    </h3>
                                                    <div className="featured-card-preview">
                                                        {renderStructuredPreview(featuredNote.content)}
                                                    </div>
                                                </div>
                                                <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid var(--border)' }} />
                                                <div className="featured-card-header" style={{ marginBottom: '12px' }}>
                                                    <div className="featured-card-meta-top">
                                                        <IconNote size={16} className="subtle-icon" />
                                                        <span className="featured-card-time">Edited {formatDateTime(featuredNote.updatedAt || featuredNote.createdAt)}</span>
                                                    </div>
                                                    {!isOwned && (
                                                        <div className="note-status-shared">
                                                            <span className="note-status-dot"></span> Shared
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="featured-card-footer">
                                                    <div className="featured-card-collaborators-wrap">
                                                        {collaborators.length > 0 && (
                                                            <CollaboratorAvatarGroup
                                                                users={collaborators}
                                                                owner={featuredNote.owner || featuredNote.ownerId || featuredNote.createdBy}
                                                                currentUser={user}
                                                                onClick={(event) => {
                                                                    event.stopPropagation()
                                                                    setCollaborationNote(featuredNote)
                                                                }}
                                                                label={`Manage collaborators for ${featuredNote.title || "Untitled document"}`}
                                                            />
                                                        )}
                                                        {activeUsers.length > 0 && (
                                                            <ActiveNotePresence users={activeUsers} />
                                                        )}
                                                    </div>
                                                    <span className="continue-editing-action">Continue Editing &rarr;</span>
                                                </div>
                                            </div>
                                        )
                                    })()}

                                    {/* Stacked Secondary Cards (1/3 width) */}
                                    {recentNotes.length > 1 && (
                                        <div className="stacked-cards">
                                            {recentNotes.slice(1).map((note) => {
                                                const noteId = note._id || note.id
                                                const isOwned = isOwnedNote(note)
                                                const collaborators = getCollaboratorsForNote(note)
                                                const activeUsers = getActiveUsersForNote(note)
                                                
                                                const realPreview = note.content 
                                                    ? note.content.substring(0, 50).replace(/[#*`_]/g, '')
                                                    : "No content yet. Start writing..."

                                                return (
                                                    <div
                                                        className={`compact-card ${selectedNoteId === noteId ? "selected" : ""}`}
                                                        role="button"
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
                                                        <div className="compact-card-main">
                                                            <div className="compact-card-info">
                                                                <strong className="compact-card-title">{note.title || "Untitled document"}</strong>
                                                                <span className="compact-card-preview">{realPreview}</span>
                                                                <span className="compact-card-time">Edited {formatDateTime(note.updatedAt || note.createdAt)}</span>
                                                            </div>
                                                        </div>
                                                        <div className="compact-card-meta">
                                                            <div className="compact-card-collaborators-wrap">
                                                                {collaborators.length > 0 && (
                                                                    <CollaboratorAvatarGroup
                                                                        users={collaborators.slice(0, 2)}
                                                                        owner={note.owner || note.ownerId || note.createdBy}
                                                                        currentUser={user}
                                                                        onClick={(event) => {
                                                                            event.stopPropagation()
                                                                            setCollaborationNote(note)
                                                                        }}
                                                                    />
                                                                )}
                                                                {activeUsers.length > 0 && (
                                                                    <ActiveNotePresence users={activeUsers} />
                                                                )}
                                                            </div>
                                                            <span className="continue-editing-action compact">Continue &rarr;</span>
                                                            {!isOwned && (
                                                                <div className="note-status-shared">
                                                                    <span className="note-status-dot"></span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {listNotes.length > 0 && (
                            <div className="dashboard-section">
                                {showRecent && <h3 className="dashboard-section-title">All Notes</h3>}
                                <div className="notes-list" role="list">
                                    {listNotes.map((note) => {
                                        const noteId = note._id || note.id
                                        const isOwned = isOwnedNote(note)
                                        const collaborators = getCollaboratorsForNote(note)
                                        const activeUsers = getActiveUsersForNote(note)
                                        
                                        // Real preview for the richer layout
                                        const previewText = note.content || "No content yet. Start writing..."
                                            
                                        const isSharedView = activeFilter === "shared"
                                        const rowClassName = `note-row ${selectedNoteId === noteId ? "selected" : ""} ${isSharedView ? "shared-note-row" : ""}`
                                            
                                        return (
                                            <div
                                                className={rowClassName}
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
                                                <div className="note-row-icon">
                                                    <IconNote size={18} />
                                                </div>
                                                <div className="note-row-main">
                                                    <div className="note-row-title-wrap">
                                                        <span className="note-row-title">{note.title || "Untitled document"}</span>
                                                        {isSharedView && (note.unread || note.unreadCount > 0) && (
                                                            <span className="shared-note-unread">{note.unreadCount || 1} unread</span>
                                                        )}
                                                    </div>
                                                    <span className="note-row-preview">{previewText}</span>
                                                </div>
                                                <div className="note-row-meta">
                                                    {isSharedView ? (
                                                        <div className="shared-note-meta-content">
                                                            <div className="shared-note-text-block">
                                                                <div className="shared-note-timestamp">
                                                                    Edited {formatDateTime(note.updatedAt || note.createdAt)}
                                                                </div>
                                                                <div className="shared-note-owner-row">
                                                                    <span className="shared-owner-label">Owner • {getDisplayName(note.owner || note.ownerId || note.createdBy || "Owner")}</span>
                                                                    {note.permission && (
                                                                        <span className="shared-note-permission">{note.permission}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="shared-note-avatars">
                                                                {collaborators.length > 0 && (
                                                                    <CollaboratorAvatarGroup
                                                                        users={collaborators}
                                                                        owner={note.owner || note.ownerId || note.createdBy}
                                                                        currentUser={user}
                                                                        onClick={(event) => {
                                                                            event.stopPropagation()
                                                                            setCollaborationNote(note)
                                                                        }}
                                                                    />
                                                                )}
                                                                {activeUsers.length > 0 && (
                                                                    <ActiveNotePresence users={activeUsers} />
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <span className="note-row-time">Edited {formatDateTime(note.updatedAt || note.createdAt)}</span>
                                                            <div className="note-row-collaborators">
                                                                {collaborators.length > 0 && (
                                                                    <CollaboratorAvatarGroup
                                                                        users={collaborators}
                                                                        owner={note.owner || note.ownerId || note.createdBy}
                                                                        currentUser={user}
                                                                        onClick={(event) => {
                                                                            event.stopPropagation()
                                                                            setCollaborationNote(note)
                                                                        }}
                                                                        label={`Manage collaborators for ${note.title || "Untitled document"}`}
                                                                    />
                                                                )}
                                                                {activeUsers.length > 0 && (
                                                                    <ActiveNotePresence users={activeUsers} />
                                                                )}
                                                            </div>
                                                            {!isOwned && (
                                                                <div className="note-status-shared">
                                                                    <span className="note-status-dot"></span> Shared
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                                <div className="note-row-actions">
                                                    <button 
                                                        className="row-action-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setSelectedNoteId(noteId)
                                                            navigate(`/notes/${noteId}`)
                                                        }}
                                                    >
                                                        Open
                                                    </button>
                                                    {isOwned && (
                                                        <button 
                                                            className="row-action-btn"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setCollaborationNote(note)
                                                            }}
                                                        >
                                                            Share
                                                        </button>
                                                    )}
                                                    
                                                    <div className="dropdown-container">
                                                        <button 
                                                            className="row-action-icon-btn"
                                                            aria-label="More options"
                                                            aria-haspopup="menu"
                                                            aria-expanded={activeDropdownNoteId === noteId}
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setActiveDropdownNoteId(activeDropdownNoteId === noteId ? null : noteId)
                                                            }}
                                                        >
                                                            <IconMoreHorizontal size={16} />
                                                        </button>
                                                        
                                                        {activeDropdownNoteId === noteId && (
                                                            <div className="more-dropdown-menu" role="menu" ref={dropdownRef} onClick={(e) => e.stopPropagation()}>
                                                                {isOwned ? (
                                                                    <>
                                                                        <div className="dropdown-group">
                                                                            <div className="dropdown-group-label">Available</div>
                                                                            <button className="dropdown-item" disabled title="Coming soon">Rename</button>
                                                                            <button className="dropdown-item" disabled title="Coming soon">Duplicate</button>
                                                                            <button className="dropdown-item" disabled title="Coming soon">Version History</button>
                                                                            <button className="dropdown-item" disabled title="Coming soon">Export</button>
                                                                        </div>
                                                                        <div className="dropdown-divider"></div>
                                                                        <div className="dropdown-group">
                                                                            <div className="dropdown-group-label">Coming Soon</div>
                                                                            <button className="dropdown-item" disabled>Move</button>
                                                                            <button className="dropdown-item" disabled>Pin</button>
                                                                            <button className="dropdown-item" disabled>Archive</button>
                                                                        </div>
                                                                        <div className="dropdown-divider"></div>
                                                                        <div className="dropdown-group">
                                                                            <div className="dropdown-group-label danger">Danger Zone</div>
                                                                            <button 
                                                                                className="dropdown-item danger" 
                                                                                onClick={() => {
                                                                                    deleteNote(noteId).then(() => fetchNotes())
                                                                                    setActiveDropdownNoteId(null)
                                                                                }}
                                                                            >
                                                                                Delete
                                                                            </button>
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <button 
                                                                            className="dropdown-item" 
                                                                            onClick={() => {
                                                                                navigator.clipboard.writeText(window.location.origin + "/notes/" + noteId)
                                                                                setActiveDropdownNoteId(null)
                                                                            }}
                                                                        >
                                                                            Copy Link
                                                                        </button>
                                                                        <button className="dropdown-item" disabled title="Coming soon">Version History</button>
                                                                        <button className="dropdown-item" disabled title="Coming soon">Activity Timeline</button>
                                                                        <div className="dropdown-divider"></div>
                                                                        <button 
                                                                            className="dropdown-item danger" 
                                                                            onClick={() => {
                                                                                removeSharedUser(noteId, user.id || user._id).then(() => fetchNotes())
                                                                                setActiveDropdownNoteId(null)
                                                                            }}
                                                                        >
                                                                            Leave Shared Note
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
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
