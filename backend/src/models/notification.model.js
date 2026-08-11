import mongoose from "mongoose"

const notificationTypes = [
    "NOTE_SHARED",
    "COMMENT_REPLY",
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
        }
    },
    {
        _id: false
    }
)

const notificationSchema = new mongoose.Schema(
    {
        recipientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        actor: {
            type: actorSchema,
            required: true
        },
        type: {
            type: String,
            enum: notificationTypes,
            required: true
        },
        noteId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Note",
            required: true
        },
        threadId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CommentThread",
            default: null
        },
        replyId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null
        },
        sourceActivityId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ActivityEvent",
            required: true
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        readAt: {
            type: Date,
            default: null
        },
        createdAt: {
            type: Date,
            default: Date.now,
            immutable: true
        }
    },
    {
        timestamps: false
    }
)

notificationSchema.index({ recipientId: 1, createdAt: -1, _id: -1 })
notificationSchema.index({ recipientId: 1, readAt: 1, createdAt: -1 })
notificationSchema.index(
    { recipientId: 1, sourceActivityId: 1 },
    { unique: true }
)

const Notification = mongoose.model("Notification", notificationSchema)

export {
    notificationTypes
}

export default Notification