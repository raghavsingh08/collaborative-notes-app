import mongoose from "mongoose"

const commentReadStateSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        threadId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CommentThread",
            required: true
        },
        lastReadAt: {
            type: Date,
            required: true
        }
    },
    {
        timestamps: false
    }
)

commentReadStateSchema.index(
    { userId: 1, threadId: 1 },
    { unique: true }
)

const CommentReadState = mongoose.model("CommentReadState", commentReadStateSchema)

export default CommentReadState
