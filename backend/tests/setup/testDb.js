import mongoose from "mongoose"
import { inject } from "vitest"

const memoryUri = inject("testMongoUri")

const assertTestEnvironment = () => {
    if (process.env.NODE_ENV !== "test") {
        throw new Error("Integration tests require NODE_ENV=test")
    }

    if (process.env.MONGODB_URI) {
        throw new Error("Integration tests must not use MONGODB_URI")
    }

    if (!memoryUri || !memoryUri.includes("127.0.0.1")) {
        throw new Error("Integration tests require a MongoMemoryServer URI")
    }
}

const connectTestDB = async () => {
    assertTestEnvironment()
    await mongoose.connect(memoryUri)
    await mongoose.connection.syncIndexes()
}

const clearTestDB = async () => {
    const collections = Object.values(mongoose.connection.collections)
    await Promise.all(collections.map((collection) => collection.deleteMany({})))
}

const closeTestDB = async () => {
    await mongoose.disconnect()
}

export {
    clearTestDB,
    closeTestDB,
    connectTestDB
}