import { MongoMemoryServer } from "mongodb-memory-server"

export default async function setup(project) {
    const memoryServer = await MongoMemoryServer.create()
    const uri = memoryServer.getUri()

    if (!uri || !uri.includes("127.0.0.1")) {
        await memoryServer.stop()
        throw new Error("Integration tests require a MongoMemoryServer URI")
    }

    project.provide("testMongoUri", uri)

    return async () => {
        await memoryServer.stop()
    }
}