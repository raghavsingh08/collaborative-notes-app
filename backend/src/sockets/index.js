import jwt from "jsonwebtoken"
import { Server } from "socket.io"
import User from "../models/user.model.js"
import { corsOptions } from "../config/cors.js"
import { registerNoteSocketHandlers } from "./note.socket.js"
import { setSocketServer } from "./socketState.js"

const parseCookies = (cookieHeader = "") => {
    return cookieHeader.split(";").reduce((cookies, cookie) => {
        const [name, ...rest] = cookie.trim().split("=")

        if (!name) {
            return cookies
        }

        cookies[name] = decodeURIComponent(rest.join("="))
        return cookies
    }, {})
}

const initializeSocket = (httpServer) => {
    const io = new Server(httpServer, {
        cors: corsOptions
    })

    setSocketServer(io)

    io.use(async (socket, next) => {
        try {
            const cookies = parseCookies(socket.handshake.headers.cookie)
            const token = cookies.accessToken

            if (!token) {
                return next(new Error("Unauthorized request"))
            }

            if (!process.env.ACCESS_TOKEN_SECRET) {
                return next(new Error("Access token secret is not configured"))
            }

            const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
            const user = await User.findById(decodedToken?._id).select("-password")

            if (!user) {
                return next(new Error("Invalid access token"))
            }

            socket.user = user
            next()
        } catch {
            next(new Error("Invalid access token"))
        }
    })

    io.on("connection", (socket) => {
        registerNoteSocketHandlers(io, socket)
    })

    return io
}

export { initializeSocket }
