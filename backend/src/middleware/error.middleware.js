import { ApiError } from "../utils/ApiError.js"
import { logError } from "../utils/logger.js"

const isOperationalError = (error, statusCode) => (
    error instanceof ApiError || (statusCode >= 400 && statusCode < 500)
)

const errorHandler = (err, req, res, next) => {
    const statusCode = Number.isInteger(err.statusCode) ? err.statusCode : 500
    const operational = isOperationalError(err, statusCode)
    const exposeDetails = process.env.NODE_ENV !== "production" || operational
    const message = exposeDetails
        ? err.message || "Internal Server Error"
        : "Internal server error"

    logError("http_request_failed", err, {
        requestId: req.id,
        method: req.method,
        path: req.baseUrl + req.path,
        statusCode,
        operational
    })

    return res.status(statusCode).json({
        success: false,
        statusCode,
        message,
        errors: exposeDetails ? err.errors || [] : [],
        ...(exposeDetails && err.code ? { code: err.code } : {}),
        ...(exposeDetails && err.currentContentRevision !== undefined
            ? { currentContentRevision: err.currentContentRevision }
            : {})
    })
}

export { errorHandler }