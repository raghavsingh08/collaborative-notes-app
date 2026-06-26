let ioInstance = null

const setSocketServer = (io) => {
    ioInstance = io
}

const getSocketServer = () => ioInstance

const getV2NoteRoom = (noteId) => `note:v2:${String(noteId).trim()}`

// Comment sockets are invalidation notifications only; clients refetch from MongoDB.
const emitCommentUpdate = ({ noteId, threadId, action, updatedBy }) => {
    const io = getSocketServer()

    if (!io || !noteId || !threadId) {
        return
    }

    io.to(getV2NoteRoom(noteId)).emit("comments:updated", {
        noteId: String(noteId),
        threadId: String(threadId),
        action,
        updatedBy: updatedBy ? String(updatedBy) : null
    })
}

export {
    emitCommentUpdate,
    getSocketServer,
    setSocketServer
}
