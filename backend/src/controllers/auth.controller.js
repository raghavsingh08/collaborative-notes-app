import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import User from "../models/user.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
}

const generateAccessToken = (userId) => {
    if (!process.env.ACCESS_TOKEN_SECRET) {
        throw new ApiError(500, "Access token secret is not configured")
    }

    return jwt.sign(
        { _id: userId },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "1d" }
    )
}

const sanitizeUser = (user) => {
    const userObject = user.toObject()
    delete userObject.password
    return userObject
}

const registerUser = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body

    if (!username?.trim() || !email?.trim() || !password) {
        throw new ApiError(400, "Username, email, and password are required")
    }

    const existingUser = await User.findOne({
        $or: [
            { username: username.trim() },
            { email: email.trim().toLowerCase() }
        ]
    })

    if (existingUser) {
        throw new ApiError(409, "User with this username or email already exists")
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await User.create({
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password: hashedPassword
    })

    return res
        .status(201)
        .json(new ApiResponse(201, sanitizeUser(user), "User registered successfully"))
})

const loginUser = asyncHandler(async (req, res) => {
    const { email, username, password } = req.body

    if ((!email?.trim() && !username?.trim()) || !password) {
        throw new ApiError(400, "Email or username and password are required")
    }

    const user = await User.findOne({
        $or: [
            ...(email?.trim() ? [{ email: email.trim().toLowerCase() }] : []),
            ...(username?.trim() ? [{ username: username.trim() }] : [])
        ]
    }).select("+password")

    if (!user) {
        throw new ApiError(401, "Invalid credentials")
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid credentials")
    }

    const accessToken = generateAccessToken(user._id)

    return res
        .status(200)
        .cookie("accessToken", accessToken, cookieOptions)
        .json(new ApiResponse(200, sanitizeUser(user), "User logged in successfully"))
})

const logoutUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .clearCookie("accessToken", cookieOptions)
        .json(new ApiResponse(200, null, "User logged out successfully"))
})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "Current user fetched successfully"))
})

export {
    registerUser,
    loginUser,
    logoutUser,
    getCurrentUser
}
