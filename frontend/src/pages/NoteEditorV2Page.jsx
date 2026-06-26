import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { deleteNote, getNoteById, updateNote } from "../api/notes.api"
import ShareNoteModal from "../components/notes/ShareNoteModal"
import { EmptyState, ErrorState, LoadingRows } from "../components/ui/AppUI"
import {
    IconArrowLeft,
    IconClose,
    IconMoreHorizontal,
    IconSave,
    IconSettings,
    IconTrash,
    IconUsers,
} from "../components/ui/Icons"
import { useAuth } from "../context/AuthContext"
import socket from "../api/socket"
import useNoteSocketV2 from "../hooks/useNoteSocketV2"
import usePageTitle from "../hooks/usePageTitle"
import TipTapEditor from '../components/editor/TipTapEditor'
import { CollaborationProvider, useCollaboration } from "../collaboration/CollaborationProvider"
import CommentsSidebar from "../components/comments/CommentsSidebar"
import VersionHistoryPanel from "../components/versions/VersionHistoryPanel"
import { History } from "lucide-react"

const CollaborativeTipTap = ({ initialContent, initialContentJson, hasLoaded, onUpdate, editorRef, onSelectionChange, onCommentClicked }) => {
    const { ydoc, awareness, syncStatus } = useCollaboration()
    
    // Key the editor by the unique Y.Doc GUID to force a complete React unmount/remount 
    // whenever the collaboration session changes. TipTap extensions are not dynamic, 
    // so reusing the same component with a new Y.Doc results in a permanently stale editor.
    return (
        <TipTapEditor
            key={ydoc?.guid || 'editor'}
            ref={editorRef}
            ydoc={ydoc}
            awareness={awareness}
            initialContent={initialContent}
            initialContentJson={initialContentJson}
            hasLoaded={hasLoaded}
            onUpdate={onUpdate}
            syncStatus={syncStatus}
            onSelectionChange={onSelectionChange}
            onCommentClicked={onCommentClicked}
        />
    )
}

const getNoteFromResponse = (response) => {
    return response?.data?.note || response?.data?.data?.note || response?.data?.data || response?.data
}

const saveStatusClassMap = {
    "Saved": "saved",
    "Saving...": "saving",
    "Unsaved changes": "unsaved-changes",
    "Save failed": "save-failed"
}

const getId = (user) => user?._id || user?.id || user

const deduplicateUsers = (users = []) => {
    const seen = new Set()
    return users.filter((user) => {
        const rawId = getId(user)
        const id = rawId ? String(rawId) : JSON.stringify(user)
        if (!id || seen.has(id)) return false
        seen.add(id)
        return true
    })
}

const SyncStatusBadge = ({ isConnected, isReconnecting }) => {
    const { syncStatus } = useCollaboration()

    let statusText = "Disconnected"
    let statusClass = "save-failed" // red

    if (isReconnecting) {
        statusText = "Reconnecting..."
        statusClass = "unsaved-changes" // amber
    } else if (isConnected) {
        if (!syncStatus?.isComplete) {
            statusText = "Syncing..."
            statusClass = "saving" // blue/accent
        } else {
            statusText = "Connected"
            statusClass = "saved" // green
        }
    }

    return (
        <span className={`save-indicator save-${statusClass}`} aria-live="polite">
            {statusText}
        </span>
    )
}

const getUserIdStr = (u) => {
    if (!u) return ""
    return String(u._id || u.id || u.userId || "")
}

const getAwarenessUser = (state) => {
    if (!state) return null
    if (state.user?.user) return state.user.user
    if (state.user) return state.user
    if (state.userId || state.name) return state
    return null
}

const getAwarenessDisplayName = (user) => {
    return user?.name || user?.username || user?.email || "Anonymous"
}

const getAwarenessInitials = (user) => {
    return getAwarenessDisplayName(user)
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "A"
}

const ActiveCollaboratorsStack = ({ currentUser, currentUserId }) => {
    const { awareness, ydoc } = useCollaboration() || {}
    const [, setAwarenessVersion] = useState(0)

    useEffect(() => {
        if (!awareness) return

        const triggerRender = () => setAwarenessVersion((version) => version + 1)
        
        // Listen to both just to be absolutely certain we catch the state mutation
        awareness.on("update", triggerRender)
        awareness.on("change", triggerRender)
        
        return () => {
            awareness.off("update", triggerRender)
            awareness.off("change", triggerRender)
        }
    }, [awareness])

    const collaborators = (() => {
        const currentUserAvatar = {
            ...currentUser,
            clientId: String(ydoc?.clientID || "current"),
            resolvedId: String(currentUserId || "current"),
            name: currentUser?.name || currentUser?.username || currentUser?.email || "You",
            color: "var(--accent)"
        }

        const rawUsers = []
        const statesMap = awareness?.getStates()

        statesMap?.forEach((state, clientId) => {
            const awarenessUser = getAwarenessUser(state)
            if (awarenessUser) {
                rawUsers.push({
                    ...awarenessUser,
                    clientId: String(clientId),
                    name: getAwarenessDisplayName(awarenessUser)
                })
            }
        })

        const seenUserIds = new Set()
        const uniqueRemoteUsers = []

        // Mark the current user as seen so we don't duplicate them if their awareness state arrives
        seenUserIds.add(String(currentUserId || "current"))

        rawUsers.forEach(u => {
            // Exclude our own CRDT state explicitly just in case the ID match fails
            if (u.clientId === String(ydoc?.clientID)) return

            const normalizedId = String(u.userId || u._id || u.id || `fallback-client-${u.clientId}`)
            
            if (!seenUserIds.has(normalizedId)) {
                seenUserIds.add(normalizedId)
                uniqueRemoteUsers.push({
                    ...u,
                    resolvedId: normalizedId
                })
            }
        })

        uniqueRemoteUsers.sort((a, b) => a.name.localeCompare(b.name))
        const finalUsers = [currentUserAvatar, ...uniqueRemoteUsers]
        
        return finalUsers
    })()

    const maxVisible = 4
    const visible = collaborators.slice(0, maxVisible)
    const extra = collaborators.length - maxVisible

    return (
        <div className="active-collaborators-stack" style={{ display: 'flex', alignItems: 'center', marginLeft: '12px' }} aria-label="Active collaborators">
            {visible.map((user, idx) => {
                const initials = getAwarenessInitials(user)
                const isMe = user.resolvedId === (currentUserId || "current")
                return (
                    <div 
                        key={user.resolvedId || idx}
                        title={isMe ? `${getAwarenessDisplayName(user)} (You)` : getAwarenessDisplayName(user)}
                        style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: user.color || '#ccc',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '10px',
                            fontWeight: '600',
                            border: isMe ? '2px solid var(--accent, #3b82f6)' : '2px solid var(--bg-color, #ffffff)',
                            marginLeft: idx === 0 ? '0' : '-6px',
                            cursor: 'default',
                            position: 'relative',
                            zIndex: 10 - idx,
                            boxShadow: '0 0 0 1px rgba(0,0,0,0.05)'
                        }}
                    >
                        {initials}
                    </div>
                )
            })}
            {extra > 0 && (
                <div 
                    title={`${extra} more collaborator${extra > 1 ? 's' : ''}`}
                    style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--muted-bg, #f3f4f6)',
                        color: 'var(--muted-strong, #4b5563)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        fontWeight: '600',
                        border: '2px solid var(--bg-color, #ffffff)',
                        marginLeft: '-6px',
                        position: 'relative',
                        zIndex: 0,
                        boxShadow: '0 0 0 1px rgba(0,0,0,0.05)'
                    }}
                >
                    +{extra}
                </div>
            )}
        </div>
    )
}

const NoteEditorV2Page = () => {
    const { noteId } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const [title, setTitle] = useState("")
    const [content, setContent] = useState("")
    const [contentJson, setContentJson] = useState(null)
    const [lastActivity, setLastActivity] = useState(0)
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
    
    // Step 17D Integration State
    const [activeThreadId, setActiveThreadId] = useState(null)
    const [editorSelection, setEditorSelection] = useState(null)
    const editorRef = useRef(null)

    // Step 18 Integration State
    const [isHistoryOpen, setIsHistoryOpen] = useState(false)
    const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0)

    const hasLoadedNote = useRef(false)
    const editorMoreRef = useRef(null)
    const latestPayloadRef = useRef({ content: "", contentJson: null })

    const currentUserId = getUserIdStr(user)
    const ownerId = getUserIdStr(noteOwner)
    const isOwner = Boolean(currentUserId && ownerId && currentUserId === ownerId)

    usePageTitle(title || "Editor")

    const { socketError, isConnected, isReconnecting } = useNoteSocketV2(noteId)

    const sortedActiveUsers = []
    const uniqueTypingUsers = []
    const uniqueCollaborators = useMemo(() => deduplicateUsers(noteCollaborators), [noteCollaborators])

    useEffect(() => {
        const fetchNote = async () => {
            setIsLoading(true)
            setError("")

            try {
                const response = await getNoteById(noteId)
                const note = getNoteFromResponse(response)

                setTitle(note?.title || "")
                setContent(note?.content || "")
                setContentJson(note?.contentJson || null)
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
        const handleNoteRestored = (payload) => {
            if (String(payload?.noteId) !== String(noteId)) return

            setTimeout(() => {
                window.location.reload()
            }, 100)
        }

        socket.on("note:restored", handleNoteRestored)

        return () => {
            socket.off("note:restored", handleNoteRestored)
        }
    }, [noteId])



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
        setLastActivity(Date.now())
    }

    const titleRef = useRef(title)
    useEffect(() => {
        titleRef.current = title
    }, [title])



    useEffect(() => {
        if (hasLoadedNote.current) {
            latestPayloadRef.current = { content, contentJson }
        }
    }, [content, contentJson])

    const handleSave = useCallback(async (saveType = "manual") => {
        if (!hasLoadedNote.current) return

        setIsSaving(true)
        setSaveStatus("Saving...")
        setError("")

        try {
            const currentPlainText = latestPayloadRef.current.content
            const currentJson = latestPayloadRef.current.contentJson

            await updateNote(noteId, {
                title,
                content: currentPlainText,
                contentJson: currentJson,
                editorVersion: "v2",
                saveType
            })
            setSaveStatus("Saved")
            if (saveType === "manual") {
                setHistoryRefreshTrigger(Date.now())
            }
        } catch {
            setError("Unable to save note.")
            setSaveStatus("Save failed")
        } finally {
            setIsSaving(false)
        }
    }, [noteId, title])

    useEffect(() => {
        if (!hasLoadedNote.current || saveStatus !== "Unsaved changes") return undefined

        const saveTimer = setTimeout(() => {
            handleSave("autosave")
        }, 1000)

        return () => clearTimeout(saveTimer)
    }, [saveStatus, lastActivity, handleSave])

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
        <CollaborationProvider noteId={noteId} currentUser={user}>
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

                        <SyncStatusBadge isConnected={isConnected} isReconnecting={isReconnecting} />

                        <span
                            className={`save-indicator save-${saveStatusClassMap[saveStatus]}`}
                            aria-live="polite"
                        >
                            {saveStatus === "Unsaved changes" ? "Unsaved" : saveStatus}
                        </span>

                        <ActiveCollaboratorsStack currentUser={user} currentUserId={currentUserId} />
                    </div>

                    <div className="editor-toolbar-status">
                        {/* Status area cleared in favor of ActiveCollaboratorsStack in the left toolbar */}
                    </div>

                    <div className="editor-toolbar-actions">
                        <button
                            className="ghost-button collaboration-entry-button"
                            type="button"
                            onClick={() => setIsHistoryOpen(true)}
                        >
                            <History size={15} />
                            <span className="desktop-label">History</span>
                        </button>
                        
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
                            onClick={() => handleSave("manual")}
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

                        <CollaborativeTipTap
                            initialContent={content}
                            initialContentJson={contentJson}
                            hasLoaded={hasLoadedNote.current}
                            editorRef={editorRef}
                            onSelectionChange={setEditorSelection}
                            onCommentClicked={(anchorId) => setActiveThreadId(anchorId)}
                            onUpdate={(payload) => {
                                if (hasLoadedNote.current) {
                                    latestPayloadRef.current = payload
                                    setSaveStatus("Unsaved changes")
                                    setLastActivity(Date.now())
                                }
                            }}
                        />
                    </section>

                    {!isHistoryOpen && (
                        <CommentsSidebar 
                            noteId={noteId} 
                            currentUser={user} 
                            noteOwner={noteOwner}
                            activeThreadId={activeThreadId}
                            setActiveThreadId={(id) => {
                                setActiveThreadId(id)
                                if (id && editorRef.current) {
                                    editorRef.current.scrollToComment(id)
                                }
                            }}
                            editorSelection={editorSelection}
                            onCommentCreated={(anchorId) => {
                                if (editorRef.current) {
                                    editorRef.current.setCommentMark(anchorId)
                                }
                            }}
                            onCommentDeleted={(anchorId) => {
                                if (editorRef.current) {
                                    editorRef.current.unsetCommentMark(anchorId)
                                }
                            }}
                        />
                    )}

                    {isHistoryOpen && (
                        <VersionHistoryPanel 
                            noteId={noteId}
                            refreshTrigger={historyRefreshTrigger} 
                            onClose={() => setIsHistoryOpen(false)} 
                        />
                    )}
                </div>

                {isShareOpen && (
                    <ShareNoteModal
                        noteId={noteId}
                        owner={noteOwner}
                        currentUser={user}
                        fallbackCollaborators={uniqueCollaborators}
                        activeUsers={sortedActiveUsers}
                        typingUsers={uniqueTypingUsers}
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
        </CollaborationProvider>
    )
}

export default NoteEditorV2Page
