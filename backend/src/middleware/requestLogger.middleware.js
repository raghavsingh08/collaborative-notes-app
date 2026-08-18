import { writeLog } from "../utils/logger.js"

const requestLogger = (req, res, next) => {
    const startedAt = process.hrtime.bigint()

    res.once("finish", () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000

        writeLog("info", "http_request_completed", {
            requestId: req.id,
            providerRequestId: req.get("Rndr-Id") || req.get("CF-Ray"),
            method: req.method,
            path: req.baseUrl + req.path,
            status: res.statusCode,
            durationMs: Math.round(durationMs * 100) / 100,
            userId: req.user?._id ? String(req.user._id) : undefined
        })
    })

    next()
}

export { requestLogger }