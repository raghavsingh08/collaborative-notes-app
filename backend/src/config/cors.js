const defaultCorsOrigin = "http://localhost:5173"

const getAllowedOrigins = () => {
    return (process.env.CORS_ORIGIN || defaultCorsOrigin)
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
}

const corsOrigin = (origin, callback) => {
    const allowedOrigins = getAllowedOrigins()

    if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
        return
    }

    callback(new Error("Not allowed by CORS"))
}

const corsOptions = {
    origin: corsOrigin,
    credentials: true
}

export {
    corsOptions
}
