import { Router } from "express"
import {
    getCurrentUser,
    loginUser,
    logoutUser,
    registerUser,
    updatePassword,
    updateProfile
} from "../controllers/auth.controller.js"
import { verifyJWT } from "../middleware/auth.middleware.js"

const router = Router()

router.route("/register").post(registerUser)
router.route("/login").post(loginUser)
router.route("/logout").post(verifyJWT, logoutUser)
router.route("/me").get(verifyJWT, getCurrentUser)
router.route("/profile").patch(verifyJWT, updateProfile)
router.route("/password").patch(verifyJWT, updatePassword)

export default router
