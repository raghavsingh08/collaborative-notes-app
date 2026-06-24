import { useCallback, useEffect, useState } from "react"
import socket from "../api/socket"

const useNoteSocket = (noteId, onRemoteUpdate) => {
    const [activeUsers, setActiveUsers] = useState([])
    const [socketError, setSocketError] = useState("")

    useEffect(() => {
        if (!noteId) {
            return undefined
        }

        const handleNoteUpdated = (payload) => {
            onRemoteUpdate?.(payload)
        }

        const handleNoteSaved = (payload) => {
            onRemoteUpdate?.(payload)
        }

        const handleActiveUsers = (users) => {
            setActiveUsers(users || [])
        }

        const handleNoteError = (message) => {
            setSocketError(message || "Socket error")
        }

        if (!socket.connected) {
            socket.connect()
        }

        socket.emit("note:join", noteId)
        socket.on("note:updated", handleNoteUpdated)
        socket.on("note:saved", handleNoteSaved)
        socket.on("note:active-users", handleActiveUsers)
        socket.on("note:error", handleNoteError)

        return () => {
            socket.off("note:updated", handleNoteUpdated)
            socket.off("note:saved", handleNoteSaved)
            socket.off("note:active-users", handleActiveUsers)
            socket.off("note:error", handleNoteError)
            socket.disconnect()
        }
    }, [noteId, onRemoteUpdate])

    const emitUpdate = useCallback((title, content) => {
        socket.emit("note:update", {
            noteId,
            title,
            content
        })
    }, [noteId])

    const emitSave = useCallback((title, content) => {
        socket.emit("note:save", {
            noteId,
            title,
            content
        })
    }, [noteId])

    return {
        activeUsers,
        socketError,
        emitUpdate,
        emitSave
    }
}

export default useNoteSocket
