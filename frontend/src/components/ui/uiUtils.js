const formatDateTime = (value) => {
    if (!value) {
        return "Recently updated"
    }

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
        return "Recently updated"
    }

    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
    }).format(date)
}

const getDisplayName = (user) => {
    if (!user) {
        return "Guest"
    }

    if (typeof user === "string") {
        return user
    }

    return user.username || user.name || user.email || "Collaborator"
}

const getInitials = (value) => {
    const name = getDisplayName(value)
    const parts = name.trim().split(/\s+/).filter(Boolean)

    if (parts.length === 0) {
        return "U"
    }

    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase()
    }

    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

export {
    formatDateTime,
    getDisplayName,
    getInitials
}
