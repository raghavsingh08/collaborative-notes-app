import User from "../../src/models/user.model.js"
import Note from "../../src/models/note.model.js"
import CommentThread from "../../src/models/commentThread.model.js"
import NoteVersion from "../../src/models/noteVersion.model.js"

let sequence = 0

const nextValue = () => {
    sequence += 1
    return `${Date.now()}_${sequence}`
}

const idOf = (value) => value?._id || value

const createTestUser = async (overrides = {}) => {
    const suffix = nextValue()

    return User.create({
        username: `user_${suffix}`,
        email: `user_${suffix}@example.test`,
        password: "password123",
        ...overrides
    })
}

const createTestNote = async ({ owner, ...overrides }) => Note.create({
    title: "Integration test note",
    content: "Original content",
    contentJson: { type: "doc", content: [] },
    editorVersion: "v2",
    contentRevision: 0,
    owner: idOf(owner),
    ...overrides
})

const createTestThread = async ({ note, createdBy, ...overrides }) => {
    const actorId = idOf(createdBy)

    return CommentThread.create({
        noteId: idOf(note),
        selectedText: "Selected text",
        anchorId: `anchor-${nextValue()}`,
        createdBy: actorId,
        comments: [{
            body: "Root comment",
            createdBy: actorId
        }],
        ...overrides
    })
}

const createTestVersion = async ({ note, createdBy, ...overrides }) => NoteVersion.create({
    noteId: idOf(note),
    title: "Restored version title",
    content: "Restored version content",
    contentJson: { type: "doc", content: [] },
    yjsState: Buffer.from([1, 2, 3]),
    createdBy: idOf(createdBy),
    reason: "manual_save",
    ...overrides
})

export {
    createTestNote,
    createTestThread,
    createTestUser,
    createTestVersion
}