import request from "supertest"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { app } from "../../src/app.js"
import ActivityEvent from "../../src/models/activityEvent.model.js"
import Note from "../../src/models/note.model.js"
import Notification from "../../src/models/notification.model.js"
import { authHeaderFor } from "../helpers/auth.js"
import { createTestNote, createTestUser } from "../helpers/factories.js"
import { clearTestDB, closeTestDB, connectTestDB } from "../setup/testDb.js"

const id = (value) => String(value)

beforeAll(connectTestDB)
afterEach(clearTestDB)
afterAll(closeTestDB)

describe("note sharing HTTP integration", () => {
    it("shares a note once and records the durable collaboration side effects", async () => {
        const owner = await createTestUser()
        const collaborator = await createTestUser()
        const note = await createTestNote({ owner })

        const response = await request(app)
            .post(`/api/v1/notes/${note._id}/share`)
            .set("Authorization", authHeaderFor(owner))
            .send({ email: collaborator.email })

        expect(response.status).toBe(200)
        const sharedNote = await Note.findById(note._id)
        expect(sharedNote.sharedWith.map(id)).toEqual([id(collaborator._id)])

        const activity = await ActivityEvent.findOne({ type: "COLLABORATOR_ADDED" })
        expect(activity).toBeTruthy()
        expect(id(activity.noteId)).toBe(id(note._id))
        expect(id(activity.actor._id)).toBe(id(owner._id))
        expect(id(activity.metadata.collaboratorId)).toBe(id(collaborator._id))

        const notification = await Notification.findOne({ type: "NOTE_SHARED" })
        expect(notification).toBeTruthy()
        expect(id(notification.recipientId)).toBe(id(collaborator._id))
        expect(id(notification.sourceActivityId)).toBe(id(activity._id))
        expect(await Notification.countDocuments({ recipientId: owner._id })).toBe(0)
    })

    it("rejects a sequential duplicate share without duplicate side effects", async () => {
        const owner = await createTestUser()
        const collaborator = await createTestUser()
        const note = await createTestNote({ owner })
        const url = `/api/v1/notes/${note._id}/share`

        const first = await request(app)
            .post(url)
            .set("Authorization", authHeaderFor(owner))
            .send({ email: collaborator.email })
        const second = await request(app)
            .post(url)
            .set("Authorization", authHeaderFor(owner))
            .send({ email: collaborator.email })

        expect(first.status).toBe(200)
        expect(second.status).toBe(409)
        expect((await Note.findById(note._id)).sharedWith.map(id)).toEqual([id(collaborator._id)])
        expect(await ActivityEvent.countDocuments({ type: "COLLABORATOR_ADDED" })).toBe(1)
        expect(await Notification.countDocuments({ type: "NOTE_SHARED" })).toBe(1)
    })

    it("allows only one simultaneous duplicate share to succeed", async () => {
        const owner = await createTestUser()
        const collaborator = await createTestUser()
        const note = await createTestNote({ owner })
        const url = `/api/v1/notes/${note._id}/share`
        const makeRequest = () => request(app)
            .post(url)
            .set("Authorization", authHeaderFor(owner))
            .send({ email: collaborator.email })

        const responses = await Promise.all([makeRequest(), makeRequest()])
        const statuses = responses.map((response) => response.status).sort()

        expect(statuses).toEqual([200, 409])
        expect((await Note.findById(note._id)).sharedWith.map(id)).toEqual([id(collaborator._id)])
        expect(await ActivityEvent.countDocuments({ type: "COLLABORATOR_ADDED" })).toBe(1)
        expect(await Notification.countDocuments({ type: "NOTE_SHARED" })).toBe(1)
    })
})