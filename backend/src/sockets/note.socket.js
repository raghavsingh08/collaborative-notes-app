import mongoose from "mongoose"
import Note from "../models/note.model.js"
import {
    applyAndPersistYjsUpdate,
    getAuthoritativeYDocEntry,
    getEncodedYjsState,
    releaseAuthoritativeYDoc
} from "../utils/yjsNoteState.js"

const activeUsersByNote = new Map()

const getNoteRoom = (noteId) => `note:${noteId}`

const normalizeNoteId = (noteId) => {
    if (noteId === undefined || noteId === null) {
        return ""
    }

    return String(noteId).trim()
}

const getV2NoteRoom = (noteId) => `note:v2:${normalizeNoteId(noteId)}`

const getWorkspaceUserRoom = (userId) => `workspace:user:${String(userId)}`

const getUserPayload = (user) => ({
    _id: user._id,
    username: user.username,
    email: user.email
})

const findAccessibleNote = (noteId, userId) => {
    if (!mongoose.isValidObjectId(noteId)) {
        return null
    }

    return Note.findOne({
        _id: noteId,
        $or: [
            { owner: userId },
            { sharedWith: userId }
        ]
    })
}

const findAccessibleSocketNote = (socket, noteId) => {
    if (!socket.user?._id) {
        return null
    }

    return findAccessibleNote(normalizeNoteId(noteId), socket.user._id)
}

const getPayloadNoteId = (payload) => normalizeNoteId(payload?.noteId ?? payload)

const getRoomSocketCount = (io, room) => io.sockets.adapter.rooms.get(room)?.size || 0

const addV2NoteRoom = (socket, noteId, room) => {
    socket.data.v2NoteRooms = socket.data.v2NoteRooms || new Map()
    socket.data.v2NoteRooms.set(room, noteId)
}

const removeV2NoteRoom = (socket, room) => {
    socket.data.v2NoteRooms?.delete(room)
}

const rememberV2AwarenessClient = (socket, room, clientId) => {
    if (!Number.isSafeInteger(clientId) || clientId < 0 || clientId > 0xffffffff) {
        return
    }

    socket.data.v2AwarenessClients = socket.data.v2AwarenessClients || new Map()

    if (!socket.data.v2AwarenessClients.has(room)) {
        socket.data.v2AwarenessClients.set(room, new Set())
    }

    socket.data.v2AwarenessClients.get(room).add(clientId)
}

const emitV2AwarenessRemoval = (socket, noteId, room) => {
    const clientIds = Array.from(socket.data.v2AwarenessClients?.get(room) || [])

    if (clientIds.length > 0) {
        socket.to(room).emit("v2:awareness:remove", {
            noteId: String(noteId),
            clientIds
        })
    }

    socket.data.v2AwarenessClients?.delete(room)
}

const releaseV2YDocIfRoomEmpty = (io, noteId, room, leavingSocketId = null) => {
    const roomSockets = io.sockets.adapter.rooms.get(room)
    const remainingSocketCount = Array.from(roomSockets || [])
        .filter((socketId) => socketId !== leavingSocketId)
        .length

    if (remainingSocketCount === 0) {
        releaseAuthoritativeYDoc(noteId)
    }
}

const getActiveUsers = (noteId) => {
    const usersById = new Map()

    activeUsersByNote.get(String(noteId))?.forEach((user) => {
        usersById.set(String(user._id), user)
    })

    return Array.from(usersById.values())
}

const emitWorkspacePresence = async (io, noteId) => {
    const note = await Note.findById(noteId).select("owner sharedWith").lean()

    if (!note) {
        return
    }

    const audience = new Set([
        String(note.owner),
        ...(note.sharedWith || []).map((userId) => String(userId))
    ])
    const payload = {
        noteId: String(noteId),
        activeUsers: getActiveUsers(noteId)
    }

    audience.forEach((userId) => {
        io.to(getWorkspaceUserRoom(userId)).emit("workspace:presence:updated", payload)
    })
}

const emitActiveUsers = (io, noteId) => {
    io.to(getNoteRoom(noteId)).emit("note:active-users", getActiveUsers(noteId))
    emitWorkspacePresence(io, noteId).catch(() => {
        // Workspace presence is ephemeral and must never disrupt note collaboration.
    })
}

const removeActiveUser = (io, socket, noteId = socket.data.activePresenceNoteId) => {
    const normalizedNoteId = normalizeNoteId(noteId)
    const activeUsers = activeUsersByNote.get(normalizedNoteId)

    if (!activeUsers) {
        return
    }

    activeUsers.delete(socket.id)

    if (activeUsers.size === 0) {
        activeUsersByNote.delete(normalizedNoteId)
    }

    if (socket.data.activePresenceNoteId === normalizedNoteId) {
        delete socket.data.activePresenceNoteId
    }

    emitActiveUsers(io, normalizedNoteId)
}

const addActiveUser = (io, socket, note) => {
    const noteId = String(note._id)
    const previousNoteId = socket.data.activePresenceNoteId

    if (previousNoteId && previousNoteId !== noteId) {
        removeActiveUser(io, socket, previousNoteId)
    }

    if (!activeUsersByNote.has(noteId)) {
        activeUsersByNote.set(noteId, new Map())
    }

    activeUsersByNote.get(noteId).set(socket.id, getUserPayload(socket.user))
    socket.data.activePresenceNoteId = noteId
    emitActiveUsers(io, noteId)
}

const registerNoteSocketHandlers = (io, socket) => {
    socket.on("note:join", async (noteId) => {
        try {
            const note = await findAccessibleNote(noteId, socket.user._id)

            if (!note) {
                socket.emit("note:error", "Note not found or access denied")
                return
            }

            const room = getNoteRoom(noteId)
            socket.join(room)
            addActiveUser(io, socket, note)
        } catch {
            socket.emit("note:error", "Unable to join note")
        }
    })

    socket.on("note:leave", (noteId) => {
        const normalizedNoteId = normalizeNoteId(noteId)

        if (!mongoose.isValidObjectId(normalizedNoteId)) {
            return
        }

        socket.leave(getNoteRoom(normalizedNoteId))
        removeActiveUser(io, socket, normalizedNoteId)
    })

    socket.on("note:update", async ({ noteId, title, content } = {}) => {
        try {
            const note = await findAccessibleNote(noteId, socket.user._id)

            if (!note) {
                socket.emit("note:error", "Note not found or access denied")
                return
            }

            socket.to(getNoteRoom(noteId)).emit("note:updated", {
                noteId,
                title,
                content,
                updatedBy: getUserPayload(socket.user)
            })
        } catch {
            socket.emit("note:error", "Unable to update note")
        }
    })

    socket.on("note:typing", async ({ noteId } = {}) => {
        try {
            const note = await findAccessibleNote(noteId, socket.user._id)

            if (!note) {
                socket.emit("note:error", "Note not found or access denied")
                return
            }

            socket.to(getNoteRoom(noteId)).emit("note:typing", {
                noteId,
                user: getUserPayload(socket.user)
            })
        } catch {
            socket.emit("note:error", "Unable to send typing status")
        }
    })

    socket.on("note:save", async ({ noteId, title, content } = {}) => {
        try {
            const note = await findAccessibleNote(noteId, socket.user._id)

            if (!note) {
                socket.emit("note:error", "Note not found or access denied")
                return
            }

            note.title = title
            note.content = content
            await note.save()

            io.to(getNoteRoom(noteId)).emit("note:saved", {
                noteId,
                title: note.title,
                content: note.content,
                savedBy: getUserPayload(socket.user),
                updatedAt: note.updatedAt
            })
        } catch {
            socket.emit("note:error", "Unable to save note")
        }
    })

    socket.on("v2:note:join", async (payload = {}) => {
        const noteId = getPayloadNoteId(payload)

        try {
            const note = await findAccessibleSocketNote(socket, noteId)

            if (!note) {
                socket.emit("v2:note:error", "Note not found or access denied")
                return
            }

            await getAuthoritativeYDocEntry(note)

            const room = getV2NoteRoom(noteId)
            await socket.join(room)
            addV2NoteRoom(socket, noteId, room)
            addActiveUser(io, socket, note)
            socket.emit("v2:note:joined", { noteId })

            const peerJoinedPayload = {
                noteId,
                socketId: socket.id,
                userId: String(socket.user._id)
            }

            socket.to(room).emit("v2:peer:joined", peerJoinedPayload)
        } catch {
            socket.emit("v2:note:error", "Unable to join note")
        }
    })

    socket.on("v2:note:leave", (payload = {}) => {
        const noteId = getPayloadNoteId(payload)

        if (!mongoose.isValidObjectId(noteId)) {
            return
        }

        const room = getV2NoteRoom(noteId)
        emitV2AwarenessRemoval(socket, noteId, room)
        socket.leave(room)
        removeV2NoteRoom(socket, room)
        removeActiveUser(io, socket, noteId)
        releaseV2YDocIfRoomEmpty(io, noteId, room)
    })

    socket.on("workspace:presence:subscribe", async () => {
        try {
            const userId = String(socket.user._id)
            await socket.join(getWorkspaceUserRoom(userId))

            const accessibleNotes = await Note.find({
                $or: [
                    { owner: socket.user._id },
                    { sharedWith: socket.user._id }
                ]
            }).select("_id").lean()

            const notes = accessibleNotes
                .map((note) => ({
                    noteId: String(note._id),
                    activeUsers: getActiveUsers(note._id)
                }))
                .filter((entry) => entry.activeUsers.length > 0)

            socket.emit("workspace:presence:snapshot", { notes })
        } catch {
            socket.emit("workspace:presence:error", "Unable to load workspace presence")
        }
    })

    socket.on("workspace:presence:unsubscribe", () => {
        socket.leave(getWorkspaceUserRoom(socket.user._id))
    })

    socket.on("v2:yjs:update", async (payload = {}) => {
        const noteId = getPayloadNoteId(payload)

        try {
            const note = await findAccessibleSocketNote(socket, noteId)

            if (!note) {
                socket.emit("v2:note:error", "Note not found or access denied")
                return
            }

            const room = getV2NoteRoom(noteId)
            const persistenceResult = await applyAndPersistYjsUpdate(note, payload?.update)

            if (persistenceResult.reason !== "ok") {
                socket.emit("v2:note:error", "Invalid Yjs update")
                return
            }

            socket.to(room).emit("v2:yjs:update", {
                noteId,
                update: payload?.update
            })
        } catch {
            socket.emit("v2:note:error", "Unable to broadcast update")
        }
    })

    socket.on("v2:awareness:update", async (payload = {}) => {
        const noteId = getPayloadNoteId(payload)

        try {
            const note = await findAccessibleSocketNote(socket, noteId)

            if (!note) {
                return
            }

            const room = getV2NoteRoom(noteId)
            rememberV2AwarenessClient(socket, room, payload?.clientId)

            socket.to(room).emit("v2:awareness:update", {
                noteId,
                awareness: payload?.awareness
            })
        } catch {
            // Silently ignore broadcast failures for ephemeral awareness
        }
    })

    socket.on("v2:awareness:sync-request", (payload = {}) => {
        const noteId = getPayloadNoteId(payload)

        if (!mongoose.isValidObjectId(noteId)) {
            return
        }

        const room = getV2NoteRoom(noteId)

        if (!socket.rooms.has(room)) {
            return
        }

        socket.to(room).emit("v2:awareness:sync-request", {
            noteId,
            requestingSocketId: socket.id
        })
    })

    socket.on("v2:yjs:sync-request", async (payload = {}) => {
        const noteId = getPayloadNoteId(payload)

        try {
            const note = await findAccessibleSocketNote(socket, noteId)

            if (!note) {
                socket.emit("v2:note:error", "Note not found or access denied")
                return
            }

            const state = await getEncodedYjsState(note)

            socket.emit("v2:yjs:sync-response", {
                noteId,
                state: state ? Array.from(state) : null
            })
        } catch {
            socket.emit("v2:note:error", "Unable to sync note")
        }
    })

    socket.on("disconnecting", () => {
        const v2Rooms = socket.data.v2NoteRooms || new Map()

        v2Rooms.forEach((noteId, room) => {
            emitV2AwarenessRemoval(socket, noteId, room)
            releaseV2YDocIfRoomEmpty(io, noteId, room, socket.id)
        })

        removeActiveUser(io, socket)
    })
}

export { registerNoteSocketHandlers }
