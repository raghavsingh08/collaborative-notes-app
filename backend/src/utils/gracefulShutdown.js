import { logError, writeLog } from "./logger.js"

const closeHttpServer = (httpServer) => new Promise((resolve, reject) => {
    httpServer.close((error) => {
        if (error && error.code !== "ERR_SERVER_NOT_RUNNING") {
            reject(error)
            return
        }

        resolve()
    })
})

const closeSocketServer = (io) => new Promise((resolve) => {
    if (!io) {
        resolve()
        return
    }

    io.close(resolve)
})

const createGracefulShutdown = ({
    httpServer,
    io,
    disconnectDatabase,
    awaitPendingYjsPersistence,
    markShuttingDown,
    timeoutMs = 25_000
}) => {
    let shutdownPromise = null

    return (signal) => {
        if (shutdownPromise) {
            return shutdownPromise
        }

        shutdownPromise = (async () => {
            markShuttingDown?.()
            writeLog("info", "shutdown_started", { signal })

            const shutdownWork = (async () => {
                const serverClosed = closeHttpServer(httpServer)

                await closeSocketServer(io)
                await serverClosed
                await awaitPendingYjsPersistence()
                await disconnectDatabase()

                return true
            })().catch((error) => {
                logError("shutdown_failed", error, { signal })
                return false
            })
            let timeoutId
            const timeout = new Promise((resolve) => {
                timeoutId = setTimeout(() => resolve(false), timeoutMs)
            })
            const completed = await Promise.race([shutdownWork, timeout])
            clearTimeout(timeoutId)

            if (completed) {
                writeLog("info", "shutdown_completed", { signal })
            } else {
                writeLog("warn", "shutdown_timed_out", { signal, timeoutMs })
            }

            return completed
        })()

        return shutdownPromise
    }
}

export { createGracefulShutdown }