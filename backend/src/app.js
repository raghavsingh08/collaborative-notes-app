import express from "express"
import cors from "cors"
import helmet from "helmet"
import cookieParser from "cookie-parser"
import mongoose from "mongoose"
import { corsOptions } from "./config/cors.js"
import { errorHandler } from "./middleware/error.middleware.js"
import { enforceAllowedOrigin } from "./middleware/origin.middleware.js"
import { apiRateLimiter, authRateLimiter } from "./middleware/rateLimit.middleware.js"
import { requestId } from "./middleware/requestId.middleware.js"
import { requestLogger } from "./middleware/requestLogger.middleware.js"
import authRouter from "./routes/auth.routes.js"
import commentRouter from "./routes/comment.routes.js"
import noteRouter from "./routes/note.routes.js"
import noteVersionRouter from "./routes/noteVersion.routes.js"
import notificationRouter from "./routes/notification.routes.js"

const app = express()

app.set("trust proxy", process.env.NODE_ENV === "production" ? 1 : false)
app.locals.isShuttingDown = false

app.use(requestId)
app.use(requestLogger)
app.use(helmet())
app.use(cors(corsOptions))
app.use(enforceAllowedOrigin)
app.use(express.json({ limit: "1mb" }))
app.use(express.urlencoded({ extended: true, limit: "1mb" }))
app.use(cookieParser())

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        uptime: Math.floor(process.uptime())
    })
})

app.get("/ready", (req, res) => {
    const ready = !app.locals.isShuttingDown && mongoose.connection.readyState === 1

    res.status(ready ? 200 : 503).json({
        status: ready ? "ready" : "not_ready"
    })
})

app.get("/", (req, res) => {
    res.send("Collaborative Notes API is running")
})

app.use("/api/v1/auth", authRateLimiter, authRouter)
app.use("/api/v1", apiRateLimiter)
app.use("/api/v1/notes", noteRouter)
app.use("/api/v1", commentRouter)
app.use("/api/v1", noteVersionRouter)
app.use("/api/v1/notifications", notificationRouter)
app.use(errorHandler)

export { app }