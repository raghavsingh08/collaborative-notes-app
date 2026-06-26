import mongoose from "mongoose"

const commentSchema = new mongoose.Schema(
    {
        body: {
            type: String,
            required: [true, "Comment body is required"],
            trim: true,
            maxlength: [5000, "Comment cannot exceed 5000 characters"]
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    {
        timestamps: true
    }
)

const commentThreadSchema = new mongoose.Schema(
    {
        noteId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Note",
            required: true,
            index: true
        },
        selectedText: {
            type: String,
            trim: true,
            default: "",
            maxlength: [2000, "Selected text cannot exceed 2000 characters"]
        },
        anchorId: {
            type: String,
            required: [true, "Anchor id is required"],
            trim: true,
            maxlength: [200, "Anchor id cannot exceed 200 characters"]
        },
        status: {
            type: String,
            enum: ["open", "resolved"],
            default: "open",
            index: true
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        resolvedAt: {
            type: Date,
            default: null
        },
        comments: {
            type: [commentSchema],
            validate: {
                validator(comments) {
                    return comments.length > 0
                },
                message: "A thread must include at least one comment"
            }
        }
    },
    {
        timestamps: true
    }
)

commentThreadSchema.index({ noteId: 1, status: 1, updatedAt: -1 })

const CommentThread = mongoose.model("CommentThread", commentThreadSchema)

export default CommentThread
