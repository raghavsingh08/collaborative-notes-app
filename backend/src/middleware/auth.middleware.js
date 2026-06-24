import jwt from "jsonwebtoken"
import User from "../models/user.model.js"
import { ApiError } from "../utils/ApiError.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const verifyJWT = asyncHandler(async (req, res, next) => {
    const token =
        req.cookies?.accessToken ||
        req.header("Authorization")?.replace("Bearer ", "")

    if (!token) {
        throw new ApiError(401, "Unauthorized request")
    }

    if (!process.env.ACCESS_TOKEN_SECRET) {
        throw new ApiError(500, "Access token secret is not configured")
    }

    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

    const user = await User.findById(decodedToken?._id).select("-password")

    if (!user) {
        throw new ApiError(401, "Invalid access token")
    }

    req.user = user
    next()
})

export { verifyJWT }
