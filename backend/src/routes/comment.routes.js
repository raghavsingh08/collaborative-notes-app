import { Router } from "express"
import {
    addCommentReply,
    createCommentThread,
    getNoteCommentThreads,
    reopenCommentThread,
    resolveCommentThread
} from "../controllers/comment.controller.js"
import { verifyJWT } from "../middleware/auth.middleware.js"

const router = Router()

router.use(verifyJWT)

router.route("/notes/:noteId/comments")
    .get(getNoteCommentThreads)
    .post(createCommentThread)

router.route("/comments/:threadId/replies")
    .post(addCommentReply)

router.route("/comments/:threadId/resolve")
    .patch(resolveCommentThread)

router.route("/comments/:threadId/reopen")
    .patch(reopenCommentThread)

export default router
