import dotenv from "dotenv"
import dns from "dns"
import { createServer } from "http"
import { app } from "./app.js"
import connectDB, { disconnectDB } from "./config/db.js"
import { validateEnvironment } from "./config/env.js"
import { initializeSocket } from "./sockets/index.js"
import { awaitAllPendingYjsPersistence } from "./utils/yjsNoteState.js"
import { createGracefulShutdown } from "./utils/gracefulShutdown.js"
import { logError, writeLog } from "./utils/logger.js"

dotenv.config({
    path: "./.env"
})

app.set("trust proxy", process.env.NODE_ENV === "production" ? 1 : false)

dns.setServers(["8.8.8.8", "8.8.4.4"])

const listen = (httpServer, port) => new Promise((resolve, reject) => {
    httpServer.once("error", reject)
    httpServer.listen(port, () => {
        httpServer.off("error", reject)
        resolve()
    })
})

const startServer = async () => {
    validateEnvironment()
    await connectDB()

    const port = process.env.PORT || 8000
    const httpServer = createServer(app)
    const io = initializeSocket(httpServer)

    await listen(httpServer, port)

    const shutdown = createGracefulShutdown({
        httpServer,
        io,
        disconnectDatabase: disconnectDB,
        awaitPendingYjsPersistence: awaitAllPendingYjsPersistence,
        markShuttingDown: () => {
            app.locals.isShuttingDown = true
        }
    })
    const handleSignal = async (signal) => {
        const completed = await shutdown(signal)
        process.exit(completed ? 0 : 1)
    }

    process.once("SIGTERM", () => {
        void handleSignal("SIGTERM")
    })
    process.once("SIGINT", () => {
        void handleSignal("SIGINT")
    })

    writeLog("info", "server_started", { port })
}

startServer().catch(async (error) => {
    logError("server_start_failed", error)
    await disconnectDB().catch(() => {})
    process.exit(1)
})