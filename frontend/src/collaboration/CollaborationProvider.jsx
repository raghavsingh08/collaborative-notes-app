import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import * as Y from "yjs"
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness"
import socket from "../api/socket"

const CollaborationContext = createContext(null)
const EDITING_TIMEOUT_MS = 3000
const IDLE_TIMEOUT_MS = 60000
const POINTER_ACTIVITY_THROTTLE_MS = 750

export const CollaborationProvider = ({ children, noteId, currentUser }) => {
    // Initialize the shared Yjs document and its Awareness instance.
    const ydoc = useMemo(() => new Y.Doc(), [])
    const awareness = useMemo(() => new Awareness(ydoc), [ydoc])
    const [syncStatus, setSyncStatus] = useState({ isComplete: false, useFallbackJson: false })
    const initializedAwarenessUser = useRef(null)

    // Update local awareness identity when currentUser is loaded
    useEffect(() => {
        const currentUserId = currentUser?.id || currentUser?._id
        const initializationKey = currentUserId ? `${awareness.clientID}:${currentUserId}` : null

        if (currentUser && initializedAwarenessUser.current !== initializationKey) {
            awareness.setLocalStateField("user", {
                id: String(currentUserId),
                userId: String(currentUserId),
                name: currentUser.name || currentUser.username || "Anonymous",
                avatar: currentUser.avatar || currentUser.profileImage || null,
                color: "#ff0000" // Deterministic for now as requested
            })
            initializedAwarenessUser.current = initializationKey
        }
    }, [currentUser, awareness, noteId])

    useEffect(() => {
        if (!currentUser) {
            return undefined
        }

        let typingTimer = null
        let idleTimer = null
        let lastPointerActivity = 0

        const setPresenceStatus = (status) => {
            if (awareness.getLocalState()?.presence?.status === status) {
                return
            }

            awareness.setLocalStateField("presence", {
                status,
                lastActivity: Date.now()
            })
        }

        const scheduleIdle = () => {
            if (idleTimer) {
                clearTimeout(idleTimer)
            }

            idleTimer = setTimeout(() => {
                if (typingTimer) {
                    clearTimeout(typingTimer)
                    typingTimer = null
                }

                setPresenceStatus("idle")
            }, IDLE_TIMEOUT_MS)
        }

        const markViewing = () => {
            if (awareness.getLocalState()?.presence?.status !== "editing") {
                setPresenceStatus("viewing")
            }

            scheduleIdle()
        }

        const markEditing = () => {
            setPresenceStatus("editing")
            scheduleIdle()

            if (typingTimer) {
                clearTimeout(typingTimer)
            }

            typingTimer = setTimeout(() => {
                typingTimer = null
                setPresenceStatus("viewing")
            }, EDITING_TIMEOUT_MS)
        }

        const isEditorTarget = (target) => target instanceof Element && Boolean(target.closest(".ProseMirror"))
        const isEditingKey = (event) => {
            if (event.ctrlKey || event.metaKey || event.altKey) {
                return false
            }

            return event.key.length === 1 || ["Backspace", "Delete", "Enter"].includes(event.key)
        }

        const handleKeyDown = (event) => {
            if (isEditorTarget(event.target) && isEditingKey(event)) {
                markEditing()
                return
            }

            markViewing()
        }

        const handlePointerActivity = () => {
            const now = Date.now()

            if (now - lastPointerActivity < POINTER_ACTIVITY_THROTTLE_MS) {
                return
            }

            lastPointerActivity = now
            markViewing()
        }

        setPresenceStatus("viewing")
        scheduleIdle()
        document.addEventListener("keydown", handleKeyDown)
        document.addEventListener("pointermove", handlePointerActivity)
        document.addEventListener("pointerdown", handlePointerActivity)

        return () => {
            document.removeEventListener("keydown", handleKeyDown)
            document.removeEventListener("pointermove", handlePointerActivity)
            document.removeEventListener("pointerdown", handlePointerActivity)

            if (typingTimer) {
                clearTimeout(typingTimer)
            }

            if (idleTimer) {
                clearTimeout(idleTimer)
            }
        }
    }, [awareness, currentUser, noteId])

    useEffect(() => {
        if (!socket || !noteId || !ydoc || !awareness) return undefined

        const getLocalAwarenessUser = () => {
            const currentUserId = currentUser?.id || currentUser?._id

            if (!currentUserId) {
                return null
            }

            return {
                id: String(currentUserId),
                userId: String(currentUserId),
                name: currentUser.name || currentUser.username || "Anonymous",
                avatar: currentUser.avatar || currentUser.profileImage || null,
                color: "#ff0000"
            }
        }

        const setLocalAwarenessUser = () => {
            const localUser = getLocalAwarenessUser()

            if (localUser) {
                awareness.setLocalStateField("user", localUser)
            }
        }

        const broadcastLocalAwareness = () => {
            if (awareness.getLocalState() === null) {
                return
            }

            const awarenessUpdate = encodeAwarenessUpdate(awareness, [awareness.clientID])
            socket.emit("v2:awareness:update", {
                noteId,
                clientId: awareness.clientID,
                awareness: Array.from(awarenessUpdate)
            })
        }

        const announceConnectedAwareness = () => {
            setLocalAwarenessUser()
            broadcastLocalAwareness()
            socket.emit("v2:awareness:sync-request", { noteId })
        }

        setSyncStatus({ isComplete: false, useFallbackJson: false })

        // 0. Request authoritative Y.Doc state from the backend
        socket.emit("v2:yjs:sync-request", { noteId })

        const handleSyncResponse = (payload) => {
            if (payload?.noteId !== noteId) return

            const stateLength = payload?.state?.length || 0
            let needsFallback = true

            // Only apply state if it's not null and actually contains data.
            // An empty/invalid Y.Doc state array is typically 2 bytes ([0, 0]).
            if (payload?.state && stateLength > 2) {
                try {
                    window.isApplyingRemoteSync = true
                    const stateBuffer = Uint8Array.from(payload.state)
                    Y.applyUpdate(ydoc, stateBuffer, "remote-socket")
                    needsFallback = false
                } catch (err) {
                    console.error("Failed to apply authoritative Yjs sync state", err)
                } finally {
                    // Delay unlocking to let TipTap digest the remote update without triggering autosave
                    setTimeout(() => {
                        window.isApplyingRemoteSync = false
                    }, 50)
                }
            }
            
            setSyncStatus({ isComplete: true, useFallbackJson: needsFallback })
            announceConnectedAwareness()
        }

        socket.on("v2:yjs:sync-response", handleSyncResponse)

        // 1. Listen for local Y.Doc updates and emit to socket
        const handleLocalUpdate = (update, origin) => {
            // Prevent infinite echo loop by ignoring updates that originated from the socket
            if (origin === "remote-socket" || window.isInitializingYdoc) {
                return
            }

            // Convert Uint8Array update to Array for safe JSON serialization over Socket.io
            socket.emit("v2:yjs:update", {
                noteId,
                update: Array.from(update)
            })
        }

        ydoc.on("update", handleLocalUpdate)

        // 2. Listen for incoming remote updates from the socket
        const handleRemoteUpdate = (payload) => {
            // Ensure payload is for this note
            if (payload?.noteId !== noteId || !payload?.update) {
                return
            }

            // Convert Array back to Uint8Array and apply to local Y.Doc
            // Pass "remote-socket" as origin to prevent the `handleLocalUpdate` listener from re-emitting it
            try {
                const updateBuffer = Uint8Array.from(payload.update)
                Y.applyUpdate(ydoc, updateBuffer, "remote-socket")
            } catch (err) {
                console.error("Failed to apply Y.Doc update", err)
            }
        }

        socket.on("v2:yjs:update", handleRemoteUpdate)

        // 3. Listen for local Awareness updates and emit to socket
        let awarenessUpdateTimeout = null;
        let changedClientsAccumulator = new Set();

        const handleLocalAwarenessUpdate = ({ added, updated, removed }, origin) => {
            if (origin === "remote-socket") {
                return
            }

            // Accumulate all client changes that happen within this animation frame
            added.concat(updated).concat(removed).forEach(clientId => {
                changedClientsAccumulator.add(clientId)
            })
            
            // Throttle awareness updates using requestAnimationFrame to prevent socket flooding
            if (awarenessUpdateTimeout) {
                cancelAnimationFrame(awarenessUpdateTimeout)
            }

            awarenessUpdateTimeout = requestAnimationFrame(() => {
                const clientsToUpdate = Array.from(changedClientsAccumulator)
                changedClientsAccumulator.clear()

                if (clientsToUpdate.length > 0) {
                    const awarenessUpdate = encodeAwarenessUpdate(awareness, clientsToUpdate)
                    socket.emit("v2:awareness:update", {
                        noteId,
                        clientId: awareness.clientID,
                        awareness: Array.from(awarenessUpdate)
                    })
                }
            })
        }

        awareness.on("update", handleLocalAwarenessUpdate)

        // 4. Listen for incoming remote awareness updates from the socket
        const handleRemoteAwarenessUpdate = (payload) => {
            if (payload?.noteId !== noteId || !payload?.awareness) {
                return
            }

            try {
                const awarenessBuffer = Uint8Array.from(payload.awareness)
                applyAwarenessUpdate(awareness, awarenessBuffer, "remote-socket")
            } catch (err) {
                console.error("Failed to apply awareness update", err)
            }
        }

        const handleNoteJoined = (payload = {}) => {
            if (payload?.noteId !== noteId) {
                return
            }

            announceConnectedAwareness()
        }

        const handlePeerAwarenessRequest = (payload = {}) => {
            if (payload?.noteId !== noteId) {
                return
            }

            broadcastLocalAwareness()
        }

        const handlePeerJoined = (payload = {}) => {
            if (payload?.noteId !== noteId) {
                return
            }

            broadcastLocalAwareness()
        }

        const handleSocketConnect = () => {
            setLocalAwarenessUser()
        }

        const handleRemoteAwarenessRemoval = (payload = {}) => {
            if (payload?.noteId !== noteId || !Array.isArray(payload.clientIds)) {
                return
            }

            const clientIds = payload.clientIds.filter(Number.isSafeInteger)

            if (clientIds.length > 0) {
                removeAwarenessStates(awareness, clientIds, "remote-socket")
            }
        }

        socket.on("v2:awareness:update", handleRemoteAwarenessUpdate)
        socket.on("v2:awareness:remove", handleRemoteAwarenessRemoval)
        socket.on("v2:awareness:sync-request", handlePeerAwarenessRequest)
        socket.on("v2:note:joined", handleNoteJoined)
        socket.on("v2:peer:joined", handlePeerJoined)
        socket.on("connect", handleSocketConnect)

        return () => {
            // Cancel any pending throttled awareness updates
            if (awarenessUpdateTimeout) {
                cancelAnimationFrame(awarenessUpdateTimeout)
            }

            // Now clean up all listeners
            ydoc.off("update", handleLocalUpdate)
            socket.off("v2:yjs:sync-response", handleSyncResponse)
            socket.off("v2:yjs:update", handleRemoteUpdate)
            awareness.off("update", handleLocalAwarenessUpdate)
            socket.off("v2:awareness:update", handleRemoteAwarenessUpdate)
            socket.off("v2:awareness:remove", handleRemoteAwarenessRemoval)
            socket.off("v2:awareness:sync-request", handlePeerAwarenessRequest)
            socket.off("v2:note:joined", handleNoteJoined)
            socket.off("v2:peer:joined", handlePeerJoined)
            socket.off("connect", handleSocketConnect)
        }
    }, [ydoc, awareness, currentUser, noteId])

    return (
        <CollaborationContext.Provider value={{ ydoc, awareness, syncStatus }}>
            {children}
        </CollaborationContext.Provider>
    )
}

export const useCollaboration = () => useContext(CollaborationContext)
