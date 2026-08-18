const defaultCorsOrigin = "http://localhost:5173"

const getAllowedOrigins = () => {
    return (process.env.CORS_ORIGIN || defaultCorsOrigin)
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
}

const isAllowedOrigin = (origin) => getAllowedOrigins().includes(origin)

const corsOrigin = (origin, callback) => {
    if (!origin || isAllowedOrigin(origin)) {
        callback(null, true)
        return
    }

    const error = new Error("Origin is not allowed")
    error.statusCode = 403
    error.code = "CORS_ORIGIN_NOT_ALLOWED"
    callback(error)
}

const corsOptions = {
    origin: corsOrigin,
    credentials: true
}

export {
    corsOptions,
    getAllowedOrigins,
    isAllowedOrigin
}