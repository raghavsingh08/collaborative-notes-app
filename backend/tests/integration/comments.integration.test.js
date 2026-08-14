import request from "supertest"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { app } from "../../src/app.js"
import ActivityEvent from "../../src/models/activityEvent.model.js"
import CommentThread from "../../src/models/commentThread.model.js"
import Notification from "../../src/models/notification.model.js"
import { authHeaderFor } from "../helpers/auth.js"
import {
    createTestNote,
    createTestThread,
    createTestUser
} from "../helpers/factories.js"
import {
    clearTestDB,
    closeTestDB,
    connectTestDB
} from "../setup/testDb.js"

const id = (value) => String(value)

beforeAll(connectTestDB)
afterEach(clearTestDB)
afterAll(closeTestDB)

describe("comment HTTP integration", () => {
    it("rejects unauthenticated protected note access", async () => {
        const response = await request(app).get("/api/v1/notes/507f1f77bcf86cd799439011")

        expect(response.status).toBe(401)
        expect(response.body).toMatchObject({ success: false, statusCode: 401 })
    })

    it("rejects an outsider resolving a comment without durable side effects", async () => {
        const owner = await createTestUser()
        const outsider = await createTestUser()
        const note = await createTestNote({ owner })
        const thread = await createTestThread({ note, createdBy: owner })

        const response = await request(app)
            .patch(`/api/v1/comments/${thread._id}/resolve`)
            .set("Authorization", authHeaderFor(outsider))

        expect(response.status).toBe(403)
        expect((await CommentThread.findById(thread._id)).status).toBe("open")
        expect(await ActivityEvent.countDocuments()).toBe(0)
        expect(await Notification.countDocuments()).toBe(0)
    })

    it("resolves an open thread with one activity and root-author notification", async () => {
        const rootAuthor = await createTestUser()
        const owner = await createTestUser()
        const note = await createTestNote({ owner })
        const thread = await createTestThread({ note, createdBy: rootAuthor })

        const response = await request(app)
            .patch(`/api/v1/comments/${thread._id}/resolve`)
            .set("Authorization", authHeaderFor(owner))

        expect(response.status).toBe(200)
        const resolved = await CommentThread.findById(thread._id)
        expect(resolved).toMatchObject({ status: "resolved", resolved: true })
        expect(id(resolved.resolvedBy)).toBe(id(owner._id))
        expect(resolved.resolvedAt).toBeInstanceOf(Date)

        const activity = await ActivityEvent.findOne({ type: "COMMENT_RESOLVED" })
        expect(activity).toBeTruthy()
        expect(id(activity.noteId)).toBe(id(note._id))
        expect(id(activity.actor._id)).toBe(id(owner._id))
        expect(id(activity.metadata.threadId)).toBe(id(thread._id))

        const notification = await Notification.findOne({ type: "COMMENT_RESOLVED" })
        expect(notification).toBeTruthy()
        expect(id(notification.recipientId)).toBe(id(rootAuthor._id))
        expect(id(notification.sourceActivityId)).toBe(id(activity._id))
        expect(id(notification.threadId)).toBe(id(thread._id))
    })

    it("makes repeated resolve idempotent without rewriting resolution metadata", async () => {
        const rootAuthor = await createTestUser()
        const owner = await createTestUser()
        const note = await createTestNote({ owner })
        const thread = await createTestThread({ note, createdBy: rootAuthor })
        const url = `/api/v1/comments/${thread._id}/resolve`

        expect((await request(app).patch(url).set("Authorization", authHeaderFor(owner))).status).toBe(200)
        const first = await CommentThread.findById(thread._id)
        const secondResponse = await request(app).patch(url).set("Authorization", authHeaderFor(owner))
        const second = await CommentThread.findById(thread._id)

        expect(secondResponse.status).toBe(200)
        expect(second.resolvedAt.getTime()).toBe(first.resolvedAt.getTime())
        expect(await ActivityEvent.countDocuments({ type: "COMMENT_RESOLVED" })).toBe(1)
        expect(await Notification.countDocuments({ type: "COMMENT_RESOLVED" })).toBe(1)
    })

    it("reopens a resolved thread with one activity and notification", async () => {
        const rootAuthor = await createTestUser()
        const owner = await createTestUser()
        const note = await createTestNote({ owner })
        const thread = await createTestThread({
            note,
            createdBy: rootAuthor,
            status: "resolved",
            resolved: true,
            resolvedBy: owner._id,
            resolvedAt: new Date()
        })

        const response = await request(app)
            .patch(`/api/v1/comments/${thread._id}/reopen`)
            .set("Authorization", authHeaderFor(owner))

        expect(response.status).toBe(200)
        const reopened = await CommentThread.findById(thread._id)
        expect(reopened).toMatchObject({ status: "open", resolved: false, resolvedBy: null, resolvedAt: null })
        expect(await ActivityEvent.countDocuments({ type: "COMMENT_REOPENED" })).toBe(1)
        const notification = await Notification.findOne({ type: "COMMENT_REOPENED" })
        expect(id(notification.recipientId)).toBe(id(rootAuthor._id))
    })

    it("makes repeated reopen idempotent without duplicate side effects", async () => {
        const rootAuthor = await createTestUser()
        const owner = await createTestUser()
        const note = await createTestNote({ owner })
        const thread = await createTestThread({
            note,
            createdBy: rootAuthor,
            status: "resolved",
            resolved: true,
            resolvedBy: owner._id,
            resolvedAt: new Date()
        })
        const url = `/api/v1/comments/${thread._id}/reopen`

        expect((await request(app).patch(url).set("Authorization", authHeaderFor(owner))).status).toBe(200)
        expect((await request(app).patch(url).set("Authorization", authHeaderFor(owner))).status).toBe(200)
        expect(await ActivityEvent.countDocuments({ type: "COMMENT_REOPENED" })).toBe(1)
        expect(await Notification.countDocuments({ type: "COMMENT_REOPENED" })).toBe(1)
    })

    it("adds a reply to an open thread with linked activity and notification", async () => {
        const rootAuthor = await createTestUser()
        const owner = await createTestUser()
        const note = await createTestNote({ owner })
        const thread = await createTestThread({ note, createdBy: rootAuthor })

        const response = await request(app)
            .post(`/api/v1/comments/${thread._id}/replies`)
            .set("Authorization", authHeaderFor(owner))
            .send({ body: "A durable reply" })

        expect(response.status).toBe(200)
        const updated = await CommentThread.findById(thread._id)
        expect(updated.comments).toHaveLength(2)
        const reply = updated.comments[1]
        const activity = await ActivityEvent.findOne({ type: "REPLY_CREATED" })
        const notification = await Notification.findOne({ type: "COMMENT_REPLY" })
        expect(id(activity.metadata.threadId)).toBe(id(thread._id))
        expect(id(activity.metadata.replyId)).toBe(id(reply._id))
        expect(id(notification.recipientId)).toBe(id(rootAuthor._id))
        expect(id(notification.replyId)).toBe(id(reply._id))
        expect(id(notification.sourceActivityId)).toBe(id(activity._id))
    })

    it("blocks replies to resolved threads without changing durable state", async () => {
        const owner = await createTestUser()
        const note = await createTestNote({ owner })
        const thread = await createTestThread({
            note,
            createdBy: owner,
            status: "resolved",
            resolved: true,
            resolvedBy: owner._id,
            resolvedAt: new Date()
        })

        const response = await request(app)
            .post(`/api/v1/comments/${thread._id}/replies`)
            .set("Authorization", authHeaderFor(owner))
            .send({ body: "This must not be added" })

        expect(response.status).toBe(409)
        expect(response.body).toMatchObject({ success: false, code: "COMMENT_THREAD_RESOLVED" })
        expect((await CommentThread.findById(thread._id)).comments).toHaveLength(1)
        expect(await ActivityEvent.countDocuments({ type: "REPLY_CREATED" })).toBe(0)
        expect(await Notification.countDocuments({ type: "COMMENT_REPLY" })).toBe(0)
    })
})