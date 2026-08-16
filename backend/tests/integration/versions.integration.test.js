import request from "supertest"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { app } from "../../src/app.js"
import ActivityEvent from "../../src/models/activityEvent.model.js"
import Note from "../../src/models/note.model.js"
import NoteVersion from "../../src/models/noteVersion.model.js"
import { authHeaderFor } from "../helpers/auth.js"
import {
    createTestNote,
    createTestUser,
    createTestVersion
} from "../helpers/factories.js"
import { clearTestDB, closeTestDB, connectTestDB } from "../setup/testDb.js"

beforeAll(connectTestDB)
afterEach(clearTestDB)
afterAll(closeTestDB)

describe("version restore HTTP integration", () => {
    it("restores a version and rejects a subsequent stale V2 content save", async () => {
        const owner = await createTestUser()
        const note = await createTestNote({
            owner,
            title: "Current title",
            content: "Current content",
            contentJson: { type: "doc", content: [{ type: "paragraph" }] },
            yjsState: Buffer.from([9, 9, 9]),
            yjsStateUpdatedAt: new Date(),
            contentRevision: 4
        })
        const version = await createTestVersion({
            note,
            createdBy: owner,
            title: "Restored title",
            content: "Restored content",
            contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Restored" }] }] },
            yjsState: Buffer.from([1, 2, 3])
        })
        const authorization = authHeaderFor(owner)

        const restore = await request(app)
            .post(`/api/v1/notes/${note._id}/versions/${version._id}/restore`)
            .set("Authorization", authorization)

        expect(restore.status).toBe(200)
        const restored = await Note.findById(note._id)
        expect(restored.title).toBe("Restored title")
        expect(restored.content).toBe("Restored content")
        expect(restored.contentJson).toEqual(version.contentJson)
        expect(Buffer.compare(restored.yjsState, version.yjsState)).toBe(0)
        expect(restored.contentRevision).toBe(5)
        expect(restored.yjsStateUpdatedAt).toBeInstanceOf(Date)

        const preRestore = await NoteVersion.findOne({ noteId: note._id, reason: "pre_restore" })
        expect(preRestore).toBeTruthy()
        expect(preRestore.content).toBe("Current content")
        expect(await ActivityEvent.countDocuments({ type: "VERSION_RESTORED" })).toBe(1)

        const staleSave = await request(app)
            .patch(`/api/v1/notes/${note._id}`)
            .set("Authorization", authorization)
            .send({
                content: "Stale browser content",
                contentJson: { type: "doc", content: [] },
                editorVersion: "v2",
                expectedContentRevision: 4
            })

        expect(staleSave.status).toBe(409)
        expect(staleSave.body).toMatchObject({
            success: false,
            code: "CONTENT_REVISION_CONFLICT",
            currentContentRevision: 5
        })
        expect((await Note.findById(note._id)).content).toBe("Restored content")
    })
})
const noteMatchesVersion = (note, version) => (
    note.title === version.title &&
    note.content === version.content &&
    JSON.stringify(note.contentJson) === JSON.stringify(version.contentJson) &&
    Buffer.compare(note.yjsState, version.yjsState) === 0
)

describe("concurrent version restore HTTP integration", () => {
    it("allows one concurrent restore to win without leaving a mixed note state", async () => {
        const owner = await createTestUser()
        const note = await createTestNote({
            owner,
            title: "Current title",
            content: "Current content",
            contentJson: { type: "doc", content: [{ type: "paragraph" }] },
            yjsState: Buffer.from([9, 9, 9]),
            contentRevision: 7
        })
        const versionA = await createTestVersion({
            note,
            createdBy: owner,
            title: "Version A title",
            content: "Version A content",
            contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "A" }] }] },
            yjsState: Buffer.from([1, 1, 1])
        })
        const versionB = await createTestVersion({
            note,
            createdBy: owner,
            title: "Version B title",
            content: "Version B content",
            contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "B" }] }] },
            yjsState: Buffer.from([2, 2, 2])
        })
        const authorization = authHeaderFor(owner)
        const restore = (version) => request(app)
            .post(`/api/v1/notes/${note._id}/versions/${version._id}/restore`)
            .set("Authorization", authorization)

        const responses = await Promise.all([restore(versionA), restore(versionB)])
        const statuses = responses.map((response) => response.status).sort()
        const restored = await Note.findById(note._id)
        const matches = [versionA, versionB].filter((version) => noteMatchesVersion(restored, version))

        expect(statuses).toEqual([200, 409])
        expect(restored.contentRevision).toBe(8)
        expect(matches).toHaveLength(1)
    })

    it("keeps every restored field from the winning version after a concurrent conflict", async () => {
        const owner = await createTestUser()
        const note = await createTestNote({
            owner,
            title: "Before restore",
            content: "Before restore content",
            contentJson: { type: "doc", content: [{ type: "paragraph" }] },
            yjsState: Buffer.from([8, 8, 8]),
            contentRevision: 3
        })
        const versionA = await createTestVersion({
            note,
            createdBy: owner,
            title: "Atomic A title",
            content: "Atomic A content",
            contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Atomic A" }] }] },
            yjsState: Buffer.from([3, 3, 3])
        })
        const versionB = await createTestVersion({
            note,
            createdBy: owner,
            title: "Atomic B title",
            content: "Atomic B content",
            contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Atomic B" }] }] },
            yjsState: Buffer.from([4, 4, 4])
        })
        const authorization = authHeaderFor(owner)
        const restore = (version) => request(app)
            .post(`/api/v1/notes/${note._id}/versions/${version._id}/restore`)
            .set("Authorization", authorization)

        const [responseA, responseB] = await Promise.all([restore(versionA), restore(versionB)])
        const winner = responseA.status === 200 ? versionA : versionB
        const loser = responseA.status === 200 ? responseB : responseA
        const restored = await Note.findById(note._id)

        expect(loser.status).toBe(409)
        expect(loser.body).toMatchObject({
            success: false,
            code: "CONTENT_REVISION_CONFLICT"
        })
        expect(noteMatchesVersion(restored, winner)).toBe(true)
        expect(restored.contentRevision).toBe(4)
    })
})
