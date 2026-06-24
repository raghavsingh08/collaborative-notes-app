import dotenv from "dotenv"
import dns from "dns"
import { createServer } from "http"
import { app } from "./app.js"
import connectDB from "./config/db.js"
import { initializeSocket } from "./sockets/index.js"

dotenv.config({
    path: "./.env"
})

dns.setServers(["8.8.8.8", "8.8.4.4"])

const PORT = process.env.PORT || 8000
const httpServer = createServer(app)

initializeSocket(httpServer)

connectDB()
    .then(() => {
        httpServer.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`)
        })
    })
    .catch((error) => {
        console.log("MongoDB connection failed:", error)
    })
