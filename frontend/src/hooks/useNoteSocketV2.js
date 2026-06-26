import { useEffect, useState } from "react"
import socket from "../api/socket"

const useNoteSocketV2 = (noteId) => {
    const [socketError, setSocketError] = useState("")
    const [isConnected, setIsConnected] = useState(socket.connected)
    const [isReconnecting, setIsReconnecting] = useState(false)

    useEffect(() => {
        if (!noteId) {
            return undefined
        }

        if (!socket.connected) {
            socket.connect()
        } else {
            setIsConnected(true)
        }

        const handleConnect = () => {
            setIsConnected(true)
            setIsReconnecting(false)
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

        // Emit V2 join event
        socket.emit("v2:note:join", { noteId })

        const handleJoined = (payload) => {
            // Join acknowledged
        }
        socket.on("v2:note:joined", handleJoined)

        return () => {
            // Emit V2 leave event
            socket.emit("v2:note:leave", { noteId })
            
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
