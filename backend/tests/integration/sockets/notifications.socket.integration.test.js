import mongoose from "mongoose"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { emitNotificationsUpdated, getUserNotificationRoom } from "../../../src/sockets/socketState.js"
import {
    createSocketAs,
    disconnectTrackedSockets,
    expectNoEvent,
    waitForConnect,
    waitForEvent
} from "../../helpers/socket.js"
import { createTestUser } from "../../helpers/factories.js"
import { clearTestDB, closeTestDB, connectTestDB } from "../../setup/testDb.js"
import { startTestSocketServer, stopTestSocketServer } from "../../setup/socketTestServer.js"

let server

const disconnectAndWaitForServer = async (socket) => {
    const socketId = socket.id
    const serverSocket = server.io.sockets.sockets.get(socketId)
    const disconnected = new Promise((resolve) => serverSocket.once("disconnect", resolve))

    socket.disconnect()
    await disconnected
    return socketId
}

beforeAll(async () => {
    await connectTestDB()
    server = await startTestSocketServer()
})

afterEach(async () => {
    await disconnectTrackedSockets()
    await clearTestDB()
})

afterAll(async () => {
    await disconnectTrackedSockets()
    await stopTestSocketServer(server)
    await closeTestDB()
})

describe("notification socket routing", () => {
    it("delivers one notification update to each connected tab for the same user", async () => {
        const user = await createTestUser()
        const firstTab = createSocketAs(server.url, user)
        const secondTab = createSocketAs(server.url, user)
        await Promise.all([waitForConnect(firstTab), waitForConnect(secondTab)])

        const payload = {
            notificationId: new mongoose.Types.ObjectId(),
            type: "COMMENT_REPLY"
        }
        const firstEvent = waitForEvent(firstTab, "notifications:updated")
        const secondEvent = waitForEvent(secondTab, "notifications:updated")

        emitNotificationsUpdated({ recipientId: user._id, ...payload })

        const [firstReceived, secondReceived] = await Promise.all([firstEvent, secondEvent])
        const expected = { notificationId: String(payload.notificationId), type: payload.type }
        expect(firstReceived).toEqual(expected)
        expect(secondReceived).toEqual(expected)
    })

    it("does not deliver User A notifications to User B", async () => {
        const userA = await createTestUser()
        const userB = await createTestUser()
        const socketA = createSocketAs(server.url, userA)
        const socketB = createSocketAs(server.url, userB)
        await Promise.all([waitForConnect(socketA), waitForConnect(socketB)])

        const receivedByA = waitForEvent(socketA, "notifications:updated")
        const notReceivedByB = expectNoEvent(socketB, "notifications:updated")
        emitNotificationsUpdated({
            recipientId: userA._id,
            notificationId: new mongoose.Types.ObjectId(),
            type: "NOTE_SHARED"
        })

        expect((await receivedByA).type).toBe("NOTE_SHARED")
        await notReceivedByB
    })

    it("removes a disconnected tab from its user room", async () => {
        const user = await createTestUser()
        const disconnectedTab = createSocketAs(server.url, user)
        const activeTab = createSocketAs(server.url, user)
        await Promise.all([waitForConnect(disconnectedTab), waitForConnect(activeTab)])

        const disconnectedSocketId = await disconnectAndWaitForServer(disconnectedTab)

        const receivedByActiveTab = waitForEvent(activeTab, "notifications:updated")
        emitNotificationsUpdated({
            recipientId: user._id,
            notificationId: new mongoose.Types.ObjectId(),
            type: "COMMENT_RESOLVED"
        })

        expect((await receivedByActiveTab).type).toBe("COMMENT_RESOLVED")
        expect(disconnectedTab.connected).toBe(false)
        expect(server.io.sockets.adapter.rooms.get(getUserNotificationRoom(user._id))?.has(disconnectedSocketId) || false).toBe(false)
    })

    it("delivers exactly one notification after a user reconnects", async () => {
        const user = await createTestUser()
        const disconnectedSocket = createSocketAs(server.url, user)
        await waitForConnect(disconnectedSocket)
        const disconnectedSocketId = await disconnectAndWaitForServer(disconnectedSocket)
        const reconnectedSocket = createSocketAs(server.url, user)
        await waitForConnect(reconnectedSocket)

        let deliveryCount = 0
        const countDelivery = () => {
            deliveryCount += 1
        }
        reconnectedSocket.on("notifications:updated", countDelivery)
        const received = waitForEvent(reconnectedSocket, "notifications:updated")
        emitNotificationsUpdated({
            recipientId: user._id,
            notificationId: new mongoose.Types.ObjectId(),
            type: "COMMENT_REOPENED"
        })

        expect((await received).type).toBe("COMMENT_REOPENED")
        await expectNoEvent(reconnectedSocket, "notifications:updated")
        reconnectedSocket.off("notifications:updated", countDelivery)
        expect(deliveryCount).toBe(1)
        expect(server.io.sockets.sockets.has(disconnectedSocketId)).toBe(false)
    })

    it("keeps notification delivery singular across repeated reconnect cycles", async () => {
        const user = await createTestUser()
        const staleSocketIds = []
        let activeSocket = createSocketAs(server.url, user)
        await waitForConnect(activeSocket)

        staleSocketIds.push(await disconnectAndWaitForServer(activeSocket))
        activeSocket = createSocketAs(server.url, user)
        await waitForConnect(activeSocket)
        staleSocketIds.push(await disconnectAndWaitForServer(activeSocket))
        activeSocket = createSocketAs(server.url, user)
        await waitForConnect(activeSocket)

        let deliveryCount = 0
        const countDelivery = () => {
            deliveryCount += 1
        }
        activeSocket.on("notifications:updated", countDelivery)
        const received = waitForEvent(activeSocket, "notifications:updated")
        emitNotificationsUpdated({
            recipientId: user._id,
            notificationId: new mongoose.Types.ObjectId(),
            type: "NOTE_SHARED"
        })

        expect((await received).type).toBe("NOTE_SHARED")
        await expectNoEvent(activeSocket, "notifications:updated")
        activeSocket.off("notifications:updated", countDelivery)
        expect(deliveryCount).toBe(1)
        staleSocketIds.forEach((socketId) => {
            expect(server.io.sockets.sockets.has(socketId)).toBe(false)
        })
    })
})