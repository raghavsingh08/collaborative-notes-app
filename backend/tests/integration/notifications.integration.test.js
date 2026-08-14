import request from "supertest"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { app } from "../../src/app.js"
import ActivityEvent from "../../src/models/activityEvent.model.js"
import Notification from "../../src/models/notification.model.js"
import { authHeaderFor } from "../helpers/auth.js"
import { createTestNote, createTestUser } from "../helpers/factories.js"
import { clearTestDB, closeTestDB, connectTestDB } from "../setup/testDb.js"

const createNotification = async ({ recipient, actor, note, type = "NOTE_SHARED", readAt = null }) => {
    const activity = await ActivityEvent.create({
        noteId: note._id,
        actor: { _id: actor._id, name: actor.username },
        type: "COLLABORATOR_ADDED",
        metadata: {}
    })

    return Notification.create({
        recipientId: recipient._id,
        actor: { _id: actor._id, name: actor.username },
        type,
        noteId: note._id,
        sourceActivityId: activity._id,
        readAt
    })
}

beforeAll(connectTestDB)
afterEach(clearTestDB)
afterAll(closeTestDB)

describe("notification HTTP integration", () => {
    it("scopes lists and read mutations to the authenticated recipient", async () => {
        const userA = await createTestUser()
        const userB = await createTestUser()
        const actor = await createTestUser()
        const note = await createTestNote({ owner: actor })
        const notificationA = await createNotification({ recipient: userA, actor, note })
        const notificationB = await createNotification({ recipient: userB, actor, note })

        const list = await request(app)
            .get("/api/v1/notifications")
            .set("Authorization", authHeaderFor(userA))

        expect(list.status).toBe(200)
        expect(list.body.data.items.map((item) => String(item._id))).toEqual([String(notificationA._id)])

        const readOther = await request(app)
            .patch(`/api/v1/notifications/${notificationB._id}/read`)
            .set("Authorization", authHeaderFor(userA))

        expect(readOther.status).toBe(404)
        expect((await Notification.findById(notificationB._id)).readAt).toBeNull()
    })

    it("marks only the caller's unread notifications as read", async () => {
        const userA = await createTestUser()
        const userB = await createTestUser()
        const actor = await createTestUser()
        const note = await createTestNote({ owner: actor })
        const unreadAOne = await createNotification({ recipient: userA, actor, note })
        const unreadATwo = await createNotification({ recipient: userA, actor, note })
        const previouslyReadAt = new Date("2020-01-01T00:00:00.000Z")
        const readA = await createNotification({ recipient: userA, actor, note, readAt: previouslyReadAt })
        const unreadB = await createNotification({ recipient: userB, actor, note })

        const response = await request(app)
            .patch("/api/v1/notifications/read-all")
            .set("Authorization", authHeaderFor(userA))

        expect(response.status).toBe(200)
        expect(response.body.data.modifiedCount).toBe(2)
        const refreshedUnreadOne = await Notification.findById(unreadAOne._id)
        const refreshedUnreadTwo = await Notification.findById(unreadATwo._id)
        expect(refreshedUnreadOne.readAt).toBeTruthy()
        expect(refreshedUnreadTwo.readAt).toBeTruthy()
        expect((await Notification.findById(readA._id)).readAt.getTime()).toBe(previouslyReadAt.getTime())
        expect((await Notification.findById(unreadB._id)).readAt).toBeNull()

        const list = await request(app)
            .get("/api/v1/notifications")
            .set("Authorization", authHeaderFor(userA))
        expect(list.body.data.unreadCount).toBe(0)
    })
})