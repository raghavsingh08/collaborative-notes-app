import mongoose from "mongoose"
import Note from "../models/note.model.js"
import NoteVersion from "../models/noteVersion.model.js"
import { emitNoteRestored } from "../sockets/socketState.js"
import { logActivity } from "../utils/activityLogger.js"
import { releaseAuthoritativeYDoc } from "../utils/yjsNoteState.js"
import {
    createNoteVersionSnapshot,
    pruneNoteVersions
} from "../utils/noteVersionSnapshots.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const userSelect = "username email name"

const userCanAccessNote = (note, userId) => {
    return String(note.owner) === String(userId) ||
        note.sharedWith.some((sharedUserId) => String(sharedUserId) === String(userId))
}

const getAccessibleNoteOrThrow = async (noteId, userId) => {
    if (!mongoose.isValidObjectId(noteId)) {
        throw new ApiError(400, "Invalid note id")
    }

    const note = await Note.findById(noteId)

    if (!note) {
        throw new ApiError(404, "Note not found")
    }

    if (!userCanAccessNote(note, userId)) {
        throw new ApiError(403, "You do not have access to this note")
    }

    return note
}

const getVersionForNoteOrThrow = async (noteId, versionId) => {
    if (!mongoose.isValidObjectId(versionId)) {
        throw new ApiError(400, "Invalid version id")
    }

    const version = await NoteVersion.findOne({
        _id: versionId,
        noteId
    }).populate("createdBy", userSelect)

    if (!version) {
        throw new ApiError(404, "Version not found")
    }

    return version
}

const makePreview = (content = "") => {
    const normalized = String(content || "").replace(/\s+/g, " ").trim()

    if (normalized.length <= 120) {
        return normalized
    }

    return `${normalized.slice(0, 117)}...`
}

const recordActivity = ({ noteId, actor, type, metadata = {} }) => {
    return logActivity({
        noteId,
        actor,
        type,
        metadata
    })
}

const getNoteVersions = asyncHandler(async (req, res) => {
    const { noteId } = req.params

    await getAccessibleNoteOrThrow(noteId, req.user._id)

    const versions = await NoteVersion.find({ noteId })
        .sort({ createdAt: -1 })
        .select("noteId title content createdBy createdAt reason")
        .populate("createdBy", userSelect)

    const metadata = versions.map((version) => ({
        _id: version._id,
        noteId: version.noteId,
        title: version.title,
        createdBy: version.createdBy,
        createdAt: version.createdAt,
        reason: version.reason,
        preview: makePreview(version.content)
    }))

    return res
        .status(200)
        .json(new ApiResponse(200, metadata, "Note versions fetched successfully"))
})

const getNoteVersionById = asyncHandler(async (req, res) => {
    const { noteId, versionId } = req.params

    await getAccessibleNoteOrThrow(noteId, req.user._id)

    const version = await getVersionForNoteOrThrow(noteId, versionId)

    return res
        .status(200)
        .json(new ApiResponse(200, version, "Note version fetched successfully"))
})

const restoreNoteVersion = asyncHandler(async (req, res) => {
    const { noteId, versionId } = req.params

    const note = await getAccessibleNoteOrThrow(noteId, req.user._id)
    const version = await getVersionForNoteOrThrow(noteId, versionId)

    await createNoteVersionSnapshot({
        note,
        createdBy: req.user._id,
        reason: "pre_restore",
        skipIfDuplicate: false
    })

    note.title = version.title || ""
    note.content = version.content || ""
    note.contentJson = version.contentJson ?? null
    note.yjsState = version.yjsState ? Buffer.from(version.yjsState) : null
    note.yjsStateUpdatedAt = version.yjsState ? new Date() : null

    await note.save()
    await pruneNoteVersions(note._id)

    releaseAuthoritativeYDoc(note._id)
    emitNoteRestored({
        noteId: note._id,
        versionId: version._id,
        restoredBy: req.user._id
    })

    await recordActivity({
        noteId: note._id,
        actor: req.user,
        type: "VERSION_RESTORED",
        metadata: {
            versionId: version._id
        }
    })

    return res
        .status(200)
        .json(new ApiResponse(200, note, "Note version restored successfully"))
})

export {
    getNoteVersionById,
    getNoteVersions,
    restoreNoteVersion
}
