import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import { corsOptions } from "./config/cors.js"
import { errorHandler } from "./middleware/error.middleware.js"
import authRouter from "./routes/auth.routes.js"
import commentRouter from "./routes/comment.routes.js"
import noteRouter from "./routes/note.routes.js"
import noteVersionRouter from "./routes/noteVersion.routes.js"
const app = express()

app.use(cors(corsOptions))

app.use(express.json({ limit: "1mb" }))
app.use(express.urlencoded({ extended: true, limit: "1mb" }))
app.use(cookieParser())

app.get("/", (req, res) => {
    res.send("Collaborative Notes API is running")
})
app.use("/api/v1/auth", authRouter)
app.use("/api/v1/notes", noteRouter)
app.use("/api/v1", commentRouter)
app.use("/api/v1", noteVersionRouter)
app.use(errorHandler)
export { app }


