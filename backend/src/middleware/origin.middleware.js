import { isAllowedOrigin } from "../config/cors.js"
import { ApiError } from "../utils/ApiError.js"

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

const enforceAllowedOrigin = (req, res, next) => {
    if (!UNSAFE_METHODS.has(req.method)) {
        next()
        return
    }

    const origin = req.get("Origin")

    if (!origin || isAllowedOrigin(origin)) {
        next()
        return
    }

    next(new ApiError(403, "Origin is not allowed"))
}

export { enforceAllowedOrigin }