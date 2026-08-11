import { Router } from "express"
import {
    getNotifications,
    markAllNotificationsAsRead,
    markNotificationAsRead
} from "../controllers/notification.controller.js"
import { verifyJWT } from "../middleware/auth.middleware.js"

const router = Router()

router.use(verifyJWT)

router.route("/")
    .get(getNotifications)

router.route("/read-all")
    .patch(markAllNotificationsAsRead)

router.route("/:notificationId/read")
    .patch(markNotificationAsRead)

export default router