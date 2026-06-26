import mongoose from "mongoose"

const activityEventTypes = [
    "NOTE_CREATED",
    "NOTE_RENAMED",
    "COLLABORATOR_ADDED",
    "COLLABORATOR_REMOVED",
    "MANUAL_SAVE",
    "VERSION_RESTORED",
    "COMMENT_CREATED",
    "COMMENT_DELETED",
    "REPLY_CREATED",
    "REPLY_DELETED",
    "COMMENT_RESOLVED",
    "COMMENT_REOPENED"
]

const actorSchema = new mongoose.Schema(
    {
        _id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        name: {
            type: String,
            trim: true,
            default: ""
        },
        avatar: {
            type: String,
            trim: true,
            default: ""
        }
    },
    {
        _id: false
    }
)

const activityEventSchema = new mongoose.Schema(
    {
        noteId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Note",
            required: true,
            index: true
        },
        actor: {
            type: actorSchema,
            required: true
        },
        type: {
            type: String,
            enum: activityEventTypes,
            required: true,
            index: true
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    {
        timestamps: {
            createdAt: true,
            updatedAt: false
        }
    }
)

activityEventSchema.index({ noteId: 1, createdAt: -1 })
activityEventSchema.index({ noteId: 1, type: 1, createdAt: -1 })

const ActivityEvent = mongoose.model("ActivityEvent", activityEventSchema)

export {
    activityEventTypes
}

export default ActivityEvent
