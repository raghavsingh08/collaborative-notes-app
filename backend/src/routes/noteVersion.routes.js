import { Router } from "express"
import {
    getNoteVersionById,
    getNoteVersions,
    restoreNoteVersion
} from "../controllers/noteVersion.controller.js"
import { verifyJWT } from "../middleware/auth.middleware.js"

const router = Router()

router.use(verifyJWT)

router.route("/notes/:noteId/versions")
    .get(getNoteVersions)

router.route("/notes/:noteId/versions/:versionId")
    .get(getNoteVersionById)

router.route("/notes/:noteId/versions/:versionId/restore")
    .post(restoreNoteVersion)

export default router
