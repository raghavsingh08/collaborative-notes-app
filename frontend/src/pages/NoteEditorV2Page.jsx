import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { deleteNote, getNoteById, updateNote } from "../api/notes.api"
import { getComments } from "../api/comments.api"
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
import ActivitySidebar from "../components/activity/ActivitySidebar"
import { History, Activity, MessageSquare } from "lucide-react"

const CollaborativeTipTap = ({ initialContent, initialContentJson, hasLoaded, onUpdate, editorRef, onEditorReady, onSelectionChange, onCommentClicked }) => {
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
            onEditorReady={onEditorReady}
            onSelectionChange={onSelectionChange}
            onCommentClicked={onCommentClicked}
        />
    )
}

const getNoteFromResponse = (response) => {
    return response?.data?.note || response?.data?.data?.note || response?.data?.data || response?.data
}

const getCompleteCommentThreads = (response) => (
    Array.isArray(response?.data) ? response.data : null
)

const getThreadAnchorIds = (threads) => new Set(
    threads
        .map((thread) => thread?.anchorId)
        .filter((anchorId) => typeof anchorId === "string" && anchorId.trim())
        .map((anchorId) => anchorId.trim())
)

const COMMENT_ANCHOR_VALIDITY_ACTIONS = new Set(["created", "thread_deleted"])

const saveStatusClassMap = {
    "Saved": "saved",
    "Saving...": "saving",
    "Unsaved changes": "unsaved-changes",
    "Save failed": "save-failed"
}

const TITLE_AUTOSAVE_DELAY_MS = 750
const CONTENT_AUTOSAVE_DELAY_MS = 1000
const MAX_CONTENT_RECOVERY_ATTEMPTS = 3

const getContentRecoveryDelay = (attempt) => {
    if (attempt <= 1) return 0

    const baseDelay = attempt === 2 ? 150 : 350
    const jitter = attempt === 2
        ? Math.floor(Math.random() * 51)
        : Math.floor(Math.random() * 151)

    return baseDelay + jitter
}

const normalizeTitle = (value = "") => String(value || "").trim()

const normalizeContentRevision = (value) => (
    Number.isInteger(value) && value >= 0 ? value : 0
)

const getContentRevisionConflict = (error) => {
    const response = error?.response?.data
    const currentContentRevision = response?.currentContentRevision

    if (
        error?.response?.status !== 409 ||
        response?.code !== "CONTENT_REVISION_CONFLICT" ||
        !Number.isInteger(currentContentRevision) ||
        currentContentRevision < 0
    ) {
        return null
    }

    return { currentContentRevision }
}

const stableSerialize = (value) => {
    if (value === undefined || value === null) return "null"
    if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`
    if (typeof value === "object") {
        return `{${Object.keys(value).sort().map((key) => (
            `${JSON.stringify(key)}:${stableSerialize(value[key])}`
        )).join(",")}}`
    }
    return JSON.stringify(value)
}

const serializeContentJson = (value) => {
    try {
        return stableSerialize(value ?? null)
    } catch {
        return ""
    }
}

const createContentSnapshot = ({ noteId, content = "", contentJson = null, saveType = "autosave", sequence = 0, generation = 0, title = "" }) => {
    const normalizedContent = String(content ?? "")
    const contentJsonKey = serializeContentJson(contentJson)

    return {
        noteId: String(noteId || ""),
        content: normalizedContent,
        contentJson: contentJson ?? null,
        contentKey: `${JSON.stringify(normalizedContent)}:${contentJsonKey}`,
        contentJsonSignature: contentJsonKey,
        saveType,
        sequence,
        generation,
        title
    }
}

const getCombinedSaveStatus = ({
    isTitleSaving,
    isContentSaving,
    isTitleError,
    isContentError,
    isTitleDirty,
    isContentDirty
}) => {
    if (isTitleSaving || isContentSaving) return "Saving..."
    if (isTitleError || isContentError) return "Save failed"
    if (isTitleDirty || isContentDirty) return "Unsaved changes"
    return "Saved"
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

const getAwarenessPresence = (state) => {
    const status = ["editing", "viewing", "idle"].includes(state?.presence?.status)
        ? state.presence.status
        : "viewing"

    return {
        status,
        lastActivity: state?.presence?.lastActivity || null
    }
}

const deriveActiveCollaborators = ({ awareness, currentUser, currentUserId, ydoc }) => {
    const localClientId = awareness?.clientID ?? ydoc?.clientID ?? "current"
    const localState = awareness?.getLocalState()
    const currentUserAvatar = {
        ...currentUser,
        clientId: String(localClientId),
        resolvedId: String(currentUserId || "current"),
        name: currentUser?.name || currentUser?.username || currentUser?.email || "You",
        color: "var(--accent)",
        presence: getAwarenessPresence(localState)
    }
    const remoteUsers = []

    awareness?.getStates().forEach((state, clientId) => {
        const awarenessUser = getAwarenessUser(state)

        if (!awarenessUser || String(clientId) === String(localClientId)) {
            return
        }

        remoteUsers.push({
            ...awarenessUser,
            clientId: String(clientId),
            name: getAwarenessDisplayName(awarenessUser),
            presence: getAwarenessPresence(state)
        })
    })

    const seenUserIds = new Set([String(currentUserId || "current")])
    const uniqueRemoteUsers = remoteUsers.reduce((users, remoteUser) => {
        const resolvedId = String(
            remoteUser.userId || remoteUser._id || remoteUser.id || `fallback-client-${remoteUser.clientId}`
        )

        if (seenUserIds.has(resolvedId)) {
            return users
        }

        seenUserIds.add(resolvedId)
        users.push({ ...remoteUser, resolvedId })
        return users
    }, [])

    uniqueRemoteUsers.sort((a, b) => a.name.localeCompare(b.name))
    return [currentUserAvatar, ...uniqueRemoteUsers]
}

const haveSameCollaborators = (current, next) => {
    return current.length === next.length && current.every((user, index) => {
        const nextUser = next[index]

        return user.resolvedId === nextUser.resolvedId
            && user.clientId === nextUser.clientId
            && user.name === nextUser.name
            && user.color === nextUser.color
            && user.presence?.status === nextUser.presence?.status
    })
}

const ActiveCollaboratorsStack = ({ currentUser, currentUserId, isConnected }) => {
    const { awareness, ydoc, syncStatus } = useCollaboration() || {}
    const [collaborators, setCollaborators] = useState(() => deriveActiveCollaborators({
        awareness,
        currentUser,
        currentUserId,
        ydoc
    }))

    const hydrateCollaborators = useCallback(() => {
        const nextCollaborators = deriveActiveCollaborators({
            awareness,
            currentUser,
            currentUserId,
            ydoc
        })

        setCollaborators((current) => (
            haveSameCollaborators(current, nextCollaborators) ? current : nextCollaborators
        ))
    }, [awareness, currentUser, currentUserId, ydoc])

    useEffect(() => {
        if (!awareness) {
            hydrateCollaborators()
            return undefined
        }

        awareness.on("change", hydrateCollaborators)
        hydrateCollaborators()

        return () => {
            awareness.off("change", hydrateCollaborators)
        }
    }, [awareness, hydrateCollaborators])

    useEffect(() => {
        if (isConnected || syncStatus?.isComplete) {
            hydrateCollaborators()
        }
    }, [hydrateCollaborators, isConnected, syncStatus?.isComplete])

    const maxVisible = 4
    const visible = collaborators.slice(0, maxVisible)
    const extra = collaborators.length - maxVisible

    return (
        <div className="active-collaborators-stack" style={{ display: 'flex', alignItems: 'center', marginLeft: '12px' }} aria-label="Active collaborators">
            {visible.map((user, idx) => {
                const initials = getAwarenessInitials(user)
                const isMe = user.resolvedId === (currentUserId || "current")
                const displayName = getAwarenessDisplayName(user)
                const presenceStatus = user.presence?.status || "viewing"
                const presenceLabel = presenceStatus[0].toUpperCase() + presenceStatus.slice(1)
                return (
                    <div 
                        key={user.resolvedId || idx}
                        className={`active-collaborator-avatar presence-${presenceStatus}`}
                        tabIndex={0}
                        aria-label={`${displayName}${isMe ? " (You)" : ""}, ${presenceLabel}`}
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
                        <span className="collaborator-presence-dot" aria-hidden="true" />
                        <span className="collaborator-presence-tooltip" role="tooltip">
                            <strong>{displayName}{isMe ? " (You)" : ""}</strong>
                            <span className="collaborator-presence-tooltip-status">
                                <span className="collaborator-presence-tooltip-dot" aria-hidden="true" />
                                {presenceLabel}
                            </span>
                        </span>
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
    const [contentLastActivity, setContentLastActivity] = useState(0)
    const [noteOwner, setNoteOwner] = useState(null)
    const [noteCollaborators, setNoteCollaborators] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isNavigatingAfterFlush, setIsNavigatingAfterFlush] = useState(false)
    const [isTitleDirty, setIsTitleDirty] = useState(false)
    const [isTitleSaving, setIsTitleSaving] = useState(false)
    const [isTitleError, setIsTitleError] = useState(false)
    const [isContentDirty, setIsContentDirty] = useState(false)
    const [isContentSaving, setIsContentSaving] = useState(false)
    const [isContentError, setIsContentError] = useState(false)
    const [error, setError] = useState("")
    const [loadError, setLoadError] = useState(false)
    const [isShareOpen, setIsShareOpen] = useState(false)
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
    const [isEditorMoreOpen, setIsEditorMoreOpen] = useState(false)
    
    // Step 17D Integration State
    const [activeThreadId, setActiveThreadId] = useState(null)
    const [editorSelection, setEditorSelection] = useState(null)
    const [editorReadyVersion, setEditorReadyVersion] = useState(0)
    const editorRef = useRef(null)
    const commentAnchorCleanupNoteIdRef = useRef(String(noteId))
    const pendingDeletedCommentAnchorsRef = useRef(null)
    const commentAnchorReconciliationRef = useRef({
        noteId: String(noteId),
        generation: 0,
        editorGeneration: 0,
        editorReady: false,
        readyEditor: null,
        invalidationGeneration: 0,
        completed: false,
        active: false,
        retryPending: false,
        failureRetryCount: 0,
        localPendingAnchorIds: new Set()
    })
    const requestCommentAnchorReconciliationRef = useRef(null)
    commentAnchorCleanupNoteIdRef.current = String(noteId)

    // Step 18 Integration State
    const [isHistoryOpen, setIsHistoryOpen] = useState(false)
    const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0)

    // Activity Integration State
    const [isActivityOpen, setIsActivityOpen] = useState(false)


    // Mobile Comments State
    const [isCommentsOpen, setIsCommentsOpen] = useState(false)

    // Layout tracking for backdrop
    const [useOverlay, setUseOverlay] = useState(window.innerWidth < 1023)

    useEffect(() => {
        const handleResize = () => setUseOverlay(window.innerWidth < 1023)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const hasLoadedNote = useRef(false)
    const editorMoreRef = useRef(null)
    const latestPayloadRef = useRef({ content: "", contentJson: null })
    const latestContentDraftRef = useRef(null)
    const confirmedContentSnapshotRef = useRef(null)
    const confirmedContentRevisionRef = useRef({
        noteId: "",
        generation: 0,
        revision: 0
    })
    const contentConflictRef = useRef(null)
    const contentErrorRef = useRef("")
    const contentSaveControllerRef = useRef({
        active: false,
        activeSnapshot: null,
        pendingSnapshot: null,
        sequence: 0,
        generation: 0,
        halted: false,
        recoveryAttempts: 0,
        recoveryTimer: null,
        idleWaiters: new Set()
    })
    const titleRef = useRef(title)
    const noteIdRef = useRef(noteId)
    const isMountedRef = useRef(false)
    const titleAutosaveTimerRef = useRef(null)
    const contentAutosaveTimerRef = useRef(null)
    const navigationFlushPromiseRef = useRef(null)
    const lifecycleFlushRef = useRef({
        noteId: "",
        generation: 0,
        title: null,
        contentKey: null
    })
    const titleProcessingPromiseRef = useRef(null)
    const titleSaveQueueRef = useRef({
        pendingByNoteId: new Map(),
        activeByNoteId: new Map(),
        confirmedByNoteId: new Map(),
        remoteConfirmedByNoteId: new Map(),
        failedByNoteId: new Map(),
        requestSeq: 0
    })

    const currentUserId = getUserIdStr(user)
    const ownerId = getUserIdStr(noteOwner)
    const isOwner = Boolean(currentUserId && ownerId && currentUserId === ownerId)

    usePageTitle(title || "Editor")

    const { socketError, isConnected, isReconnecting } = useNoteSocketV2(noteId)

    const saveStatus = getCombinedSaveStatus({
        isTitleSaving,
        isContentSaving,
        isTitleError,
        isContentError,
        isTitleDirty,
        isContentDirty
    })

    const sortedActiveUsers = []
    const uniqueTypingUsers = []
    const uniqueCollaborators = useMemo(() => deduplicateUsers(noteCollaborators), [noteCollaborators])

    const clearTitleAutosaveTimer = useCallback(() => {
        if (titleAutosaveTimerRef.current) {
            clearTimeout(titleAutosaveTimerRef.current)
            titleAutosaveTimerRef.current = null
        }
    }, [])

    const clearContentAutosaveTimer = useCallback(() => {
        if (contentAutosaveTimerRef.current) {
            clearTimeout(contentAutosaveTimerRef.current)
            contentAutosaveTimerRef.current = null
        }
    }, [])

    const requestCommentAnchorReconciliation = useCallback(async () => {
        const reconciliation = commentAnchorReconciliationRef.current
        const currentNoteId = String(noteId)
        const currentGeneration = reconciliation.generation
        const currentEditorGeneration = reconciliation.editorGeneration
        const isActiveNoteReconciliation = () => (
            isMountedRef.current &&
            reconciliation.noteId === String(noteIdRef.current) &&
            reconciliation.noteId === commentAnchorCleanupNoteIdRef.current &&
            reconciliation.editorReady &&
            !reconciliation.completed
        )
        const isCurrentReconciliation = () => (
            isActiveNoteReconciliation() &&
            reconciliation.noteId === currentNoteId &&
            reconciliation.generation === currentGeneration &&
            reconciliation.editorGeneration === currentEditorGeneration
        )

        if (!isCurrentReconciliation()) return

        if (reconciliation.active) {
            reconciliation.retryPending = true
            return
        }

        const editor = editorRef.current?.getEditor?.()
        if (!editor || editor.isDestroyed) return

        reconciliation.active = true
        reconciliation.retryPending = false
        const invalidationGeneration = reconciliation.invalidationGeneration

        try {
            const response = await getComments(currentNoteId)
            const threads = getCompleteCommentThreads(response)

            if (!Array.isArray(threads)) {
                throw new Error("Comment list response was not complete")
            }

            if (!isCurrentReconciliation()) return

            if (reconciliation.invalidationGeneration !== invalidationGeneration) {
                reconciliation.retryPending = true
                return
            }

            const validAnchorIds = getThreadAnchorIds(threads)
            validAnchorIds.forEach((anchorId) => {
                reconciliation.localPendingAnchorIds.delete(anchorId)
            })

            const currentMarkIds = editorRef.current?.getCommentMarkAnchorIds?.()
            if (!Array.isArray(currentMarkIds)) return

            currentMarkIds
                .filter((anchorId) => (
                    !validAnchorIds.has(anchorId) &&
                    !reconciliation.localPendingAnchorIds.has(anchorId)
                ))
                .forEach((anchorId) => {
                    editorRef.current?.unsetCommentMark?.(anchorId, { addToHistory: false })
                })

            reconciliation.completed = true
            reconciliation.failureRetryCount = 0
        } catch (err) {
            if (isCurrentReconciliation()) {
                console.error("Failed to reconcile comment anchors:", err)

                if (reconciliation.failureRetryCount < 1) {
                    reconciliation.failureRetryCount += 1
                    reconciliation.retryPending = true
                }
            }
        } finally {
            reconciliation.active = false

            if (reconciliation.retryPending && isActiveNoteReconciliation()) {
                reconciliation.retryPending = false
                Promise.resolve().then(() => {
                    requestCommentAnchorReconciliationRef.current?.()
                })
            }
        }
    }, [noteId])

    requestCommentAnchorReconciliationRef.current = requestCommentAnchorReconciliation

    const flushPendingDeletedCommentAnchors = useCallback(() => {
        const pending = pendingDeletedCommentAnchorsRef.current
        if (
            !pending ||
            pending.noteId !== String(noteId) ||
            pending.noteId !== commentAnchorCleanupNoteIdRef.current
        ) {
            return
        }

        const editor = editorRef.current?.getEditor?.()
        if (!editor || editor.isDestroyed) return

        pending.anchorIds.forEach((anchorId) => {
            editorRef.current?.unsetCommentMark?.(anchorId)
        })
        pending.anchorIds.clear()
    }, [noteId])

    const handleEditorReady = useCallback(() => {
        const reconciliation = commentAnchorReconciliationRef.current
        const currentNoteId = String(noteId)
        const editor = editorRef.current?.getEditor?.()

        const isDuplicateReadySignal = (
            reconciliation.editorReady &&
            reconciliation.readyEditor === editor
        )

        if (
            reconciliation.noteId !== currentNoteId ||
            !editor ||
            editor.isDestroyed ||
            (isDuplicateReadySignal && (reconciliation.completed || reconciliation.active))
        ) {
            return
        }

        flushPendingDeletedCommentAnchors()
        reconciliation.editorReady = true
        reconciliation.readyEditor = editor
        reconciliation.editorGeneration += 1
        reconciliation.completed = false
        reconciliation.failureRetryCount = 0
        setEditorReadyVersion((version) => version + 1)
        requestCommentAnchorReconciliationRef.current?.()
    }, [flushPendingDeletedCommentAnchors, noteId])

    const registerPendingCommentAnchor = useCallback((anchorId) => {
        const normalizedAnchorId = typeof anchorId === "string" ? anchorId.trim() : ""
        const reconciliation = commentAnchorReconciliationRef.current
        const currentNoteId = String(noteId)

        if (!normalizedAnchorId || reconciliation.noteId !== currentNoteId) return

        reconciliation.localPendingAnchorIds.add(normalizedAnchorId)
        reconciliation.invalidationGeneration += 1

        if (!reconciliation.completed) {
            requestCommentAnchorReconciliationRef.current?.()
        }
    }, [noteId])

    const isTitleCoveredByManualContentSave = useCallback((targetNoteId, nextTitle) => {
        const targetKey = String(targetNoteId)
        const normalizedTitle = normalizeTitle(nextTitle)
        const controller = contentSaveControllerRef.current

        return [controller.pendingSnapshot, controller.activeSnapshot].some((snapshot) => (
            snapshot?.saveType === "manual" &&
            String(snapshot.noteId) === targetKey &&
            normalizeTitle(snapshot.title) === normalizedTitle
        ))
    }, [])

    const processTitleSaveQueue = useCallback(() => {
        if (titleProcessingPromiseRef.current) {
            return titleProcessingPromiseRef.current
        }

        const run = async () => {
            const queue = titleSaveQueueRef.current

            while (queue.pendingByNoteId.size > 0) {
                const preferredNoteId = String(noteIdRef.current || "")
                const nextEntry = queue.pendingByNoteId.has(preferredNoteId)
                    ? [preferredNoteId, queue.pendingByNoteId.get(preferredNoteId)]
                    : queue.pendingByNoteId.entries().next().value

                if (!nextEntry) break

                const [targetNoteId, pending] = nextEntry
                queue.pendingByNoteId.delete(targetNoteId)

                const titleToSave = pending?.title ?? ""
                const normalizedTitle = normalizeTitle(titleToSave)
                const lastConfirmedTitle = queue.confirmedByNoteId.get(targetNoteId) ?? ""

                if (normalizedTitle === lastConfirmedTitle) {
                    if (isMountedRef.current && String(noteIdRef.current) === String(targetNoteId)) {
                        setIsTitleDirty(false)
                        setIsTitleError(false)
                    }
                    continue
                }

                const requestSeq = ++queue.requestSeq
                queue.activeByNoteId.set(targetNoteId, {
                    title: titleToSave,
                    requestSeq
                })

                const shouldUpdateCurrentState = () => (
                    isMountedRef.current &&
                    String(noteIdRef.current) === String(targetNoteId) &&
                    pending?.allowState !== false
                )

                if (shouldUpdateCurrentState()) {
                    setIsTitleSaving(true)
                    setIsTitleError(false)
                }

                try {
                    const response = await updateNote(targetNoteId, { title: titleToSave })
                    const savedNote = getNoteFromResponse(response)
                    const confirmedTitle = normalizeTitle(savedNote?.title ?? titleToSave)
                    const isLatestRequest = requestSeq === queue.requestSeq

                    queue.confirmedByNoteId.set(targetNoteId, confirmedTitle)
                    queue.remoteConfirmedByNoteId.delete(targetNoteId)
                    queue.failedByNoteId.delete(targetNoteId)

                    if (shouldUpdateCurrentState() && isLatestRequest) {
                        const latestTitle = normalizeTitle(titleRef.current)
                        const hasPendingTitle = queue.pendingByNoteId.has(targetNoteId)

                        setIsTitleDirty(latestTitle !== confirmedTitle || hasPendingTitle)
                        setIsTitleError(false)
                    }
                } catch {
                    queue.failedByNoteId.set(targetNoteId, true)

                    if (shouldUpdateCurrentState()) {
                        setError("Unable to save note.")
                        setIsTitleError(true)
                        setIsTitleDirty(true)
                    }
                } finally {
                    const activeTitleSave = queue.activeByNoteId.get(targetNoteId)

                    if (activeTitleSave?.requestSeq === requestSeq) {
                        queue.activeByNoteId.delete(targetNoteId)
                    }

                    if (shouldUpdateCurrentState()) {
                        setIsTitleSaving(false)
                    }
                }
            }
        }

        titleProcessingPromiseRef.current = run().finally(() => {
            titleProcessingPromiseRef.current = null

            if (titleSaveQueueRef.current.pendingByNoteId.size > 0) {
                processTitleSaveQueue()
            }
        })

        return titleProcessingPromiseRef.current
    }, [])

    const enqueueTitleSave = useCallback((targetNoteId, nextTitle, options = {}) => {
        if (!targetNoteId || !hasLoadedNote.current) {
            return Promise.resolve()
        }

        const targetKey = String(targetNoteId)
        titleSaveQueueRef.current.failedByNoteId.delete(targetKey)
        titleSaveQueueRef.current.pendingByNoteId.set(targetKey, {
            title: nextTitle,
            allowState: options.allowState !== false
        })

        return processTitleSaveQueue()
    }, [processTitleSaveQueue])

    const scheduleTitleSave = useCallback((targetNoteId, nextTitle) => {
        clearTitleAutosaveTimer()

        titleAutosaveTimerRef.current = setTimeout(() => {
            titleAutosaveTimerRef.current = null
            enqueueTitleSave(targetNoteId, nextTitle)
        }, TITLE_AUTOSAVE_DELAY_MS)
    }, [clearTitleAutosaveTimer, enqueueTitleSave])

    const flushTitleSave = useCallback((targetNoteId = noteIdRef.current, nextTitle = titleRef.current, options = {}) => {
        clearTitleAutosaveTimer()

        const normalizedTitle = normalizeTitle(nextTitle)
        const confirmedTitle = titleSaveQueueRef.current.confirmedByNoteId.get(String(targetNoteId)) ?? ""

        if (normalizedTitle === confirmedTitle && !titleSaveQueueRef.current.pendingByNoteId.has(String(targetNoteId))) {
            return Promise.resolve()
        }

        return enqueueTitleSave(targetNoteId, nextTitle, options)
    }, [clearTitleAutosaveTimer, enqueueTitleSave])

    const waitForTitleQueueIdle = useCallback(async (targetNoteId) => {
        const targetKey = String(targetNoteId)

        while (true) {
            const queue = titleSaveQueueRef.current
            const hasTitleWork = (
                queue.pendingByNoteId.has(targetKey) ||
                queue.activeByNoteId.has(targetKey)
            )

            if (!hasTitleWork) {
                return queue.failedByNoteId.has(targetKey) ? "failed" : "idle"
            }

            const processing = titleProcessingPromiseRef.current || processTitleSaveQueue()

            if (!processing) {
                return queue.failedByNoteId.has(targetKey) ? "failed" : "idle"
            }

            await processing
        }
    }, [processTitleSaveQueue])

    const flushTitleBeforeNavigation = useCallback(async (targetNoteId) => {
        const targetKey = String(targetNoteId)

        while (
            hasLoadedNote.current &&
            String(noteIdRef.current || "") === targetKey
        ) {
            clearTitleAutosaveTimer()

            const queue = titleSaveQueueRef.current
            const latestTitle = normalizeTitle(titleRef.current)
            const confirmedTitle = queue.confirmedByNoteId.get(targetKey) ?? ""
            const pendingTitle = queue.pendingByNoteId.get(targetKey)?.title
            const activeTitle = queue.activeByNoteId.get(targetKey)?.title
            const newestTitleIsQueued = (
                (pendingTitle !== undefined && normalizeTitle(pendingTitle) === latestTitle) ||
                (activeTitle !== undefined && normalizeTitle(activeTitle) === latestTitle)
            )
            const titleCoveredByManualContentSave = isTitleCoveredByManualContentSave(targetKey, latestTitle)

            if (
                latestTitle !== confirmedTitle &&
                !newestTitleIsQueued &&
                !titleCoveredByManualContentSave
            ) {
                enqueueTitleSave(targetKey, titleRef.current)
            } else if (
                queue.pendingByNoteId.has(targetKey) &&
                !titleProcessingPromiseRef.current
            ) {
                processTitleSaveQueue()
            }

            const result = await waitForTitleQueueIdle(targetKey)

            if (result !== "idle") return result

            const settledQueue = titleSaveQueueRef.current
            const settledTitle = normalizeTitle(titleRef.current)
            const settledConfirmedTitle = settledQueue.confirmedByNoteId.get(targetKey) ?? ""
            const hasSettledWork = (
                settledQueue.pendingByNoteId.has(targetKey) ||
                settledQueue.activeByNoteId.has(targetKey)
            )

            if (settledTitle === settledConfirmedTitle && !hasSettledWork) {
                return "idle"
            }

            // A manual content checkpoint may be the request that persists this title.
            if (titleCoveredByManualContentSave && !hasSettledWork) {
                return "idle"
            }
        }

        return "stale"
    }, [
        clearTitleAutosaveTimer,
        enqueueTitleSave,
        isTitleCoveredByManualContentSave,
        processTitleSaveQueue,
        waitForTitleQueueIdle
    ])


    useEffect(() => {
        const currentNoteId = String(noteId)
        let isCurrentNote = true

        noteIdRef.current = currentNoteId
        hasLoadedNote.current = false
        const reconciliation = commentAnchorReconciliationRef.current

        if (reconciliation.noteId !== currentNoteId) {
            reconciliation.noteId = currentNoteId
            reconciliation.generation += 1
            reconciliation.editorGeneration = 0
            reconciliation.editorReady = false
            reconciliation.readyEditor = null
            reconciliation.invalidationGeneration = 0
            reconciliation.completed = false
            reconciliation.retryPending = Boolean(reconciliation.active)
            reconciliation.failureRetryCount = 0
            reconciliation.localPendingAnchorIds.clear()
        }

        clearTitleAutosaveTimer()
        clearContentAutosaveTimer()
        titleSaveQueueRef.current.pendingByNoteId.delete(currentNoteId)
        titleSaveQueueRef.current.failedByNoteId.delete(currentNoteId)
        const contentController = contentSaveControllerRef.current
        contentController.generation += 1
        contentController.pendingSnapshot = null
        contentController.halted = false
        contentController.recoveryAttempts = 0

        if (contentController.recoveryTimer?.id) {
            clearTimeout(contentController.recoveryTimer.id)
        }

        contentController.recoveryTimer = null
        contentController.idleWaiters.forEach((waiter) => waiter.resolve("stale"))
        contentController.idleWaiters.clear()
        const currentContentGeneration = contentController.generation
        lifecycleFlushRef.current = {
            noteId: currentNoteId,
            generation: currentContentGeneration,
            title: null,
            contentKey: null
        }
        confirmedContentRevisionRef.current = {
            noteId: currentNoteId,
            generation: currentContentGeneration,
            revision: 0
        }
        contentConflictRef.current = null
        contentErrorRef.current = ""
        setIsTitleDirty(false)
        setIsTitleSaving(false)
        setIsTitleError(false)
        setIsContentDirty(false)
        setIsContentSaving(false)
        setIsContentError(false)
        setIsSaving(false)
        setIsNavigatingAfterFlush(false)
        setLoadError(false)
        const fetchNote = async () => {
            setIsLoading(true)
            setError("")

            try {
                const response = await getNoteById(noteId)
                const note = getNoteFromResponse(response)

                if (!isCurrentNote) return

                const nextTitle = note?.title || ""
                const nextContent = note?.content || ""
                const nextContentJson = note?.contentJson || null
                const initialContentSnapshot = createContentSnapshot({
                    noteId: currentNoteId,
                    content: nextContent,
                    contentJson: nextContentJson,
                    sequence: contentController.sequence,
                    generation: currentContentGeneration,
                    title: nextTitle
                })

                titleRef.current = nextTitle
                latestPayloadRef.current = {
                    content: initialContentSnapshot.content,
                    contentJson: initialContentSnapshot.contentJson
                }
                latestContentDraftRef.current = initialContentSnapshot
                confirmedContentSnapshotRef.current = initialContentSnapshot
                confirmedContentRevisionRef.current = {
                    noteId: currentNoteId,
                    generation: currentContentGeneration,
                    revision: normalizeContentRevision(note?.contentRevision)
                }
                titleSaveQueueRef.current.confirmedByNoteId.set(currentNoteId, normalizeTitle(nextTitle))
                titleSaveQueueRef.current.remoteConfirmedByNoteId.delete(currentNoteId)
                setTitle(nextTitle)
                setContent(nextContent)
                setContentJson(nextContentJson)
                setNoteOwner(note?.owner || note?.ownerId || note?.createdBy || null)
                setNoteCollaborators(Array.isArray(note?.sharedWith) ? note.sharedWith : [])
                hasLoadedNote.current = true
            } catch {
                if (!isCurrentNote) return

                setError("Unable to load note.")
                setLoadError(true)
            } finally {
                if (isCurrentNote) {
                    setIsLoading(false)
                }
            }
        }

        fetchNote()

        return () => {
            isCurrentNote = false
            clearTitleAutosaveTimer()
            clearContentAutosaveTimer()
        }
    }, [clearContentAutosaveTimer, clearTitleAutosaveTimer, noteId])

    useEffect(() => {
        const contentController = contentSaveControllerRef.current
        isMountedRef.current = true

        return () => {
            isMountedRef.current = false
            clearTitleAutosaveTimer()
            clearContentAutosaveTimer()

            contentController.idleWaiters.forEach((waiter) => waiter.resolve("stale"))
            contentController.idleWaiters.clear()

            if (contentController.recoveryTimer?.id) {
                clearTimeout(contentController.recoveryTimer.id)
            }
            contentController.recoveryTimer = null
        }
    }, [clearContentAutosaveTimer, clearTitleAutosaveTimer])
    useEffect(() => {
        const currentNoteId = String(noteId)
        const pending = {
            noteId: currentNoteId,
            anchorIds: new Set()
        }

        pendingDeletedCommentAnchorsRef.current = pending

        const handleCommentsUpdated = (payload = {}) => {
            if (
                currentNoteId !== commentAnchorCleanupNoteIdRef.current ||
                String(payload?.noteId) !== currentNoteId
            ) {
                return
            }

            if (COMMENT_ANCHOR_VALIDITY_ACTIONS.has(payload?.action)) {
                const reconciliation = commentAnchorReconciliationRef.current

                if (reconciliation.noteId === currentNoteId) {
                    reconciliation.invalidationGeneration += 1

                    if (!reconciliation.completed) {
                        requestCommentAnchorReconciliationRef.current?.()
                    }
                }
            }

            if (payload?.action !== "thread_deleted" || !payload?.anchorId) {
                return
            }

            pending.anchorIds.add(String(payload.anchorId))
            flushPendingDeletedCommentAnchors()
        }

        socket.on("comments:updated", handleCommentsUpdated)
        flushPendingDeletedCommentAnchors()

        return () => {
            socket.off("comments:updated", handleCommentsUpdated)
            pending.anchorIds.clear()

            if (pendingDeletedCommentAnchorsRef.current === pending) {
                pendingDeletedCommentAnchorsRef.current = null
            }
        }
    }, [flushPendingDeletedCommentAnchors, noteId])

    useEffect(() => {
        flushPendingDeletedCommentAnchors()
    }, [editorReadyVersion, flushPendingDeletedCommentAnchors])

    useEffect(() => {
        const currentNoteId = String(noteId)
        const currentGeneration = contentSaveControllerRef.current.generation

        const handleRemoteTitleUpdated = (payload = {}) => {
            if (!payload?.noteId || typeof payload.title !== "string") {
                return
            }

            if (
                String(payload.noteId) !== currentNoteId ||
                String(noteIdRef.current) !== currentNoteId ||
                contentSaveControllerRef.current.generation !== currentGeneration
            ) {
                return
            }

            const queue = titleSaveQueueRef.current
            const localTitle = normalizeTitle(titleRef.current)
            const confirmedTitle = queue.confirmedByNoteId.get(currentNoteId) ?? ""
            const hasLocalTitleWork = (
                localTitle !== confirmedTitle ||
                queue.pendingByNoteId.has(currentNoteId) ||
                queue.activeByNoteId.has(currentNoteId)
            )
            const persistedTitle = normalizeTitle(payload.title)

            if (hasLocalTitleWork) {
                queue.remoteConfirmedByNoteId.set(currentNoteId, persistedTitle)
                return
            }

            queue.confirmedByNoteId.set(currentNoteId, persistedTitle)
            queue.remoteConfirmedByNoteId.delete(currentNoteId)
            titleRef.current = persistedTitle
            setTitle(persistedTitle)
            setIsTitleDirty(false)
            setIsTitleError(false)
        }

        socket.on("note:title-updated", handleRemoteTitleUpdated)

        return () => {
            socket.off("note:title-updated", handleRemoteTitleUpdated)
        }
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
        if (socketError && isContentSaving) {
            setIsContentError(true)
        }
    }, [isContentSaving, socketError])

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
        const currentNoteId = String(noteId)
        const confirmedTitle = titleSaveQueueRef.current.confirmedByNoteId.get(currentNoteId) ?? ""

        titleRef.current = nextTitle
        setTitle(nextTitle)
        setError("")
        setIsTitleError(false)
        setIsTitleDirty(normalizeTitle(nextTitle) !== confirmedTitle)
        scheduleTitleSave(currentNoteId, nextTitle)
    }

    const handleTitleBlur = useCallback(() => {

        flushTitleSave(noteId, titleRef.current)
    }, [flushTitleSave, noteId])

    const recomputeTitleDirtyState = useCallback(() => {
        if (!isMountedRef.current) return false

        const targetKey = String(noteIdRef.current || "")
        const queue = titleSaveQueueRef.current
        const isDirty = (
            normalizeTitle(titleRef.current) !== (queue.confirmedByNoteId.get(targetKey) ?? "") ||
            queue.pendingByNoteId.has(targetKey) ||
            queue.activeByNoteId.has(targetKey)
        )

        setIsTitleDirty(isDirty)
        return isDirty
    }, [])

    const isCurrentContentSnapshot = useCallback((snapshot) => (
        Boolean(snapshot) &&
        isMountedRef.current &&
        String(noteIdRef.current) === String(snapshot.noteId) &&
        contentSaveControllerRef.current.generation === snapshot.generation
    ), [])

    const getNextContentSequence = useCallback(() => {
        contentSaveControllerRef.current.sequence += 1
        return contentSaveControllerRef.current.sequence
    }, [])

    const hasCurrentContentQueueWork = useCallback(() => {
        const controller = contentSaveControllerRef.current
        const currentNoteId = String(noteIdRef.current || "")
        const currentGeneration = controller.generation
        const matchesCurrent = (snapshot) => Boolean(snapshot) &&
            String(snapshot.noteId) === currentNoteId &&
            snapshot.generation === currentGeneration

        const hasCurrentRecoveryTimer = Boolean(controller.recoveryTimer) &&
            String(controller.recoveryTimer.noteId) === currentNoteId &&
            controller.recoveryTimer.generation === currentGeneration

        return (controller.active && matchesCurrent(controller.activeSnapshot)) ||
            matchesCurrent(controller.pendingSnapshot) ||
            hasCurrentRecoveryTimer
    }, [])

    const getContentQueueStatus = useCallback((targetNoteId, targetGeneration) => {
        const controller = contentSaveControllerRef.current
        const currentNoteId = String(noteIdRef.current || "")
        const isCurrentTarget = (
            String(targetNoteId) === currentNoteId &&
            targetGeneration === controller.generation
        )

        if (!isCurrentTarget) {
            return "stale"
        }

        const matchesTarget = (snapshot) => Boolean(snapshot) &&
            String(snapshot.noteId) === String(targetNoteId) &&
            snapshot.generation === targetGeneration
        const hasWork = (
            (controller.active && matchesTarget(controller.activeSnapshot)) ||
            matchesTarget(controller.pendingSnapshot) ||
            (Boolean(controller.recoveryTimer) &&
                String(controller.recoveryTimer.noteId) === String(targetNoteId) &&
                controller.recoveryTimer.generation === targetGeneration)
        )

        if (hasWork) return null
        if (controller.halted || contentErrorRef.current) return "failed"
        return "idle"
    }, [])

    const resolveContentQueueWaiters = useCallback(() => {
        const controller = contentSaveControllerRef.current

        controller.idleWaiters.forEach((waiter) => {
            const status = getContentQueueStatus(waiter.noteId, waiter.generation)

            if (status) {
                controller.idleWaiters.delete(waiter)
                waiter.resolve(status)
            }
        })
    }, [getContentQueueStatus])

    const waitForContentQueueIdle = useCallback((targetNoteId, targetGeneration) => {
        const status = getContentQueueStatus(targetNoteId, targetGeneration)
        if (status) return Promise.resolve(status)

        return new Promise((resolve) => {
            contentSaveControllerRef.current.idleWaiters.add({
                noteId: String(targetNoteId),
                generation: targetGeneration,
                resolve
            })
        })
    }, [getContentQueueStatus])

    const syncContentSavingState = useCallback(() => {
        if (!isMountedRef.current) return

        const hasQueueWork = hasCurrentContentQueueWork()
        setIsContentSaving(hasQueueWork)
        setIsSaving(hasQueueWork)
        resolveContentQueueWaiters()
    }, [hasCurrentContentQueueWork, resolveContentQueueWaiters])

    const recomputeContentDirtyState = useCallback(() => {
        if (!isMountedRef.current) return false

        const draft = latestContentDraftRef.current
        const confirmed = confirmedContentSnapshotRef.current
        const controller = contentSaveControllerRef.current
        const isCurrentDraft = Boolean(draft) &&
            String(draft.noteId) === String(noteIdRef.current || "") &&
            draft.generation === controller.generation
        const isDirty = Boolean(isCurrentDraft && (!confirmed || draft.contentKey !== confirmed.contentKey))

        setIsContentDirty(isDirty)
        return isDirty
    }, [])

    const setLatestContentDraft = useCallback((payload) => {
        const controller = contentSaveControllerRef.current

        if (controller.halted) {
            controller.halted = false
            controller.recoveryAttempts = 0
            contentConflictRef.current = null
        }

        const snapshot = createContentSnapshot({
            noteId: noteIdRef.current,
            content: payload?.content ?? "",
            contentJson: payload?.contentJson ?? null,
            sequence: getNextContentSequence(),
            generation: controller.generation,
            title: titleRef.current
        })

        latestPayloadRef.current = {
            content: snapshot.content,
            contentJson: snapshot.contentJson
        }
        latestContentDraftRef.current = snapshot
        setIsContentDirty(snapshot.contentKey !== confirmedContentSnapshotRef.current?.contentKey)
        return snapshot
    }, [getNextContentSequence])

    const buildContentSaveSnapshot = useCallback((saveType = "autosave") => {
        const draft = latestContentDraftRef.current || setLatestContentDraft(latestPayloadRef.current)
        const snapshot = {
            ...draft,
            saveType,
            sequence: getNextContentSequence(),
            title: titleRef.current
        }

        snapshot.payload = saveType === "manual"
            ? {
                title: snapshot.title,
                content: snapshot.content,
                contentJson: snapshot.contentJson,
                editorVersion: "v2",
                saveType
            }
            : {
                content: snapshot.content,
                contentJson: snapshot.contentJson,
                editorVersion: "v2",
                saveType
            }

        return snapshot
    }, [getNextContentSequence, setLatestContentDraft])

    const withContentSaveIntent = useCallback((snapshot, saveType) => {
        const nextSnapshot = {
            ...snapshot,
            saveType,
            sequence: getNextContentSequence(),
            title: titleRef.current
        }

        nextSnapshot.payload = saveType === "manual"
            ? {
                title: nextSnapshot.title,
                content: nextSnapshot.content,
                contentJson: nextSnapshot.contentJson,
                editorVersion: "v2",
                saveType: "manual"
            }
            : {
                content: nextSnapshot.content,
                contentJson: nextSnapshot.contentJson,
                editorVersion: "v2",
                saveType: "autosave"
            }

        return nextSnapshot
    }, [getNextContentSequence])

    const processContentSaveQueue = useCallback(() => {
        const controller = contentSaveControllerRef.current

        if (controller.active || controller.halted || controller.recoveryTimer) return

        const snapshot = controller.pendingSnapshot

        if (!snapshot) {
            syncContentSavingState()
            return
        }

        controller.pendingSnapshot = null
        const confirmedRevision = confirmedContentRevisionRef.current
        const expectedContentRevision = (
            String(confirmedRevision.noteId) === String(snapshot.noteId) &&
            confirmedRevision.generation === snapshot.generation
        )
            ? confirmedRevision.revision
            : 0
        const activeSnapshot = {
            ...snapshot,
            expectedContentRevision,
            payload: {
                ...snapshot.payload,
                expectedContentRevision
            }
        }
        controller.active = true
        controller.activeSnapshot = activeSnapshot

        if (isCurrentContentSnapshot(activeSnapshot)) {
            setIsSaving(true)
            setIsContentSaving(true)
            setIsContentError(false)

            if (contentErrorRef.current) {
                contentErrorRef.current = ""
                setError("")
            }
        }

        const finishQueue = () => {
            controller.active = false
            controller.activeSnapshot = null

            if (controller.halted) {
                controller.pendingSnapshot = null
                syncContentSavingState()
                return
            }

            if (controller.pendingSnapshot) {
                processContentSaveQueue()
                return
            }

            syncContentSavingState()
        }

        const scheduleRecovery = (saveType, attempt) => {
            const delay = getContentRecoveryDelay(attempt)

            if (delay === 0) {
                const recoveryDraft = latestContentDraftRef.current

                if (isCurrentContentSnapshot(recoveryDraft)) {
                    controller.pendingSnapshot = withContentSaveIntent(recoveryDraft, saveType)
                }

                return
            }

            const timer = {
                id: null,
                noteId: activeSnapshot.noteId,
                generation: activeSnapshot.generation,
                saveType
            }

            timer.id = setTimeout(() => {
                if (
                    controller.recoveryTimer !== timer ||
                    !isCurrentContentSnapshot({
                        noteId: timer.noteId,
                        generation: timer.generation
                    }) ||
                    controller.halted
                ) {
                    return
                }

                controller.recoveryTimer = null
                const recoveryDraft = latestContentDraftRef.current

                if (!isCurrentContentSnapshot(recoveryDraft)) {
                    syncContentSavingState()
                    return
                }

                const pendingIntent = controller.pendingSnapshot?.saveType
                const recoverySaveType = (
                    timer.saveType === "manual" || pendingIntent === "manual"
                )
                    ? "manual"
                    : "autosave"

                controller.pendingSnapshot = withContentSaveIntent(
                    recoveryDraft,
                    recoverySaveType
                )
                processContentSaveQueue()
            }, delay)

            controller.recoveryTimer = timer
        }

        updateNote(activeSnapshot.noteId, activeSnapshot.payload)
            .then((response) => {
                const savedNote = getNoteFromResponse(response)

                if (!isCurrentContentSnapshot(activeSnapshot)) return

                if (controller.recoveryTimer?.id) {
                    clearTimeout(controller.recoveryTimer.id)
                }
                controller.recoveryTimer = null
                confirmedContentSnapshotRef.current = activeSnapshot
                confirmedContentRevisionRef.current = {
                    noteId: activeSnapshot.noteId,
                    generation: activeSnapshot.generation,
                    revision: normalizeContentRevision(savedNote?.contentRevision)
                }
                controller.recoveryAttempts = 0
                contentConflictRef.current = null
                recomputeContentDirtyState()
                setIsContentError(false)

                if (contentErrorRef.current) {
                    contentErrorRef.current = ""
                    setError("")
                }

                if (activeSnapshot.saveType === "manual") {
                    const confirmedTitle = normalizeTitle(savedNote?.title ?? activeSnapshot.title)

                    titleSaveQueueRef.current.confirmedByNoteId.set(String(activeSnapshot.noteId), confirmedTitle)
                    titleSaveQueueRef.current.pendingByNoteId.delete(String(activeSnapshot.noteId))
                    setIsTitleDirty(normalizeTitle(titleRef.current) !== confirmedTitle)
                    setIsTitleError(false)
                    setHistoryRefreshTrigger(Date.now())

                }
            })
            .catch((saveError) => {
                if (!isCurrentContentSnapshot(activeSnapshot)) return

                const conflict = getContentRevisionConflict(saveError)

                if (conflict) {
                    const recoveryDraft = latestContentDraftRef.current
                    const nextRecoveryAttempt = controller.recoveryAttempts + 1
                    const canRecover = (
                        nextRecoveryAttempt <= MAX_CONTENT_RECOVERY_ATTEMPTS &&
                        isCurrentContentSnapshot(recoveryDraft)
                    )

                    confirmedContentRevisionRef.current = {
                        noteId: activeSnapshot.noteId,
                        generation: activeSnapshot.generation,
                        revision: conflict.currentContentRevision
                    }

                    if (canRecover) {
                        const pendingIntent = controller.pendingSnapshot?.saveType
                        const recoverySaveType = (
                            activeSnapshot.saveType === "manual" ||
                            pendingIntent === "manual"
                        )
                            ? "manual"
                            : "autosave"

                        controller.recoveryAttempts = nextRecoveryAttempt
                        contentConflictRef.current = {
                            noteId: activeSnapshot.noteId,
                            generation: activeSnapshot.generation,
                            currentContentRevision: conflict.currentContentRevision,
                            terminal: false
                        }
                        scheduleRecovery(recoverySaveType, nextRecoveryAttempt)
                        recomputeContentDirtyState()
                        setIsContentError(false)
                        return
                    }

                    if (controller.recoveryTimer?.id) {
                        clearTimeout(controller.recoveryTimer.id)
                    }
                    controller.recoveryTimer = null
                    controller.halted = true
                    controller.pendingSnapshot = null
                    contentConflictRef.current = {
                        noteId: activeSnapshot.noteId,
                        generation: activeSnapshot.generation,
                        currentContentRevision: conflict.currentContentRevision,
                        terminal: true
                    }
                    recomputeContentDirtyState()
                    contentErrorRef.current = "Unable to save note."
                    setError(contentErrorRef.current)
                    setIsContentError(true)
                    return
                }

                recomputeContentDirtyState()

                if (!contentSaveControllerRef.current.pendingSnapshot) {
                    contentErrorRef.current = "Unable to save note."
                    setError(contentErrorRef.current)
                    setIsContentError(true)
                }
            })
            .finally(finishQueue)
    }, [
        isCurrentContentSnapshot,
        recomputeContentDirtyState,
        syncContentSavingState,
        withContentSaveIntent
    ])
    const enqueueContentSave = useCallback((snapshot) => {
        const controller = contentSaveControllerRef.current
        const confirmedSnapshot = confirmedContentSnapshotRef.current
        const activeSnapshot = controller.activeSnapshot
        const existingPending = controller.pendingSnapshot

        if (controller.halted) {
            if (snapshot.saveType !== "manual") {
                recomputeContentDirtyState()
                syncContentSavingState()
                return
            }

            controller.halted = false
            controller.recoveryAttempts = 0
            contentConflictRef.current = null
        }

        if (!controller.active && !existingPending && snapshot.contentKey === confirmedSnapshot?.contentKey) {
            recomputeContentDirtyState()
            syncContentSavingState()
            return
        }

        if (controller.active && !existingPending && snapshot.contentKey === activeSnapshot?.contentKey) {
            const shouldQueueManualCheckpoint = snapshot.saveType === "manual" && activeSnapshot?.saveType !== "manual"
            if (!shouldQueueManualCheckpoint) {
                syncContentSavingState()
                return
            }
        }

        const saveType = existingPending?.saveType === "manual" || snapshot.saveType === "manual"
            ? "manual"
            : "autosave"

        controller.pendingSnapshot = withContentSaveIntent(snapshot, saveType)

        if (isCurrentContentSnapshot(controller.pendingSnapshot)) {
            setIsSaving(true)
            setIsContentSaving(true)
            setIsContentError(false)
        }

        processContentSaveQueue()
    }, [isCurrentContentSnapshot, processContentSaveQueue, recomputeContentDirtyState, syncContentSavingState, withContentSaveIntent])

    const handleSave = useCallback(async (saveType = "manual") => {
        if (!hasLoadedNote.current) return

        if (saveType === "manual") {
            clearTitleAutosaveTimer()
            titleSaveQueueRef.current.pendingByNoteId.delete(String(noteId))

            if (titleProcessingPromiseRef.current) {
                await titleProcessingPromiseRef.current
            }

            clearTitleAutosaveTimer()
            titleSaveQueueRef.current.pendingByNoteId.delete(String(noteId))
        }

        enqueueContentSave(buildContentSaveSnapshot(saveType))
    }, [buildContentSaveSnapshot, clearTitleAutosaveTimer, enqueueContentSave, noteId])

    const flushContentBeforeNavigation = useCallback(async (targetNoteId, targetGeneration) => {
        const targetKey = String(targetNoteId)

        while (
            hasLoadedNote.current &&
            String(noteIdRef.current || "") === targetKey &&
            contentSaveControllerRef.current.generation === targetGeneration
        ) {
            clearContentAutosaveTimer()

            const draft = latestContentDraftRef.current
            const confirmed = confirmedContentSnapshotRef.current
            const isCurrentDraft = Boolean(draft) &&
                String(draft.noteId) === targetKey &&
                draft.generation === targetGeneration
            const isDirty = Boolean(
                isCurrentDraft &&
                (!confirmed || draft.contentKey !== confirmed.contentKey)
            )
            const queueStatus = getContentQueueStatus(targetKey, targetGeneration)

            if (queueStatus === "failed") return queueStatus

            if (isDirty) {
                enqueueContentSave(buildContentSaveSnapshot("autosave"))
            } else if (queueStatus === "idle") {
                return "idle"
            }

            const settledStatus = await waitForContentQueueIdle(targetKey, targetGeneration)

            if (settledStatus !== "idle") return settledStatus
        }

        return "stale"
    }, [
        buildContentSaveSnapshot,
        clearContentAutosaveTimer,
        enqueueContentSave,
        getContentQueueStatus,
        waitForContentQueueIdle
    ])

    const flushBeforeNavigation = useCallback(async () => {
        const targetNoteId = String(noteIdRef.current || "")
        const targetGeneration = contentSaveControllerRef.current.generation

        if (!targetNoteId || !hasLoadedNote.current) return "stale"

        while (
            hasLoadedNote.current &&
            String(noteIdRef.current || "") === targetNoteId &&
            contentSaveControllerRef.current.generation === targetGeneration
        ) {
            const titleStatus = await flushTitleBeforeNavigation(targetNoteId)

            if (titleStatus !== "idle") return titleStatus

            const contentStatus = await flushContentBeforeNavigation(targetNoteId, targetGeneration)

            if (contentStatus !== "idle") return contentStatus

            const titleQueue = titleSaveQueueRef.current
            const latestTitle = normalizeTitle(titleRef.current)
            const confirmedTitle = titleQueue.confirmedByNoteId.get(targetNoteId) ?? ""
            const titleIsSettled = (
                latestTitle === confirmedTitle &&
                !titleQueue.pendingByNoteId.has(targetNoteId) &&
                !titleQueue.activeByNoteId.has(targetNoteId)
            )
            const draft = latestContentDraftRef.current
            const confirmed = confirmedContentSnapshotRef.current
            const contentIsSettled = Boolean(
                draft &&
                String(draft.noteId) === targetNoteId &&
                draft.generation === targetGeneration &&
                confirmed &&
                draft.contentKey === confirmed.contentKey &&
                getContentQueueStatus(targetNoteId, targetGeneration) === "idle"
            )

            if (titleIsSettled && contentIsSettled) return "idle"
        }

        return "stale"
    }, [
        flushContentBeforeNavigation,
        flushTitleBeforeNavigation,
        getContentQueueStatus
    ])

    const navigateAfterFlush = useCallback(async (destination) => {
        if (navigationFlushPromiseRef.current) return

        let didNavigate = false
        const navigationTask = (async () => {
            if (isMountedRef.current) {
                setIsNavigatingAfterFlush(true)
            }

            const status = await flushBeforeNavigation()

            if (status === "idle" && isMountedRef.current) {
                didNavigate = true
                navigate(destination)
            }

            return status
        })()

        navigationFlushPromiseRef.current = navigationTask

        try {
            return await navigationTask
        } finally {
            if (navigationFlushPromiseRef.current === navigationTask) {
                navigationFlushPromiseRef.current = null
            }

            if (isMountedRef.current && !didNavigate) {
                setIsNavigatingAfterFlush(false)
            }
        }
    }, [flushBeforeNavigation, navigate])

    const flushForPageLifecycle = useCallback(() => {
        if (!isMountedRef.current || !hasLoadedNote.current) return

        const targetNoteId = String(noteIdRef.current || "")
        const controller = contentSaveControllerRef.current
        const targetGeneration = controller.generation

        if (!targetNoteId) return

        const lifecycle = lifecycleFlushRef.current
        if (
            lifecycle.noteId !== targetNoteId ||
            lifecycle.generation !== targetGeneration
        ) {
            lifecycleFlushRef.current = {
                noteId: targetNoteId,
                generation: targetGeneration,
                title: null,
                contentKey: null
            }
        }

        clearTitleAutosaveTimer()
        clearContentAutosaveTimer()

        const currentLifecycle = lifecycleFlushRef.current
        const titleQueue = titleSaveQueueRef.current
        const latestTitle = normalizeTitle(titleRef.current)
        const confirmedTitle = titleQueue.confirmedByNoteId.get(targetNoteId) ?? ""
        const pendingTitle = titleQueue.pendingByNoteId.get(targetNoteId)?.title
        const activeTitle = titleQueue.activeByNoteId.get(targetNoteId)?.title
        const latestTitleIsQueued = (
            (pendingTitle !== undefined && normalizeTitle(pendingTitle) === latestTitle) ||
            (activeTitle !== undefined && normalizeTitle(activeTitle) === latestTitle)
        )
        const titleIsDirty = latestTitle !== confirmedTitle

        if (
            titleIsDirty &&
            !titleQueue.failedByNoteId.has(targetNoteId) &&
            !latestTitleIsQueued &&
            !isTitleCoveredByManualContentSave(targetNoteId, latestTitle) &&
            currentLifecycle.title !== latestTitle
        ) {
            currentLifecycle.title = latestTitle
            enqueueTitleSave(targetNoteId, titleRef.current)
        } else if (titleIsDirty) {
            currentLifecycle.title = latestTitle
        }

        const draft = latestContentDraftRef.current
        const confirmed = confirmedContentSnapshotRef.current
        const isCurrentDraft = Boolean(draft) &&
            String(draft.noteId) === targetNoteId &&
            draft.generation === targetGeneration
        const contentIsDirty = Boolean(
            isCurrentDraft &&
            (!confirmed || draft.contentKey !== confirmed.contentKey)
        )
        const latestContentIsQueued = [controller.pendingSnapshot, controller.activeSnapshot].some((snapshot) => (
            snapshot?.contentKey === draft?.contentKey &&
            String(snapshot.noteId) === targetNoteId &&
            snapshot.generation === targetGeneration
        ))
        const contentQueueStatus = getContentQueueStatus(targetNoteId, targetGeneration)

        if (
            contentIsDirty &&
            contentQueueStatus !== "failed" &&
            !controller.halted &&
            !latestContentIsQueued &&
            currentLifecycle.contentKey !== draft.contentKey
        ) {
            currentLifecycle.contentKey = draft.contentKey
            enqueueContentSave(buildContentSaveSnapshot("autosave"))
        } else if (contentIsDirty) {
            currentLifecycle.contentKey = draft.contentKey
        }
    }, [
        buildContentSaveSnapshot,
        clearContentAutosaveTimer,
        clearTitleAutosaveTimer,
        enqueueContentSave,
        enqueueTitleSave,
        getContentQueueStatus,
        isTitleCoveredByManualContentSave
    ])

    const resumeAfterPageLifecycle = useCallback(() => {
        if (!isMountedRef.current || !hasLoadedNote.current) return

        const targetNoteId = String(noteIdRef.current || "")
        const controller = contentSaveControllerRef.current
        const targetGeneration = controller.generation

        if (!targetNoteId) return

        lifecycleFlushRef.current = {
            noteId: targetNoteId,
            generation: targetGeneration,
            title: null,
            contentKey: null
        }

        const titleIsDirty = recomputeTitleDirtyState()
        const contentIsDirty = recomputeContentDirtyState()
        const titleQueue = titleSaveQueueRef.current
        const hasTitleQueueWork = (
            titleQueue.pendingByNoteId.has(targetNoteId) ||
            titleQueue.activeByNoteId.has(targetNoteId)
        )

        if (
            titleIsDirty &&
            !hasTitleQueueWork &&
            !titleQueue.failedByNoteId.has(targetNoteId) &&
            !isTitleCoveredByManualContentSave(targetNoteId, titleRef.current)
        ) {
            scheduleTitleSave(targetNoteId, titleRef.current)
        }

        syncContentSavingState()

        if (
            contentIsDirty &&
            getContentQueueStatus(targetNoteId, targetGeneration) === "idle"
        ) {
            setContentLastActivity(Date.now())
        }
    }, [
        getContentQueueStatus,
        isTitleCoveredByManualContentSave,
        recomputeContentDirtyState,
        recomputeTitleDirtyState,
        scheduleTitleSave,
        syncContentSavingState
    ])

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === "hidden") {
                flushForPageLifecycle()
                return
            }

            if (document.visibilityState === "visible") {
                resumeAfterPageLifecycle()
            }
        }

        const handlePageHide = () => {
            // React cleanup remains the source of truth for actual unmounting, including bfcache returns.
            flushForPageLifecycle()
        }

        const handlePageShow = (event) => {
            if (event.persisted) {
                resumeAfterPageLifecycle()
            }
        }

        document.addEventListener("visibilitychange", handleVisibilityChange)
        window.addEventListener("pagehide", handlePageHide)
        window.addEventListener("pageshow", handlePageShow)

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange)
            window.removeEventListener("pagehide", handlePageHide)
            window.removeEventListener("pageshow", handlePageShow)
        }
    }, [flushForPageLifecycle, resumeAfterPageLifecycle])

    useEffect(() => {
        clearContentAutosaveTimer()

        if (!hasLoadedNote.current || !isContentDirty) return undefined

        contentAutosaveTimerRef.current = setTimeout(() => {
            contentAutosaveTimerRef.current = null
            handleSave("autosave")
        }, CONTENT_AUTOSAVE_DELAY_MS)

        return clearContentAutosaveTimer
    }, [clearContentAutosaveTimer, isContentDirty, contentLastActivity, handleSave])

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
                            onClick={() => navigateAfterFlush("/dashboard")}
                            aria-label="Back to dashboard"
                            disabled={isNavigatingAfterFlush}
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

                        <ActiveCollaboratorsStack
                            currentUser={user}
                            currentUserId={currentUserId}
                            isConnected={isConnected}
                        />
                    </div>

                    <div className="editor-toolbar-status">
                        {/* Status area cleared in favor of ActiveCollaboratorsStack in the left toolbar */}
                    </div>

                    <div className="editor-toolbar-actions">
                        {/* Comments button removed from main header, moved permanently to More menu */}

                        <button
                            className="ghost-button collaboration-entry-button hide-on-medium"
                            type="button"
                            onClick={() => {
                                setIsHistoryOpen(true)
                                setIsActivityOpen(false)
                                setIsCommentsOpen(false)
                            }}
                        >
                            <History size={15} />
                            <span className="desktop-label">History</span>
                        </button>

                        <button
                            className="ghost-button collaboration-entry-button hide-on-medium"
                            type="button"
                            onClick={() => {
                                setIsActivityOpen(true)
                                setIsHistoryOpen(false)
                                setIsCommentsOpen(false)
                            }}
                        >
                            <Activity size={15} />
                            <span className="desktop-label">Activity</span>
                        </button>
                        
                        <button
                            className="ghost-button collaboration-entry-button hide-on-medium"
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
                        >
                            <IconSave size={15} />
                            <span className="desktop-label">{isSaving ? "Saving..." : "Save"}</span>
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
                                        className="show-on-medium"
                                        type="button"
                                        role="menuitem"
                                        onClick={() => {
                                            setIsEditorMoreOpen(false)
                                            setIsCommentsOpen(true)
                                            setIsHistoryOpen(false)
                                            setIsActivityOpen(false)
                                        }}
                                    >
                                        <MessageSquare size={14} />
                                        Comments
                                    </button>
                                    <button
                                        className="show-on-medium"
                                        type="button"
                                        role="menuitem"
                                        onClick={() => {
                                            setIsEditorMoreOpen(false)
                                            setIsHistoryOpen(true)
                                            setIsActivityOpen(false)
                                            setIsCommentsOpen(false)
                                        }}
                                    >
                                        <History size={14} />
                                        History
                                    </button>
                                    <button
                                        className="show-on-medium"
                                        type="button"
                                        role="menuitem"
                                        onClick={() => {
                                            setIsEditorMoreOpen(false)
                                            setIsActivityOpen(true)
                                            setIsHistoryOpen(false)
                                            setIsCommentsOpen(false)
                                        }}
                                    >
                                        <Activity size={14} />
                                        Activity
                                    </button>
                                    <button
                                        className="show-on-medium"
                                        type="button"
                                        role="menuitem"
                                        onClick={() => {
                                            setIsEditorMoreOpen(false)
                                            setIsShareOpen(true)
                                        }}
                                    >
                                        <IconUsers size={14} />
                                        Share
                                    </button>
                                    <div className="menu-separator show-on-medium" aria-hidden="true" />
                                    <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => {
                                            setIsEditorMoreOpen(false)
                                            navigateAfterFlush("/settings")
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
                            onBlur={handleTitleBlur}
                            placeholder="Untitled"
                            aria-label="Note title"
                        />

                        <hr className="content-divider" aria-hidden="true" />

                        <CollaborativeTipTap
                            initialContent={content}
                            initialContentJson={contentJson}
                            hasLoaded={hasLoadedNote.current}
                            editorRef={editorRef}
                            onEditorReady={handleEditorReady}
                            onSelectionChange={setEditorSelection}
                            onCommentClicked={(anchorId) => {
                                setIsHistoryOpen(false)
                                setIsActivityOpen(false)
                                // We use a short timeout to ensure the sidebar is mounted if it was closed
                                setTimeout(() => {
                                    window.dispatchEvent(new CustomEvent('sidebar:scroll-to-comment', { detail: { anchorId } }));
                                }, 50)
                            }}
                            onUpdate={(payload) => {
                                if (hasLoadedNote.current) {
                                    setLatestContentDraft(payload)
                                    setIsContentError(false)
                                    setContentLastActivity(Date.now())
                                }
                            }}
                        />
                    </section>

                    {/* Mobile Backdrop for Sidebars */}
                    {(isCommentsOpen || (useOverlay && (isHistoryOpen || isActivityOpen))) && (
                        <div 
                            className={`mobile-backdrop ${(isCommentsOpen || isHistoryOpen || isActivityOpen) ? 'visible' : ''}`} 
                            onClick={() => {
                                setIsCommentsOpen(false)
                                setIsHistoryOpen(false)
                                setIsActivityOpen(false)
                            }}
                            aria-hidden="true"
                            style={{ zIndex: 40 }}
                        />
                    )}

                    {!isHistoryOpen && !isActivityOpen && (
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
                                registerPendingCommentAnchor(anchorId)
                                if (editorRef.current) {
                                    editorRef.current.setCommentMark(anchorId)
                                }
                            }}
                            onCommentDeleted={(anchorId) => {
                                if (editorRef.current) {
                                    editorRef.current.unsetCommentMark(anchorId)
                                }
                            }}
                            isOpen={isCommentsOpen}
                            onClose={() => setIsCommentsOpen(false)}
                        />
                    )}

                    {isHistoryOpen && (
                        <VersionHistoryPanel 
                            noteId={noteId}
                            refreshTrigger={historyRefreshTrigger} 
                            onClose={() => setIsHistoryOpen(false)}
                            isOpen={true}
                        />
                    )}

                    {isActivityOpen && (
                        <ActivitySidebar 
                            noteId={noteId}
                            currentUser={user}

                            onClose={() => setIsActivityOpen(false)}
                            isOpen={true}
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
                        onClose={() => {
                            setIsShareOpen(false)

                        }}
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
