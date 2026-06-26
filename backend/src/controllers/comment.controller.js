import mongoose from "mongoose"
import CommentThread from "../models/commentThread.model.js"
import Note from "../models/note.model.js"
import { emitCommentUpdate } from "../sockets/socketState.js"
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

const notifyCommentUpdated = ({ noteId, threadId, action, updatedBy }) => {
    emitCommentUpdate({
        noteId,
        threadId,
        action,
        updatedBy
    })
}

const requireBody = (body) => {
    const normalizedBody = normalizeText(body)

    if (!normalizedBody) {
        throw new ApiError(400, "Comment body is required")
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

    return res
        .status(200)
        .json(new ApiResponse(200, threads, "Comment threads fetched successfully"))
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

    const normalizedBody = requireBody(body)

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

    return res
        .status(201)
        .json(new ApiResponse(201, populatedThread, "Comment thread created successfully"))
})

const addCommentReply = asyncHandler(async (req, res) => {
    const { threadId } = req.params
    const { body } = req.body

    const thread = await findAccessibleThread(threadId, req.user._id)
    const normalizedBody = requireBody(body)

    thread.comments.push({
        body: normalizedBody,
        createdBy: req.user._id
    })

    await thread.save()

    const populatedThread = await populateThreadUsers(
        CommentThread.findById(thread._id)
    )

    notifyCommentUpdated({
        noteId: thread.noteId,
        threadId: thread._id,
        action: "replied",
        updatedBy: req.user._id
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

    return res
        .status(200)
        .json(new ApiResponse(200, populatedThread, "Comment thread reopened successfully"))
})

export {
    addCommentReply,
    createCommentThread,
    getNoteCommentThreads,
    reopenCommentThread,
    resolveCommentThread
}
