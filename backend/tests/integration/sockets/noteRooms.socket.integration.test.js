import mongoose from "mongoose"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import {
    emitActivityUpdated,
    emitCommentUpdate,
    emitNotificationsUpdated,
    getUserNotificationRoom
} from "../../../src/sockets/socketState.js"
import {
    createSocketAs,
    disconnectTrackedSockets,
    expectNoEvent,
    joinNote,
    waitForConnect,
    waitForEvent
} from "../../helpers/socket.js"
import { createTestNote, createTestUser } from "../../helpers/factories.js"
import { clearTestDB, closeTestDB, connectTestDB } from "../../setup/testDb.js"
import { startTestSocketServer, stopTestSocketServer } from "../../setup/socketTestServer.js"

let server

const getV2Room = (noteId) => `note:v2:${String(noteId)}`

const waitForRoomMembership = (socketId, room, expected, timeoutMs = 1000) => new Promise((resolve, reject) => {
    const startedAt = Date.now()
    const check = () => {
        const isMember = server.io.sockets.adapter.rooms.get(room)?.has(socketId) || false

        if (isMember === expected) {
            resolve()
            return
        }

        if (Date.now() - startedAt >= timeoutMs) {
            reject(new Error(`Timed out waiting for room membership ${room}`))
            return
        }

        setTimeout(check, 10)
    }

    check()
})

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

describe("V2 note-room socket routing", () => {
    it("allows the note owner to join the V2 note room", async () => {
        const owner = await createTestUser()
        const note = await createTestNote({ owner })
        const socket = createSocketAs(server.url, owner)
        await waitForConnect(socket)

        const joined = await joinNote(socket, note._id)

        expect(String(joined.noteId)).toBe(String(note._id))
        expect(server.io.sockets.adapter.rooms.get(getV2Room(note._id))?.has(socket.id)).toBe(true)
    })

    it("allows a shared collaborator to join the V2 note room", async () => {
        const owner = await createTestUser()
        const collaborator = await createTestUser()
        const note = await createTestNote({ owner, sharedWith: [collaborator._id] })
        const socket = createSocketAs(server.url, collaborator)
        await waitForConnect(socket)

        await expect(joinNote(socket, note._id)).resolves.toMatchObject({ noteId: String(note._id) })
        expect(server.io.sockets.adapter.rooms.get(getV2Room(note._id))?.has(socket.id)).toBe(true)
    })

    it("rejects an outsider from a V2 note room and keeps it isolated", async () => {
        const owner = await createTestUser()
        const outsider = await createTestUser()
        const note = await createTestNote({ owner })
        const socket = createSocketAs(server.url, outsider)
        await waitForConnect(socket)

        await expect(joinNote(socket, note._id)).rejects.toBeInstanceOf(Error)
        expect(server.io.sockets.adapter.rooms.get(getV2Room(note._id))?.has(socket.id) || false).toBe(false)

        const noCommentUpdate = expectNoEvent(socket, "comments:updated")
        emitCommentUpdate({
            noteId: note._id,
            threadId: new mongoose.Types.ObjectId(),
            action: "created",
            updatedBy: owner._id
        })
        await noCommentUpdate
    })

    it("rejects a join to a valid-looking nonexistent note", async () => {
        const user = await createTestUser()
        const socket = createSocketAs(server.url, user)
        const nonexistentNoteId = new mongoose.Types.ObjectId()
        await waitForConnect(socket)

        await expect(joinNote(socket, nonexistentNoteId)).rejects.toBeInstanceOf(Error)
        expect(server.io.sockets.adapter.rooms.get(getV2Room(nonexistentNoteId))?.has(socket.id) || false).toBe(false)
    })

    it("routes comments updates only to sockets joined to the target V2 note room", async () => {
        const owner = await createTestUser()
        const collaborator = await createTestUser()
        const otherOwner = await createTestUser()
        const note = await createTestNote({ owner, sharedWith: [collaborator._id] })
        const otherNote = await createTestNote({ owner: otherOwner })
        const ownerSocket = createSocketAs(server.url, owner)
        const collaboratorSocket = createSocketAs(server.url, collaborator)
        const otherSocket = createSocketAs(server.url, otherOwner)
        await Promise.all([waitForConnect(ownerSocket), waitForConnect(collaboratorSocket), waitForConnect(otherSocket)])
        await Promise.all([joinNote(ownerSocket, note._id), joinNote(collaboratorSocket, note._id), joinNote(otherSocket, otherNote._id)])

        const payload = {
            noteId: note._id,
            threadId: new mongoose.Types.ObjectId(),
            replyId: new mongoose.Types.ObjectId(),
            anchorId: "anchor-test",
            action: "replied",
            updatedBy: owner._id
        }
        const ownerEvent = waitForEvent(ownerSocket, "comments:updated")
        const collaboratorEvent = waitForEvent(collaboratorSocket, "comments:updated")
        const noOtherEvent = expectNoEvent(otherSocket, "comments:updated")
        emitCommentUpdate(payload)

        const expected = {
            noteId: String(payload.noteId),
            threadId: String(payload.threadId),
            replyId: String(payload.replyId),
            anchorId: payload.anchorId,
            action: payload.action,
            updatedBy: String(payload.updatedBy)
        }
        expect(await ownerEvent).toEqual(expected)
        expect(await collaboratorEvent).toEqual(expected)
        await noOtherEvent
    })

    it("routes activity updates only to sockets joined to the target V2 note room", async () => {
        const owner = await createTestUser()
        const otherOwner = await createTestUser()
        const note = await createTestNote({ owner })
        const otherNote = await createTestNote({ owner: otherOwner })
        const ownerSocket = createSocketAs(server.url, owner)
        const otherSocket = createSocketAs(server.url, otherOwner)
        await Promise.all([waitForConnect(ownerSocket), waitForConnect(otherSocket)])
        await Promise.all([joinNote(ownerSocket, note._id), joinNote(otherSocket, otherNote._id)])

        const payload = {
            noteId: note._id,
            activityId: new mongoose.Types.ObjectId(),
            type: "COMMENT_RESOLVED",
            actorId: owner._id,
            createdAt: new Date("2026-01-01T00:00:00.000Z")
        }
        const ownerEvent = waitForEvent(ownerSocket, "activity:updated")
        const noOtherEvent = expectNoEvent(otherSocket, "activity:updated")
        emitActivityUpdated(payload)

        expect(await ownerEvent).toEqual({
            noteId: String(payload.noteId),
            activityId: String(payload.activityId),
            type: payload.type,
            actorId: String(payload.actorId),
            createdAt: payload.createdAt.toISOString()
        })
        await noOtherEvent
    })

    it("keeps one delivery after duplicate V2 note joins", async () => {
        const owner = await createTestUser()
        const note = await createTestNote({ owner })
        const socket = createSocketAs(server.url, owner)
        await waitForConnect(socket)
        await joinNote(socket, note._id)
        await joinNote(socket, note._id)

        const room = server.io.sockets.adapter.rooms.get(getV2Room(note._id))
        expect(room?.size).toBe(1)

        let receivedCount = 0
        const countEvent = () => {
            receivedCount += 1
        }
        socket.on("comments:updated", countEvent)
        const received = waitForEvent(socket, "comments:updated")
        emitCommentUpdate({
            noteId: note._id,
            threadId: new mongoose.Types.ObjectId(),
            action: "created",
            updatedBy: owner._id
        })

        await received
        await expectNoEvent(socket, "comments:updated")
        socket.off("comments:updated", countEvent)
        expect(receivedCount).toBe(1)
    })

    it("removes note delivery on leave and restores it after rejoin", async () => {
        const owner = await createTestUser()
        const note = await createTestNote({ owner })
        const socket = createSocketAs(server.url, owner)
        const room = getV2Room(note._id)
        await waitForConnect(socket)
        await joinNote(socket, note._id)

        const firstDelivery = waitForEvent(socket, "comments:updated")
        emitCommentUpdate({ noteId: note._id, threadId: new mongoose.Types.ObjectId(), action: "created", updatedBy: owner._id })
        await firstDelivery

        socket.emit("v2:note:leave", { noteId: note._id })
        await waitForRoomMembership(socket.id, room, false)
        const noDeliveryAfterLeave = expectNoEvent(socket, "comments:updated")
        emitCommentUpdate({ noteId: note._id, threadId: new mongoose.Types.ObjectId(), action: "created", updatedBy: owner._id })
        await noDeliveryAfterLeave

        await joinNote(socket, note._id)
        const deliveryAfterRejoin = waitForEvent(socket, "comments:updated")
        emitCommentUpdate({ noteId: note._id, threadId: new mongoose.Types.ObjectId(), action: "created", updatedBy: owner._id })
        await deliveryAfterRejoin
    })

    it("automatically restores user-room delivery after reconnect but requires a V2 note rejoin", async () => {
        const owner = await createTestUser()
        const note = await createTestNote({ owner })
        const firstConnection = createSocketAs(server.url, owner)
        await waitForConnect(firstConnection)
        await joinNote(firstConnection, note._id)

        const initialNotification = waitForEvent(firstConnection, "notifications:updated")
        const initialComment = waitForEvent(firstConnection, "comments:updated")
        emitNotificationsUpdated({ recipientId: owner._id, notificationId: new mongoose.Types.ObjectId(), type: "NOTE_SHARED" })
        emitCommentUpdate({ noteId: note._id, threadId: new mongoose.Types.ObjectId(), action: "created", updatedBy: owner._id })
        await Promise.all([initialNotification, initialComment])

        const firstSocketId = firstConnection.id
        const firstServerSocket = server.io.sockets.sockets.get(firstSocketId)
        const firstServerDisconnect = new Promise((resolve) => firstServerSocket.once("disconnect", resolve))
        firstConnection.disconnect()
        await firstServerDisconnect
        await waitForRoomMembership(firstSocketId, getV2Room(note._id), false)

        const reconnectedSocket = createSocketAs(server.url, owner)
        await waitForConnect(reconnectedSocket)
        expect(server.io.sockets.adapter.rooms.get(getUserNotificationRoom(owner._id))?.has(reconnectedSocket.id)).toBe(true)

        const notificationAfterReconnect = waitForEvent(reconnectedSocket, "notifications:updated")
        emitNotificationsUpdated({ recipientId: owner._id, notificationId: new mongoose.Types.ObjectId(), type: "COMMENT_REPLY" })
        expect((await notificationAfterReconnect).type).toBe("COMMENT_REPLY")

        const noCommentBeforeRejoin = expectNoEvent(reconnectedSocket, "comments:updated")
        emitCommentUpdate({ noteId: note._id, threadId: new mongoose.Types.ObjectId(), action: "created", updatedBy: owner._id })
        await noCommentBeforeRejoin

        await joinNote(reconnectedSocket, note._id)
        const commentAfterRejoin = waitForEvent(reconnectedSocket, "comments:updated")
        emitCommentUpdate({ noteId: note._id, threadId: new mongoose.Types.ObjectId(), action: "created", updatedBy: owner._id })
        await commentAfterRejoin
    })
})