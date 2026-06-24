import mongoose from "mongoose"
import Note from "../models/note.model.js"

const activeUsersByRoom = new Map()

const getNoteRoom = (noteId) => `note:${noteId}`

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

    socket.on("disconnect", () => {
        const rooms = socket.data.noteRooms || new Set()

        rooms.forEach((room) => {
            removeActiveUser(io, socket, room)
        })
    })
}

export { registerNoteSocketHandlers }
