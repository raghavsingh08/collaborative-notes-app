let ioInstance = null

const setSocketServer = (io) => {
    ioInstance = io
}

const getSocketServer = () => ioInstance

const getV2NoteRoom = (noteId) => `note:v2:${String(noteId).trim()}`

const getUserNotificationRoom = (userId) => `user:${String(userId).trim()}`

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

// Activity sockets are invalidation notifications only; clients refetch from MongoDB.
const emitActivityUpdated = ({ noteId, activityId, type, actorId, createdAt }) => {
    const io = getSocketServer()

    if (!io || !noteId || !activityId || !type || !actorId || !createdAt) {
        return
    }

    io.to(getV2NoteRoom(noteId)).emit("activity:updated", {
        noteId: String(noteId),
        activityId: String(activityId),
        type,
        actorId: String(actorId),
        createdAt: createdAt instanceof Date ? createdAt.toISOString() : createdAt
    })
}

// Comment sockets are invalidation notifications only; clients refetch from MongoDB.
const emitCommentUpdate = ({ noteId, threadId, replyId, anchorId, action, updatedBy }) => {
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

    if (anchorId) {
        payload.anchorId = String(anchorId)
    }

    io.to(getV2NoteRoom(noteId)).emit("comments:updated", payload)
}

// Notification sockets are recipient-scoped invalidation hints; clients refetch from MongoDB.
const emitNotificationsUpdated = ({ recipientId, notificationId, type } = {}) => {
    const io = getSocketServer()

    if (!io || !recipientId) {
        return
    }

    const payload = {}

    if (notificationId) {
        payload.notificationId = String(notificationId)
    }

    if (type) {
        payload.type = type
    }

    io.to(getUserNotificationRoom(recipientId)).emit("notifications:updated", payload)
}
export {
    emitActivityUpdated,
    emitCommentUpdate,
    emitNoteRestored,
    emitNoteTitleUpdated,
    emitNotificationsUpdated,
    getSocketServer,
    getUserNotificationRoom,
    setSocketServer
}
