import ActivityEvent from "../models/activityEvent.model.js"

const getActorName = (actor) => {
    return actor?.name || actor?.username || actor?.email || ""
}

const getActorAvatar = (actor) => {
    return actor?.avatar || actor?.profileImage || ""
}

const normalizeActor = (actor) => {
    const actorId = actor?._id || actor?.id || actor

    return {
        _id: actorId,
        name: getActorName(actor),
        avatar: getActorAvatar(actor)
    }
}

const logActivity = async ({
    noteId,
    actor,
    type,
    metadata = {}
}) => {
    return ActivityEvent.create({
        noteId,
        actor: normalizeActor(actor),
        type,
        metadata
    })
}

export {
    logActivity
}
