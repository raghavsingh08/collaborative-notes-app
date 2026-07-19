let ioInstance = null

const setSocketServer = (io) => {
    ioInstance = io
}

const getSocketServer = () => ioInstance

const getV2NoteRoom = (noteId) => `note:v2:${String(noteId).trim()}`

const emitNoteRestored = ({ noteId, versionId, restoredBy }) => {
    const io = getSocketServer()

    if (!io || !noteId || !versionId) {
        return
    }

    io.to(getV2NoteRoom(noteId)).emit("note:restored", {
        noteId: String(noteId),
        versionId: String(versionId),
        restoredBy: restoredBy ? String(restoredBy) : null
    })
}

const emitNoteTitleUpdated = ({ noteId, title, updatedBy, updatedAt }) => {
    const io = getSocketServer()
    const actorId = updatedBy?._id || updatedBy?.id || updatedBy

    if (!io || !noteId || !actorId || typeof title !== "string") {
        return
    }

    io.to(getV2NoteRoom(noteId)).emit("note:title-updated", {
        noteId: String(noteId),
        title,
        updatedBy: {
            id: String(actorId),
            name: updatedBy?.name || updatedBy?.username || updatedBy?.email || null
        },
        updatedAt: updatedAt instanceof Date ? updatedAt.toISOString() : updatedAt || null
    })
}

// Comment sockets are invalidation notifications only; clients refetch from MongoDB.
const emitCommentUpdate = ({ noteId, threadId, replyId, action, updatedBy }) => {
    const io = getSocketServer()

    if (!io || !noteId || !threadId) {
        return
    }

    const payload = {
        noteId: String(noteId),
        threadId: String(threadId),
        action,
        updatedBy: updatedBy ? String(updatedBy) : null
    }

    if (replyId) {
        payload.replyId = String(replyId)
    }

    io.to(getV2NoteRoom(noteId)).emit("comments:updated", payload)
}

export {
    emitCommentUpdate,
    emitNoteRestored,
    emitNoteTitleUpdated,
    getSocketServer,
    setSocketServer
}
