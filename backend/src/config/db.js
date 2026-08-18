import mongoose from "mongoose"
import { logError, writeLog } from "../utils/logger.js"

const mongoConnectionOptions = {
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
    maxPoolSize: 10,
    minPoolSize: 0
}

mongoose.connection.on("connected", () => {
    writeLog("info", "mongodb_connected")
})

mongoose.connection.on("disconnected", () => {
    writeLog("warn", "mongodb_disconnected")
})

mongoose.connection.on("error", (error) => {
    logError("mongodb_connection_error", error)
})

const isMongoReady = () => mongoose.connection.readyState === 1

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, mongoConnectionOptions)
    } catch (error) {
        logError("mongodb_initial_connection_failed", error)
        throw error
    }
}

const disconnectDB = async () => {
    if (mongoose.connection.readyState === 0) {
        return
    }

    await mongoose.disconnect()
}

export {
    disconnectDB,
    isMongoReady,
    mongoConnectionOptions
}

export default connectDB