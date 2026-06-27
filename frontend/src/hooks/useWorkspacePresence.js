import { useEffect, useState } from "react"
import socket from "../api/socket"

const toPresenceMap = (entries = []) => {
    return Object.fromEntries(
        entries
            .filter((entry) => entry?.noteId && Array.isArray(entry.activeUsers))
            .map((entry) => [String(entry.noteId), entry.activeUsers])
    )
}

const useWorkspacePresence = () => {
    const [presenceByNoteId, setPresenceByNoteId] = useState({})

    useEffect(() => {
        const subscribe = () => {
            socket.emit("workspace:presence:subscribe")
        }

        const handleSnapshot = (payload = {}) => {
            setPresenceByNoteId(toPresenceMap(payload.notes))
        }

        const handleUpdate = ({ noteId, activeUsers } = {}) => {
            if (!noteId || !Array.isArray(activeUsers)) {
                return
            }

            setPresenceByNoteId((current) => {
                const next = { ...current }

                if (activeUsers.length === 0) {
                    delete next[String(noteId)]
                } else {
                    next[String(noteId)] = activeUsers
                }

                return next
            })
        }

        socket.on("connect", subscribe)
        socket.on("workspace:presence:snapshot", handleSnapshot)
        socket.on("workspace:presence:updated", handleUpdate)

        if (socket.connected) {
            subscribe()
        } else {
            socket.connect()
        }

        return () => {
            if (socket.connected) {
                socket.emit("workspace:presence:unsubscribe")
            }

            socket.off("connect", subscribe)
            socket.off("workspace:presence:snapshot", handleSnapshot)
            socket.off("workspace:presence:updated", handleUpdate)
        }
    }, [])

    return presenceByNoteId
}

export default useWorkspacePresence
