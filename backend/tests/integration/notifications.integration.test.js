import request from "supertest"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { app } from "../../src/app.js"
import ActivityEvent from "../../src/models/activityEvent.model.js"
import Notification from "../../src/models/notification.model.js"
import { authHeaderFor } from "../helpers/auth.js"
import { createTestNote, createTestUser } from "../helpers/factories.js"
import { clearTestDB, closeTestDB, connectTestDB } from "../setup/testDb.js"

const createNotification = async ({ recipient, actor, note, type = "NOTE_SHARED", readAt = null, createdAt }) => {
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
        readAt,
        ...(createdAt ? { createdAt } : {})
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

    it("paginates notifications newest first without duplicates across cursors", async () => {
        const userA = await createTestUser()
        const userB = await createTestUser()
        const actor = await createTestUser()
        const note = await createTestNote({ owner: actor })
        const createdAtValues = [
            "2026-01-01T00:00:01.000Z",
            "2026-01-01T00:00:02.000Z",
            "2026-01-01T00:00:03.000Z",
            "2026-01-01T00:00:04.000Z",
            "2026-01-01T00:00:05.000Z"
        ]
        const notifications = []

        for (const createdAt of createdAtValues) {
            notifications.push(await createNotification({
                recipient: userA,
                actor,
                note,
                createdAt: new Date(createdAt)
            }))
        }
        await createNotification({
            recipient: userB,
            actor,
            note,
            createdAt: new Date("2026-01-01T00:00:06.000Z")
        })

        const firstPage = await request(app)
            .get("/api/v1/notifications?limit=2")
            .set("Authorization", authHeaderFor(userA))
        const secondPage = await request(app)
            .get(`/api/v1/notifications?limit=2&cursor=${encodeURIComponent(firstPage.body.data.nextCursor)}`)
            .set("Authorization", authHeaderFor(userA))
        const thirdPage = await request(app)
            .get(`/api/v1/notifications?limit=2&cursor=${encodeURIComponent(secondPage.body.data.nextCursor)}`)
            .set("Authorization", authHeaderFor(userA))

        expect(firstPage.status).toBe(200)
        expect(secondPage.status).toBe(200)
        expect(thirdPage.status).toBe(200)
        const receivedIds = [
            ...firstPage.body.data.items,
            ...secondPage.body.data.items,
            ...thirdPage.body.data.items
        ].map((item) => String(item._id))
        const expectedIds = notifications
            .slice()
            .reverse()
            .map((notification) => String(notification._id))
        expect(receivedIds).toEqual(expectedIds)
        expect(new Set(receivedIds).size).toBe(expectedIds.length)
        expect(firstPage.body.data.nextCursor).toBeTruthy()
        expect(secondPage.body.data.nextCursor).toBeTruthy()
        expect(thirdPage.body.data.nextCursor).toBeNull()
    })

    it("rejects malformed notification cursors safely", async () => {
        const user = await createTestUser()

        const response = await request(app)
            .get("/api/v1/notifications?cursor=not-a-valid-cursor")
            .set("Authorization", authHeaderFor(user))

        expect(response.status).toBe(400)
        expect(response.body).toMatchObject({ success: false, statusCode: 400 })
    })

    it("keeps a notification read timestamp stable across repeated read requests", async () => {
        const user = await createTestUser()
        const actor = await createTestUser()
        const note = await createTestNote({ owner: actor })
        const notification = await createNotification({ recipient: user, actor, note })
        const url = `/api/v1/notifications/${notification._id}/read`

        const first = await request(app)
            .patch(url)
            .set("Authorization", authHeaderFor(user))
        const firstPersisted = await Notification.findById(notification._id)
        const second = await request(app)
            .patch(url)
            .set("Authorization", authHeaderFor(user))
        const secondPersisted = await Notification.findById(notification._id)
        const list = await request(app)
            .get("/api/v1/notifications")
            .set("Authorization", authHeaderFor(user))

        expect(first.status).toBe(200)
        expect(second.status).toBe(200)
        expect(firstPersisted.readAt).toBeTruthy()
        expect(secondPersisted.readAt.getTime()).toBe(firstPersisted.readAt.getTime())
        expect(await Notification.countDocuments({ _id: notification._id })).toBe(1)
        expect(list.body.data.unreadCount).toBe(0)
    })

    it("does not let bulk read for User A mutate User B notifications", async () => {
        const userA = await createTestUser()
        const userB = await createTestUser()
        const actor = await createTestUser()
        const note = await createTestNote({ owner: actor })
        await createNotification({ recipient: userA, actor, note })
        const notificationB = await createNotification({ recipient: userB, actor, note })

        const response = await request(app)
            .patch("/api/v1/notifications/read-all")
            .set("Authorization", authHeaderFor(userA))

        expect(response.status).toBe(200)
        expect(response.body.data.modifiedCount).toBe(1)
        expect((await Notification.findById(notificationB._id)).readAt).toBeNull()
    })
})
