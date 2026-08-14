import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { getUserNotificationRoom } from "../../../src/sockets/socketState.js"
import { createSocket, createSocketAs, disconnectTrackedSockets, waitForConnect, waitForConnectError } from "../../helpers/socket.js"
import { createTestUser } from "../../helpers/factories.js"
import { clearTestDB, closeTestDB, connectTestDB } from "../../setup/testDb.js"
import { startTestSocketServer, stopTestSocketServer } from "../../setup/socketTestServer.js"

let server

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

describe("socket authentication", () => {
    it("connects an authenticated user and assigns its default and user rooms", async () => {
        const user = await createTestUser()
        const socket = createSocketAs(server.url, user)

        await waitForConnect(socket)

        const serverSocket = server.io.sockets.sockets.get(socket.id)
        expect(serverSocket).toBeTruthy()
        expect(serverSocket.rooms.has(socket.id)).toBe(true)
        expect(serverSocket.rooms.has(getUserNotificationRoom(user._id))).toBe(true)
    })

    it("rejects a socket without the accessToken cookie", async () => {
        const user = await createTestUser()
        const socket = createSocket(server.url)

        const error = await waitForConnectError(socket)

        expect(error).toBeInstanceOf(Error)
        expect(socket.connected).toBe(false)
        expect(server.io.sockets.adapter.rooms.has(getUserNotificationRoom(user._id))).toBe(false)
    })
})