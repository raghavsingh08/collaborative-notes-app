import mongoose from "mongoose"
import CommentReadState from "../models/commentReadState.model.js"

const assertObjectId = (value, fieldName) => {
    if (!mongoose.isValidObjectId(value)) {
        throw new TypeError(`Invalid ${fieldName}`)
    }
}

const normalizeThreadIds = (threadIds) => {
    if (!Array.isArray(threadIds)) {
        throw new TypeError("threadIds must be an array")
    }

    const uniqueThreadIds = new Set()

    threadIds.forEach((threadId) => {
        assertObjectId(threadId, "threadId")
        uniqueThreadIds.add(String(threadId))
    })

    return Array.from(uniqueThreadIds)
}

const markThreadAsRead = async (userId, threadId) => {
    assertObjectId(userId, "userId")
    assertObjectId(threadId, "threadId")

    return CommentReadState.findOneAndUpdate(
        {
            userId,
            threadId
        },
        {
            $set: {
                lastReadAt: new Date()
            }
        },
        {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        }
    )
}

const getThreadReadState = async (userId, threadIds) => {
    assertObjectId(userId, "userId")

    const normalizedThreadIds = normalizeThreadIds(threadIds)

    if (normalizedThreadIds.length === 0) {
        return []
    }

    return CommentReadState.find({
        userId,
        threadId: {
            $in: normalizedThreadIds
        }
    })
}

export {
    getThreadReadState,
    markThreadAsRead
}
