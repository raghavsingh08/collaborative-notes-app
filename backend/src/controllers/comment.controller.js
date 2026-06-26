import mongoose from "mongoose"
import CommentThread from "../models/commentThread.model.js"
import Note from "../models/note.model.js"
import { emitCommentUpdate } from "../sockets/socketState.js"
import { logActivity } from "../utils/activityLogger.js"
import {
    getThreadReadState,
    markThreadAsRead
} from "../utils/commentReadState.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const userSelect = "username email name"

const getAccessibleNote = (noteId, userId) => {
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

const populateThreadUsers = (query) => {
    return query
        .populate("createdBy", userSelect)
        .populate("resolvedBy", userSelect)
        .populate("comments.createdBy", userSelect)
}

const normalizeText = (value) => {
    return typeof value === "string" ? value.trim() : ""
}

const notifyCommentUpdated = ({ noteId, threadId, replyId, action, updatedBy }) => {
    emitCommentUpdate({
        noteId,
        threadId,
        replyId,
        action,
        updatedBy
    })
}

const recordActivity = ({ noteId, actor, type, metadata = {} }) => {
    return logActivity({
        noteId,
        actor,
        type,
        metadata
    })
}

const requireBody = (body, limit = 1000, type = "Comment") => {
    const normalizedBody = normalizeText(body)

    if (!normalizedBody) {
        throw new ApiError(400, `${type} cannot be empty`)
    }
    
    if (normalizedBody.length > limit) {
        throw new ApiError(400, `${type}s are limited to ${limit} characters.`)
    }

    return normalizedBody
}

const findAccessibleThread = async (threadId, userId) => {
    if (!mongoose.isValidObjectId(threadId)) {
        throw new ApiError(400, "Invalid thread id")
    }

    const thread = await CommentThread.findById(threadId)

    if (!thread) {
        throw new ApiError(404, "Comment thread not found")
    }

    const note = await getAccessibleNote(thread.noteId, userId)

    if (!note) {
        throw new ApiError(403, "You do not have access to this note")
    }

    return thread
}

const findAccessibleThreadContext = async (threadId, userId) => {
    if (!mongoose.isValidObjectId(threadId)) {
        throw new ApiError(400, "Invalid thread id")
    }

    const thread = await CommentThread.findById(threadId)

    if (!thread) {
        throw new ApiError(404, "Comment thread not found")
    }

    const note = await getAccessibleNote(thread.noteId, userId)

    if (!note) {
        throw new ApiError(403, "You do not have access to this note")
    }

    return { note, thread }
}

const toIdString = (value) => {
    if (!value) {
        return ""
    }

    return String(value._id || value)
}

const isSameId = (a, b) => {
    return Boolean(a && b && toIdString(a) === toIdString(b))
}

const getRootComment = (thread) => {
    return Array.isArray(thread.comments) && thread.comments.length > 0
        ? thread.comments[0]
        : null
}

const canDeleteThread = (note, thread, userId) => {
    const rootComment = getRootComment(thread)

    return isSameId(note.owner, userId) || isSameId(rootComment?.createdBy, userId)
}

const canDeleteReply = (note, reply, userId) => {
    return isSameId(note.owner, userId) || isSameId(reply?.createdBy, userId)
}

const getThreadLatestActivity = (thread) => {
    let latestActivityAt = thread.createdAt || new Date(0)
    let latestActivityBy = thread.createdBy

    thread.comments.forEach((comment) => {
        if (comment.createdAt && comment.createdAt > latestActivityAt) {
            latestActivityAt = comment.createdAt
            latestActivityBy = comment.createdBy
        }
    })

    return {
        latestActivityAt,
        latestActivityBy
    }
}

const shouldMarkThreadUnread = ({ thread, readState, userId }) => {
    const { latestActivityAt, latestActivityBy } = getThreadLatestActivity(thread)

    if (isSameId(latestActivityBy, userId)) {
        return false
    }

    if (!readState) {
        return true
    }

    return latestActivityAt > readState.lastReadAt
}

const addUnreadStateToThreads = async (threads, userId) => {
    const threadIds = threads.map((thread) => thread._id)
    const readStates = await getThreadReadState(userId, threadIds)
    const readStateByThreadId = new Map(
        readStates.map((readState) => [
            String(readState.threadId),
            readState
        ])
    )

    return threads.map((thread) => {
        const threadObject = thread.toObject()

        threadObject.isUnread = shouldMarkThreadUnread({
            thread,
            readState: readStateByThreadId.get(String(thread._id)),
            userId
        })

        return threadObject
    })
}

const getNoteCommentThreads = asyncHandler(async (req, res) => {
    const { noteId } = req.params

    const note = await getAccessibleNote(noteId, req.user._id)

    if (!note) {
        throw new ApiError(404, "Note not found or access denied")
    }

    const threads = await populateThreadUsers(
        CommentThread.find({ noteId })
            .sort({ status: 1, updatedAt: -1 })
    )
    const threadsWithUnreadState = await addUnreadStateToThreads(threads, req.user._id)

    return res
        .status(200)
        .json(new ApiResponse(200, threadsWithUnreadState, "Comment threads fetched successfully"))
})

const markCommentThreadAsRead = asyncHandler(async (req, res) => {
    const { threadId } = req.params

    const thread = await findAccessibleThread(threadId, req.user._id)
    const readState = await markThreadAsRead(req.user._id, thread._id)

    return res
        .status(200)
        .json(new ApiResponse(
            200,
            {
                threadId: thread._id,
                lastReadAt: readState.lastReadAt
            },
            "Comment thread marked as read"
        ))
})

const createCommentThread = asyncHandler(async (req, res) => {
    const { noteId } = req.params
    const { selectedText, anchorId, body } = req.body

    const note = await getAccessibleNote(noteId, req.user._id)

    if (!note) {
        throw new ApiError(404, "Note not found or access denied")
    }

    const normalizedAnchorId = normalizeText(anchorId)

    if (!normalizedAnchorId) {
        throw new ApiError(400, "Anchor id is required")
    }

    const normalizedSelectedText = normalizeText(selectedText)
    if (normalizedSelectedText.length < 2) {
        throw new ApiError(400, "Please select at least 2 non-whitespace characters.")
    }
    if (normalizedSelectedText.length > 300) {
        throw new ApiError(400, "Please select a shorter text (maximum 300 characters).")
    }

    const normalizedBody = requireBody(body, 1000, "Comment")

    const thread = await CommentThread.create({
        noteId,
        selectedText: normalizeText(selectedText),
        anchorId: normalizedAnchorId,
        createdBy: req.user._id,
        comments: [
            {
                body: normalizedBody,
                createdBy: req.user._id
            }
        ]
    })

    const populatedThread = await populateThreadUsers(
        CommentThread.findById(thread._id)
    )

    notifyCommentUpdated({
        noteId,
        threadId: thread._id,
        action: "created",
        updatedBy: req.user._id
    })

    await recordActivity({
        noteId,
        actor: req.user,
        type: "COMMENT_CREATED",
        metadata: {
            threadId: thread._id,
            anchorId: thread.anchorId,
            selectedText: thread.selectedText
        }
    })

    return res
        .status(201)
        .json(new ApiResponse(201, populatedThread, "Comment thread created successfully"))
})

const addCommentReply = asyncHandler(async (req, res) => {
    const { threadId } = req.params
    const { body } = req.body

    const thread = await findAccessibleThread(threadId, req.user._id)
    const normalizedBody = requireBody(body, 1000, "Reply")

    thread.comments.push({
        body: normalizedBody,
        createdBy: req.user._id
    })

    await thread.save()
    const reply = thread.comments[thread.comments.length - 1]

    const populatedThread = await populateThreadUsers(
        CommentThread.findById(thread._id)
    )

    notifyCommentUpdated({
        noteId: thread.noteId,
        threadId: thread._id,
        action: "replied",
        updatedBy: req.user._id
    })

    await recordActivity({
        noteId: thread.noteId,
        actor: req.user,
        type: "REPLY_CREATED",
        metadata: {
            threadId: thread._id,
            replyId: reply?._id
        }
    })

    return res
        .status(200)
        .json(new ApiResponse(200, populatedThread, "Reply added successfully"))
})

const resolveCommentThread = asyncHandler(async (req, res) => {
    const { threadId } = req.params

    const thread = await findAccessibleThread(threadId, req.user._id)

    thread.status = "resolved"
    thread.resolvedBy = req.user._id
    thread.resolvedAt = new Date()

    await thread.save()

    const populatedThread = await populateThreadUsers(
        CommentThread.findById(thread._id)
    )

    notifyCommentUpdated({
        noteId: thread.noteId,
        threadId: thread._id,
        action: "resolved",
        updatedBy: req.user._id
    })

    await recordActivity({
        noteId: thread.noteId,
        actor: req.user,
        type: "COMMENT_RESOLVED",
        metadata: {
            threadId: thread._id
        }
    })

    return res
        .status(200)
        .json(new ApiResponse(200, populatedThread, "Comment thread resolved successfully"))
})

const reopenCommentThread = asyncHandler(async (req, res) => {
    const { threadId } = req.params

    const thread = await findAccessibleThread(threadId, req.user._id)

    thread.status = "open"
    thread.resolvedBy = null
    thread.resolvedAt = null

    await thread.save()

    const populatedThread = await populateThreadUsers(
        CommentThread.findById(thread._id)
    )

    notifyCommentUpdated({
        noteId: thread.noteId,
        threadId: thread._id,
        action: "reopened",
        updatedBy: req.user._id
    })

    await recordActivity({
        noteId: thread.noteId,
        actor: req.user,
        type: "COMMENT_REOPENED",
        metadata: {
            threadId: thread._id
        }
    })

    return res
        .status(200)
        .json(new ApiResponse(200, populatedThread, "Comment thread reopened successfully"))
})

const deleteCommentThread = asyncHandler(async (req, res) => {
    const { threadId } = req.params

    const { note, thread } = await findAccessibleThreadContext(threadId, req.user._id)

    if (!canDeleteThread(note, thread, req.user._id)) {
        throw new ApiError(403, "You do not have permission to delete this thread")
    }

    const noteId = thread.noteId

    await CommentThread.deleteOne({ _id: thread._id })

    notifyCommentUpdated({
        noteId,
        threadId: thread._id,
        action: "thread_deleted",
        updatedBy: req.user._id
    })

    await recordActivity({
        noteId,
        actor: req.user,
        type: "COMMENT_DELETED",
        metadata: {
            threadId: thread._id
        }
    })

    return res
        .status(200)
        .json(new ApiResponse(200, null, "Comment thread deleted successfully"))
})

const deleteCommentReply = asyncHandler(async (req, res) => {
    const { threadId, replyId } = req.params

    if (!mongoose.isValidObjectId(replyId)) {
        throw new ApiError(400, "Invalid reply id")
    }

    const { note, thread } = await findAccessibleThreadContext(threadId, req.user._id)
    const reply = thread.comments.id(replyId)

    if (!reply) {
        throw new ApiError(404, "Reply not found")
    }

    const rootComment = getRootComment(thread)

    if (isSameId(rootComment?._id, replyId)) {
        throw new ApiError(400, "Delete the entire thread to remove the root comment")
    }

    if (!canDeleteReply(note, reply, req.user._id)) {
        throw new ApiError(403, "You do not have permission to delete this reply")
    }

    const noteId = thread.noteId

    thread.comments.pull(replyId)
    await thread.save()

    notifyCommentUpdated({
        noteId,
        threadId: thread._id,
        replyId,
        action: "reply_deleted",
        updatedBy: req.user._id
    })

    await recordActivity({
        noteId,
        actor: req.user,
        type: "REPLY_DELETED",
        metadata: {
            threadId: thread._id,
            replyId
        }
    })

    const populatedThread = await populateThreadUsers(
        CommentThread.findById(thread._id)
    )

    return res
        .status(200)
        .json(new ApiResponse(200, populatedThread, "Reply deleted successfully"))
})

export {
    addCommentReply,
    createCommentThread,
    deleteCommentReply,
    deleteCommentThread,
    getNoteCommentThreads,
    markCommentThreadAsRead,
    reopenCommentThread,
    resolveCommentThread
}
