import { createServer } from "http"
import { app } from "../../src/app.js"
import { initializeSocket } from "../../src/sockets/index.js"
import { setSocketServer } from "../../src/sockets/socketState.js"

const listen = (httpServer) => new Promise((resolve, reject) => {
    const handleError = (error) => {
        httpServer.off("listening", handleListening)
        reject(error)
    }
    const handleListening = () => {
        httpServer.off("error", handleError)
        resolve()
    }

    httpServer.once("error", handleError)
    httpServer.once("listening", handleListening)
    httpServer.listen(0, "127.0.0.1")
})

const closeHttpServer = (httpServer) => new Promise((resolve, reject) => {
    httpServer.close((error) => {
        if (error && error.code !== "ERR_SERVER_NOT_RUNNING") {
            reject(error)
            return
        }

        resolve()
    })
})

const startTestSocketServer = async () => {
    const httpServer = createServer(app)
    const io = initializeSocket(httpServer)

    await listen(httpServer)

    const address = httpServer.address()
    if (!address || typeof address === "string") {
        await new Promise((resolve) => io.close(resolve))
        await closeHttpServer(httpServer)
        setSocketServer(null)
        throw new Error("Socket test server did not receive a TCP address")
    }

    return {
        io,
        httpServer,
        url: `http://127.0.0.1:${address.port}`
    }
}

const stopTestSocketServer = async ({ io, httpServer } = {}) => {
    if (io) {
        await new Promise((resolve) => io.close(resolve))
    }

    if (httpServer) {
        await closeHttpServer(httpServer)
    }

    setSocketServer(null)
}

export {
    startTestSocketServer,
    stopTestSocketServer
}