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

const getDisplayName = (user, fallback = "Guest") => {
    if (!user) {
        return fallback
    }

    if (typeof user === "string") {
        // Prevent displaying a raw 24-char hex MongoDB ObjectId
        if (/^[0-9a-fA-F]{24}$/.test(user)) {
            return fallback
        }
        return user
    }

    return user.username || user.fullName || user.name || user.email || fallback
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
