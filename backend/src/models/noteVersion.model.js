import mongoose from "mongoose"

const noteVersionSchema = new mongoose.Schema(
    {
        noteId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Note",
            required: true,
            index: true
        },
        title: {
            type: String,
            default: ""
        },
        content: {
            type: String,
            default: ""
        },
        contentJson: {
            type: Object,
            default: null
        },
        yjsState: {
            type: Buffer,
            default: null
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        reason: {
            type: String,
            enum: ["manual_save", "pre_restore"],
            default: "manual_save"
        }
    },
    {
        timestamps: {
            createdAt: true,
            updatedAt: false
        }
    }
)

noteVersionSchema.index({ noteId: 1, createdAt: -1 })

const NoteVersion = mongoose.model("NoteVersion", noteVersionSchema)

export default NoteVersion
