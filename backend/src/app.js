import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import { errorHandler } from "./middleware/error.middleware.js"
import authRouter from "./routes/auth.routes.js"
import noteRouter from "./routes/note.routes.js"
const app = express()

app.use(cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true
}))

app.use(express.json({ limit: "16kb" }))
app.use(express.urlencoded({ extended: true, limit: "16kb" }))
app.use(cookieParser())

app.get("/", (req, res) => {
    res.send("Collaborative Notes API is running")
})
app.use("/api/v1/auth", authRouter)
app.use("/api/v1/notes", noteRouter)
app.use(errorHandler)
export { app }


