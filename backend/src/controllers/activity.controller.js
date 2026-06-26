import mongoose from "mongoose"
import ActivityEvent from "../models/activityEvent.model.js"
import Note from "../models/note.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const userSelect = "username email name avatar profileImage"

const userCanAccessNote = (note, userId) => {
    return String(note.owner) === String(userId) ||
        note.sharedWith.some((sharedUserId) => String(sharedUserId) === String(userId))
}

const getAccessibleNoteOrThrow = async (noteId, userId) => {
    if (!mongoose.isValidObjectId(noteId)) {
        throw new ApiError(400, "Invalid note id")
    }

    const note = await Note.findById(noteId).select("owner sharedWith")

    if (!note) {
        throw new ApiError(404, "Note not found")
    }

    if (!userCanAccessNote(note, userId)) {
        throw new ApiError(403, "You do not have access to this note")
    }

    return note
}

const getActorName = (eventActor, populatedUser) => {
    return eventActor?.name ||
        populatedUser?.name ||
        populatedUser?.username ||
        populatedUser?.email ||
        ""
}

const getActorAvatar = (eventActor, populatedUser) => {
    return eventActor?.avatar ||
        populatedUser?.avatar ||
        populatedUser?.profileImage ||
        ""
}

const formatActivityEvent = (event) => {
    const populatedUser = event.actor?._id
    const actorId = populatedUser?._id || populatedUser

    return {
        _id: event._id,
        noteId: event.noteId,
        actor: {
            _id: actorId,
            name: getActorName(event.actor, populatedUser),
            avatar: getActorAvatar(event.actor, populatedUser)
        },
        type: event.type,
        metadata: event.metadata || {},
        createdAt: event.createdAt
    }
}

const getNoteActivity = asyncHandler(async (req, res) => {
    const { noteId } = req.params

    await getAccessibleNoteOrThrow(noteId, req.user._id)

    const events = await ActivityEvent.find({ noteId })
        .sort({ createdAt: -1 })
        .populate("actor._id", userSelect)

    return res
        .status(200)
        .json(new ApiResponse(
            200,
            events.map(formatActivityEvent),
            "Note activity fetched successfully"
        ))
})

export {
    getNoteActivity
}
