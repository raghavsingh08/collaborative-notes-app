import mongoose from "mongoose"
import Note from "../models/note.model.js"
import {
    applyAndPersistYjsUpdate,
    getAuthoritativeYDocEntry,
    getEncodedYjsState,
    releaseAuthoritativeYDoc
} from "../utils/yjsNoteState.js"

const activeUsersByRoom = new Map()

const getNoteRoom = (noteId) => `note:${noteId}`

const normalizeNoteId = (noteId) => {
    if (noteId === undefined || noteId === null) {
        return ""
    }

    return String(noteId).trim()
}

const getV2NoteRoom = (noteId) => `note:v2:${normalizeNoteId(noteId)}`

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

const releaseV2YDocIfRoomEmpty = (io, noteId, room, leavingSocketId = null) => {
    const roomSockets = io.sockets.adapter.rooms.get(room)
    const remainingSocketCount = Array.from(roomSockets || [])
        .filter((socketId) => socketId !== leavingSocketId)
        .length

    if (remainingSocketCount === 0) {
        releaseAuthoritativeYDoc(noteId)
    }
}

const emitActiveUsers = (io, room) => {
    const activeUsers = Array.from(activeUsersByRoom.get(room)?.values() || [])
    io.to(room).emit("note:active-users", activeUsers)
}

const addActiveUser = (io, socket, room) => {
    if (!activeUsersByRoom.has(room)) {
        activeUsersByRoom.set(room, new Map())
    }

    activeUsersByRoom.get(room).set(socket.id, getUserPayload(socket.user))
    socket.data.noteRooms = socket.data.noteRooms || new Set()
    socket.data.noteRooms.add(room)
    emitActiveUsers(io, room)
}

const removeActiveUser = (io, socket, room) => {
    const activeUsers = activeUsersByRoom.get(room)

    if (!activeUsers) {
        return
    }

    activeUsers.delete(socket.id)

    if (activeUsers.size === 0) {
        activeUsersByRoom.delete(room)
        return
    }

    emitActiveUsers(io, room)
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
            addActiveUser(io, socket, room)
        } catch {
            socket.emit("note:error", "Unable to join note")
        }
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
        socket.leave(room)
        removeV2NoteRoom(socket, room)
        releaseV2YDocIfRoomEmpty(io, noteId, room)
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

            socket.to(room).emit("v2:awareness:update", {
                noteId,
                awareness: payload?.awareness
            })
        } catch {
            // Silently ignore broadcast failures for ephemeral awareness
        }
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
            releaseV2YDocIfRoomEmpty(io, noteId, room, socket.id)
        })
    })

    socket.on("disconnect", () => {
        const rooms = socket.data.noteRooms || new Set()

        rooms.forEach((room) => {
            removeActiveUser(io, socket, room)
        })
    })
}

export { registerNoteSocketHandlers }
