import { io as createSocketClient } from "socket.io-client"
import { accessTokenFor } from "./auth.js"

const DEFAULT_TIMEOUT_MS = 2000
const NO_EVENT_TIMEOUT_MS = 300
const trackedSockets = new Set()

const createSocket = (url, options = {}) => {
    const socket = createSocketClient(url, {
        autoConnect: false,
        reconnection: false,
        transports: ["websocket"],
        ...options
    })

    trackedSockets.add(socket)
    return socket
}

const createSocketAs = (url, user, options = {}) => createSocket(url, {
    extraHeaders: {
        Cookie: `accessToken=${accessTokenFor(user)}`
    },
    ...options
})

const withTimeout = (timeoutMs, onTimeout) => setTimeout(onTimeout, timeoutMs)

const waitForConnect = (socket, timeoutMs = DEFAULT_TIMEOUT_MS) => new Promise((resolve, reject) => {
    const cleanup = () => {
        clearTimeout(timeout)
        socket.off("connect", handleConnect)
        socket.off("connect_error", handleConnectError)
    }
    const handleConnect = () => {
        cleanup()
        resolve(socket)
    }
    const handleConnectError = (error) => {
        cleanup()
        reject(error)
    }
    const timeout = withTimeout(timeoutMs, () => {
        cleanup()
        reject(new Error("Timed out waiting for socket connection"))
    })

    socket.on("connect", handleConnect)
    socket.on("connect_error", handleConnectError)
    socket.connect()
})

const waitForConnectError = (socket, timeoutMs = DEFAULT_TIMEOUT_MS) => new Promise((resolve, reject) => {
    const cleanup = () => {
        clearTimeout(timeout)
        socket.off("connect", handleConnect)
        socket.off("connect_error", handleConnectError)
    }
    const handleConnect = () => {
        cleanup()
        reject(new Error("Socket connected when authentication should have failed"))
    }
    const handleConnectError = (error) => {
        cleanup()
        resolve(error)
    }
    const timeout = withTimeout(timeoutMs, () => {
        cleanup()
        reject(new Error("Timed out waiting for socket connection failure"))
    })

    socket.on("connect", handleConnect)
    socket.on("connect_error", handleConnectError)
    socket.connect()
})

const waitForEvent = (socket, eventName, timeoutMs = DEFAULT_TIMEOUT_MS, predicate = () => true) => new Promise((resolve, reject) => {
    const cleanup = () => {
        clearTimeout(timeout)
        socket.off(eventName, handleEvent)
    }
    const handleEvent = (payload) => {
        if (!predicate(payload)) {
            return
        }

        cleanup()
        resolve(payload)
    }
    const timeout = withTimeout(timeoutMs, () => {
        cleanup()
        reject(new Error(`Timed out waiting for ${eventName}`))
    })

    socket.on(eventName, handleEvent)
})

const expectNoEvent = (socket, eventName, timeoutMs = NO_EVENT_TIMEOUT_MS) => new Promise((resolve, reject) => {
    const cleanup = () => {
        clearTimeout(timeout)
        socket.off(eventName, handleEvent)
    }
    const handleEvent = (payload) => {
        cleanup()
        reject(new Error(`Unexpected ${eventName}: ${JSON.stringify(payload)}`))
    }
    const timeout = withTimeout(timeoutMs, () => {
        cleanup()
        resolve()
    })

    socket.on(eventName, handleEvent)
})

const joinNote = (socket, noteId, timeoutMs = DEFAULT_TIMEOUT_MS) => new Promise((resolve, reject) => {
    const cleanup = () => {
        clearTimeout(timeout)
        socket.off("v2:note:joined", handleJoined)
        socket.off("v2:note:error", handleError)
    }
    const handleJoined = (payload = {}) => {
        if (String(payload.noteId) !== String(noteId)) {
            return
        }

        cleanup()
        resolve(payload)
    }
    const handleError = (message) => {
        cleanup()
        reject(new Error(String(message)))
    }
    const timeout = withTimeout(timeoutMs, () => {
        cleanup()
        reject(new Error("Timed out waiting for V2 note join"))
    })

    socket.on("v2:note:joined", handleJoined)
    socket.on("v2:note:error", handleError)
    socket.emit("v2:note:join", { noteId })
})

const disconnectTrackedSockets = async () => {
    trackedSockets.forEach((socket) => {
        socket.removeAllListeners()
        socket.disconnect()
    })
    trackedSockets.clear()
}

export {
    createSocket,
    createSocketAs,
    disconnectTrackedSockets,
    expectNoEvent,
    joinNote,
    waitForConnect,
    waitForConnectError,
    waitForEvent
}