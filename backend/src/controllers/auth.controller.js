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

const updateProfile = asyncHandler(async (req, res) => {
    const { username, email } = req.body
    const updates = {}

    if (username?.trim()) {
        updates.username = username.trim()
    }

    if (email?.trim()) {
        updates.email = email.trim().toLowerCase()
    }

    if (Object.keys(updates).length === 0) {
        throw new ApiError(400, "Username or email is required")
    }

    const duplicateConditions = []

    if (updates.username) {
        duplicateConditions.push({ username: updates.username })
    }

    if (updates.email) {
        duplicateConditions.push({ email: updates.email })
    }

    const existingUser = await User.findOne({
        _id: { $ne: req.user._id },
        $or: duplicateConditions
    })

    if (existingUser) {
        throw new ApiError(409, "Username or email is already in use")
    }

    const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { $set: updates },
        { returnDocument: "after",
             runValidators: true }
    ).select("-password")

    return res
        .status(200)
        .json(new ApiResponse(200, updatedUser, "Profile updated successfully"))
})

const updatePassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body

    if (!oldPassword || !newPassword) {
        throw new ApiError(400, "Old password and new password are required")
    }

    if (newPassword.length < 8) {
        throw new ApiError(400, "New password must be at least 8 characters long")
    }

    const user = await User.findById(req.user._id).select("+password")

    if (!user) {
        throw new ApiError(404, "User not found")
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.password)

    if (!isPasswordValid) {
        throw new ApiError(401, "Old password is incorrect")
    }

    user.password = await bcrypt.hash(newPassword, 10)
    await user.save()

    return res
        .status(200)
        .json(new ApiResponse(200, null, "Password updated successfully"))
})

export {
    registerUser,
    loginUser,
    logoutUser,
    getCurrentUser,
    updateProfile,
    updatePassword
}
