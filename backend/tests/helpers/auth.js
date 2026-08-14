import jwt from "jsonwebtoken"

const accessTokenFor = (user) => jwt.sign(
    { _id: String(user._id) },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
)

const authHeaderFor = (user) => `Bearer ${accessTokenFor(user)}`

export {
    accessTokenFor,
    authHeaderFor
}