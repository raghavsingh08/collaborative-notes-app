import jwt from "jsonwebtoken"

const authHeaderFor = (user) => {
    const token = jwt.sign(
        { _id: String(user._id) },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
    )

    return `Bearer ${token}`
}

export {
    authHeaderFor
}