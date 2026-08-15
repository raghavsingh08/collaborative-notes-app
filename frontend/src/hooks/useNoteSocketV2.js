import { useEffect, useRef, useState } from "react"
import socket from "../api/socket"

const useNoteSocketV2 = (noteId) => {
    const [socketError, setSocketError] = useState("")
    const [isConnected, setIsConnected] = useState(socket.connected)
    const [isReconnecting, setIsReconnecting] = useState(false)
    const currentNoteIdRef = useRef(noteId)
    const lastJoinedConnectionRef = useRef(null)

    currentNoteIdRef.current = noteId

    useEffect(() => {
        if (!noteId) {
            return undefined
        }

        let isActive = true

        const joinCurrentNote = () => {
            const currentNoteId = currentNoteIdRef.current
            const socketId = socket.id

            if (!isActive || !currentNoteId || !socket.connected || !socketId) {
                return
            }

            const alreadyJoined = lastJoinedConnectionRef.current
            if (
                alreadyJoined?.socketId === socketId &&
                alreadyJoined.noteId === String(currentNoteId)
            ) {
                return
            }

            lastJoinedConnectionRef.current = {
                socketId,
                noteId: String(currentNoteId)
            }
            socket.emit("v2:note:join", { noteId: currentNoteId })
        }

        const handleConnect = () => {
            setIsConnected(true)
            setIsReconnecting(false)
            joinCurrentNote()
        }
        
        const handleDisconnect = (reason) => {
            setIsConnected(false)
            // If the disconnect was intentionally triggered by the client/server, it's truly disconnected.
            // Otherwise, socket.io automatically enters its reconnection loop.
            if (reason === "io server disconnect" || reason === "io client disconnect") {
                setIsReconnecting(false)
            } else {
                setIsReconnecting(true)
            }
        }

        const handleConnectError = (err) => {
            setIsConnected(false)
            setIsReconnecting(true)
            setSocketError(err.message || "Socket connection error")
        }

        socket.on("connect", handleConnect)
        socket.on("disconnect", handleDisconnect)
        socket.on("connect_error", handleConnectError)

        const handleJoined = () => {
            // Join acknowledged
        }
        socket.on("v2:note:joined", handleJoined)

        if (socket.connected) {
            setIsConnected(true)
            joinCurrentNote()
        } else {
            socket.connect()
        }

        return () => {
            isActive = false

            if (socket.connected) {
                socket.emit("v2:note:leave", { noteId })
            }

            if (lastJoinedConnectionRef.current?.noteId === String(noteId)) {
                lastJoinedConnectionRef.current = null
            }
            
            socket.off("connect", handleConnect)
            socket.off("disconnect", handleDisconnect)
            socket.off("connect_error", handleConnectError)
            socket.off("v2:note:joined", handleJoined)
            
            // Note: We don't call socket.disconnect() here because other components
            // (like notifications or a concurrently open V1 note) might be using the singleton.
            // V1 currently calls disconnect() on unmount, which we leave untouched.
        }
    }, [noteId])

    return {
        socketError,
        isConnected,
        isReconnecting
    }
}

export default useNoteSocketV2
