import mongoose from "mongoose"
import Notification from "../models/notification.model.js"
import User from "../models/user.model.js"
import { emitNotificationsUpdated } from "../sockets/socketState.js"

const getActorId = (actor) => actor?._id || actor?.id || actor

const getActorName = (actor) => {
    return actor?.name || actor?.username || actor?.email || ""
}

const assertObjectId = (value, fieldName) => {
    if (!mongoose.isValidObjectId(value)) {
        throw new TypeError(`Invalid ${fieldName}`)
    }
}

const normalizeActor = (actor) => {
    const actorId = getActorId(actor)
    assertObjectId(actorId, "actor")

    return {
        _id: actorId,
        name: getActorName(actor)
    }
}

const isDuplicateNotificationError = (error) => {
    return error?.code === 11000 && (
        error?.keyPattern?.recipientId ||
        error?.keyPattern?.sourceActivityId
    )
}

const createNotification = async ({
    recipientId,
    actor,
    type,
    noteId,
    threadId = null,
    replyId = null,
    sourceActivityId,
    metadata = {}
}) => {
    assertObjectId(recipientId, "recipient")
    assertObjectId(noteId, "note")
    assertObjectId(sourceActivityId, "source activity")

    if (threadId !== null && threadId !== undefined) {
        assertObjectId(threadId, "thread")
    }

    if (replyId !== null && replyId !== undefined) {
        assertObjectId(replyId, "reply")
    }

    const actorSnapshot = normalizeActor(actor)

    if (String(recipientId) === String(actorSnapshot._id)) {
        return {
            created: false,
            skipped: "actor_is_recipient",
            notification: null
        }
    }

    const recipientExists = await User.exists({ _id: recipientId })

    if (!recipientExists) {
        return {
            created: false,
            skipped: "recipient_not_found",
            notification: null
        }
    }

    try {
        const notification = await Notification.create({
            recipientId,
            actor: actorSnapshot,
            type,
            noteId,
            threadId: threadId || null,
            replyId: replyId || null,
            sourceActivityId,
            metadata
        })

        emitNotificationsUpdated({
            recipientId: notification.recipientId,
            notificationId: notification._id,
            type: notification.type
        })

        return {
            created: true,
            notification
        }
    } catch (error) {
        if (isDuplicateNotificationError(error)) {
            return {
                created: false,
                duplicate: true,
                notification: null
            }
        }

        throw error
    }
}

const createNotificationBestEffort = async (input) => {
    try {
        return await createNotification(input)
    } catch (error) {
        console.error("Notification creation failed", {
            type: input?.type,
            recipientId: input?.recipientId ? String(input.recipientId) : null,
            sourceActivityId: input?.sourceActivityId ? String(input.sourceActivityId) : null,
            noteId: input?.noteId ? String(input.noteId) : null,
            error: error?.message || "Unknown notification error"
        })

        return {
            created: false,
            error
        }
    }
}

export {
    createNotification,
    createNotificationBestEffort
}