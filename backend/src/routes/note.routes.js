import { Router } from "express"
import {
    createNote,
    deleteNote,
    getAllNotes,
    getNoteById,
    getSharedUsers,
    shareNote,
    unshareNote,
    updateNote
} from "../controllers/note.controller.js"
import { verifyJWT } from "../middleware/auth.middleware.js"

const router = Router()

router.use(verifyJWT)

router.route("/")
    .post(createNote)
    .get(getAllNotes)

router.route("/:noteId/share")
    .post(shareNote)

router.route("/:noteId/share/:userId")
    .delete(unshareNote)

router.route("/:noteId/shared-users")
    .get(getSharedUsers)

router.route("/:noteId")
    .get(getNoteById)
    .patch(updateNote)
    .delete(deleteNote)

export default router
