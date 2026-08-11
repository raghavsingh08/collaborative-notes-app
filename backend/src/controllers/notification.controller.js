import mongoose from "mongoose"
import Notification from "../models/notification.model.js"
import { emitNotificationsUpdated } from "../sockets/socketState.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const DEFAULT_LIMIT = 30
const MAX_LIMIT = 100

const parseLimit = (value) => {
    if (value === undefined) {
        return DEFAULT_LIMIT
    }

    if (!/^\d+$/.test(String(value))) {
        throw new ApiError(400, "limit must be a positive integer")
    }

    const limit = Number(value)

    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
        throw new ApiError(400, `limit must be between 1 and ${MAX_LIMIT}`)
    }

    return limit
}

const decodeCursor = (value) => {
    if (typeof value !== "string" || !value.trim()) {
        throw new ApiError(400, "Invalid notification cursor")
    }

    try {
        const decoded = Buffer.from(value, "base64url").toString("utf8")
        const parsed = JSON.parse(decoded)

        if (
            typeof parsed?.createdAt !== "string" ||
            !mongoose.isValidObjectId(parsed?._id)
        ) {
            throw new Error("Malformed cursor")
        }

        const createdAt = new Date(parsed.createdAt)

        if (Number.isNaN(createdAt.getTime())) {
            throw new Error("Malformed cursor")
        }

        return {
            createdAt,
            _id: new mongoose.Types.ObjectId(parsed._id)
        }
    } catch {
        throw new ApiError(400, "Invalid notification cursor")
    }
}

const encodeCursor = (notification) => {
    return Buffer.from(JSON.stringify({
        createdAt: notification.createdAt.toISOString(),
        _id: String(notification._id)
    })).toString("base64url")
}

const formatNotification = (notification) => ({
    _id: notification._id,
    type: notification.type,
    actor: notification.actor,
    noteId: notification.noteId,
    threadId: notification.threadId || null,
    replyId: notification.replyId || null,
    metadata: notification.metadata || {},
    readAt: notification.readAt || null,
    createdAt: notification.createdAt
})

const getNotifications = asyncHandler(async (req, res) => {
    const limit = parseLimit(req.query.limit)
    const cursor = req.query.cursor === undefined ? null : decodeCursor(req.query.cursor)
    const query = {
        recipientId: req.user._id
    }

    if (cursor) {
        query.$or = [
            { createdAt: { $lt: cursor.createdAt } },
            {
                createdAt: cursor.createdAt,
                _id: { $lt: cursor._id }
            }
        ]
    }

    const [notifications, unreadCount] = await Promise.all([
        Notification.find(query)
            .sort({ createdAt: -1, _id: -1 })
            .limit(limit + 1)
            .lean(),
        Notification.countDocuments({
            recipientId: req.user._id,
            readAt: null
        })
    ])

    const hasNextPage = notifications.length > limit
    const items = notifications
        .slice(0, limit)
        .map(formatNotification)
    const lastItem = items[items.length - 1]

    return res
        .status(200)
        .json(new ApiResponse(
            200,
            {
                items,
                nextCursor: hasNextPage && lastItem ? encodeCursor(lastItem) : null,
                unreadCount
            },
            "Notifications fetched successfully"
        ))
})

const markNotificationAsRead = asyncHandler(async (req, res) => {
    const { notificationId } = req.params

    if (!mongoose.isValidObjectId(notificationId)) {
        throw new ApiError(404, "Notification not found")
    }

    const readAt = new Date()
    let notification = await Notification.findOneAndUpdate(
        {
            _id: notificationId,
            recipientId: req.user._id,
            readAt: null
        },
        {
            $set: { readAt }
        },
        {
            returnDocument: "after"
        }
    )

    if (notification) {
        emitNotificationsUpdated({
            recipientId: req.user._id,
            notificationId: notification._id
        })
    } else {
        notification = await Notification.findOne({
            _id: notificationId,
            recipientId: req.user._id
        }).select("_id readAt")
    }

    if (!notification) {
        throw new ApiError(404, "Notification not found")
    }

    return res
        .status(200)
        .json(new ApiResponse(
            200,
            {
                notificationId: notification._id,
                readAt: notification.readAt
            },
            "Notification marked as read"
        ))
})

const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
    const readAt = new Date()
    const result = await Notification.updateMany(
        {
            recipientId: req.user._id,
            readAt: null
        },
        {
            $set: { readAt }
        }
    )

    if (result.modifiedCount > 0) {
        emitNotificationsUpdated({
            recipientId: req.user._id
        })
    }

    return res
        .status(200)
        .json(new ApiResponse(
            200,
            {
                modifiedCount: result.modifiedCount,
                readAt
            },
            "Notifications marked as read"
        ))
})

export {
    getNotifications,
    markAllNotificationsAsRead,
    markNotificationAsRead
}