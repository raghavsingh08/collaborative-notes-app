import { io } from "socket.io-client"

const socketUrl = import.meta.env.VITE_SOCKET_URL || "http://localhost:8000"

const socket = io(socketUrl, {
    withCredentials: true,
    autoConnect: false
})

export default socket
