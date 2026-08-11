import api from "./axios"

const getNotifications = ({ limit = 30, cursor } = {}) => {
    const params = { limit }

    if (cursor) {
        params.cursor = cursor
    }

    return api.get("/notifications", { params })
}

const markNotificationRead = (notificationId) => {
    return api.patch(`/notifications/${notificationId}/read`)
}

const markAllNotificationsRead = () => {
    return api.patch("/notifications/read-all")
}

export {
    getNotifications,
    markAllNotificationsRead,
    markNotificationRead
}