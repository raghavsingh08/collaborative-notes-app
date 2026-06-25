import mongoose from "mongoose"
import Note from "../models/note.model.js"
import User from "../models/user.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const getAccessibleNoteQuery = (noteId, userId) => ({
    _id: noteId,
    $or: [
        { owner: userId },
        { sharedWith: userId }
    ]
})

const createNote = asyncHandler(async (req, res) => {
    const { title, content } = req.body

    if (!title?.trim()) {
        throw new ApiError(400, "Title is required")
    }

    const note = await Note.create({
        title: title.trim(),
        content: content || "",
        owner: req.user._id
    })

    return res
        .status(201)
        .json(new ApiResponse(201, note, "Note created successfully"))
})

const getAllNotes = asyncHandler(async (req, res) => {
    const notes = await Note.find({
        $or: [
            { owner: req.user._id },
            { sharedWith: req.user._id }
        ]
    }).sort({ updatedAt: -1 }).populate("owner", "username email name")

    return res
        .status(200)
        .json(new ApiResponse(200, notes, "Notes fetched successfully"))
})

const getNoteById = asyncHandler(async (req, res) => {
    const { noteId } = req.params

    if (!mongoose.isValidObjectId(noteId)) {
        throw new ApiError(400, "Invalid note id")
    }

    const note = await Note.findOne(
        getAccessibleNoteQuery(noteId, req.user._id)
    ).populate("owner", "username email name")

    if (!note) {
        throw new ApiError(404, "Note not found")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, note, "Note fetched successfully"))
})

const updateNote = asyncHandler(async (req, res) => {
    const { noteId } = req.params
    const { title, content } = req.body

    if (!mongoose.isValidObjectId(noteId)) {
        throw new ApiError(400, "Invalid note id")
    }

    if (title !== undefined && !title.trim()) {
        throw new ApiError(400, "Title cannot be empty")
    }

    const updates = {}

    if (title !== undefined) {
        updates.title = title.trim()
    }

    if (content !== undefined) {
        updates.content = content
    }

    if (Object.keys(updates).length === 0) {
        throw new ApiError(400, "No update fields provided")
    }

    const note = await Note.findOneAndUpdate(
        getAccessibleNoteQuery(noteId, req.user._id),
        {
            $set: updates
        },
        {
            returnDocument: "after",
            runValidators: true
        }
    )

    if (!note) {
        throw new ApiError(404, "Note not found")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, note, "Note updated successfully"))
})

const deleteNote = asyncHandler(async (req, res) => {
    const { noteId } = req.params

    if (!mongoose.isValidObjectId(noteId)) {
        throw new ApiError(400, "Invalid note id")
    }

    const note = await Note.findOneAndDelete({
        _id: noteId,
        owner: req.user._id
    })

    if (!note) {
        throw new ApiError(404, "Note not found")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, null, "Note deleted successfully"))
})

const shareNote = asyncHandler(async (req, res) => {
    const { noteId } = req.params
    const { email, username } = req.body

    if (!mongoose.isValidObjectId(noteId)) {
        throw new ApiError(400, "Invalid note id")
    }

    if (!email?.trim() && !username?.trim()) {
        throw new ApiError(400, "Email or username is required")
    }

    const note = await Note.findOne({
        _id: noteId,
        owner: req.user._id
    })

    if (!note) {
        throw new ApiError(404, "Note not found")
    }

    const userToShareWith = await User.findOne({
        $or: [
            ...(email?.trim() ? [{ email: email.trim().toLowerCase() }] : []),
            ...(username?.trim() ? [{ username: username.trim() }] : [])
        ]
    })

    if (!userToShareWith) {
        throw new ApiError(404, "User to share with not found")
    }

    if (userToShareWith._id.equals(req.user._id)) {
        throw new ApiError(400, "Owner cannot share a note with themselves")
    }

    const isAlreadyShared = note.sharedWith.some((userId) =>
        userId.equals(userToShareWith._id)
    )

    if (isAlreadyShared) {
        throw new ApiError(409, "Note is already shared with this user")
    }

    note.sharedWith.push(userToShareWith._id)
    await note.save()

    return res
        .status(200)
        .json(new ApiResponse(200, note, "Note shared successfully"))
})

const unshareNote = asyncHandler(async (req, res) => {
    const { noteId, userId } = req.params

    if (!mongoose.isValidObjectId(noteId)) {
        throw new ApiError(400, "Invalid note id")
    }

    if (!mongoose.isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user id")
    }

    const note = await Note.findOne({
        _id: noteId,
        owner: req.user._id
    })

    if (!note) {
        throw new ApiError(404, "Note not found")
    }

    const wasShared = note.sharedWith.some((sharedUserId) =>
        sharedUserId.equals(userId)
    )

    if (!wasShared) {
        throw new ApiError(404, "User is not shared on this note")
    }

    note.sharedWith = note.sharedWith.filter(
        (sharedUserId) => !sharedUserId.equals(userId)
    )
    await note.save()

    return res
        .status(200)
        .json(new ApiResponse(200, note, "Note access removed successfully"))
})

const getSharedUsers = asyncHandler(async (req, res) => {
    const { noteId } = req.params

    if (!mongoose.isValidObjectId(noteId)) {
        throw new ApiError(400, "Invalid note id")
    }

    const note = await Note.findOne({
        _id: noteId,
        owner: req.user._id
    }).populate("sharedWith", "username email")

    if (!note) {
        throw new ApiError(404, "Note not found")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, note.sharedWith, "Shared users fetched successfully"))
})

export {
    createNote,
    getAllNotes,
    getNoteById,
    updateNote,
    deleteNote,
    shareNote,
    unshareNote,
    getSharedUsers
}
