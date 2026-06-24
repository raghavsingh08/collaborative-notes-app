import { useCallback, useEffect, useRef, useState } from "react"
import socket from "../api/socket"

const useNoteSocket = (noteId, onRemoteUpdate) => {
    const [activeUsers, setActiveUsers] = useState([])
    const [typingUsers, setTypingUsers] = useState([])
    const [socketError, setSocketError] = useState("")
    const typingTimers = useRef(new Map())

    useEffect(() => {
        if (!noteId) {
            return undefined
        }

        const timers = typingTimers.current

        const handleNoteUpdated = (payload) => {
            onRemoteUpdate?.(payload)
        }

        const handleNoteSaved = (payload) => {
            onRemoteUpdate?.(payload)
        }

        const handleActiveUsers = (users) => {
            setActiveUsers(users || [])
        }

        const handleTyping = (payload) => {
            if (payload?.noteId !== noteId || !payload?.user) {
                return
            }

            const userId = payload.user._id || payload.user.id || payload.user.email || payload.user.username

            if (!userId) {
                return
            }

            setTypingUsers((currentUsers) => {
                const withoutUser = currentUsers.filter((user) => (
                    (user._id || user.id || user.email || user.username) !== userId
                ))

                return [...withoutUser, payload.user]
            })

            const existingTimer = timers.get(userId)

            if (existingTimer) {
                clearTimeout(existingTimer)
            }

            const timer = setTimeout(() => {
                setTypingUsers((currentUsers) => currentUsers.filter((user) => (
                    (user._id || user.id || user.email || user.username) !== userId
                )))
                timers.delete(userId)
            }, 1500)

            timers.set(userId, timer)
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
        socket.on("note:typing", handleTyping)
        socket.on("note:error", handleNoteError)

        return () => {
            socket.off("note:updated", handleNoteUpdated)
            socket.off("note:saved", handleNoteSaved)
            socket.off("note:active-users", handleActiveUsers)
            socket.off("note:typing", handleTyping)
            socket.off("note:error", handleNoteError)
            timers.forEach((timer) => clearTimeout(timer))
            timers.clear()
            setTypingUsers([])
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

    const emitTyping = useCallback(() => {
        socket.emit("note:typing", {
            noteId
        })
    }, [noteId])

    return {
        activeUsers,
        typingUsers,
        socketError,
        emitUpdate,
        emitSave,
        emitTyping
    }
}

export default useNoteSocket
