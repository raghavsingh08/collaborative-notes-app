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