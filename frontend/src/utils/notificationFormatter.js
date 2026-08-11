const getActorName = (notification) => {
    const name = notification?.actor?.name

    return typeof name === "string" && name.trim() ? name.trim() : "Someone"
}

const formatNotificationMessage = (notification) => {
    const actorName = getActorName(notification)

    switch (notification?.type) {
        case "NOTE_SHARED":
            return `${actorName} shared a note with you`
        case "COMMENT_REPLY":
            return `${actorName} replied to your comment`
        case "COMMENT_RESOLVED":
            return `${actorName} resolved your comment thread`
        case "COMMENT_REOPENED":
            return `${actorName} reopened your comment thread`
        default:
            return "You have a new notification"
    }
}

export {
    formatNotificationMessage,
    getActorName
}