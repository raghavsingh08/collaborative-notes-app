import rateLimit from "express-rate-limit"

const rateLimitMessage = "Too many requests. Please try again later."

const createRateLimiter = ({ windowMs, limit, ...options }) => rateLimit({
    windowMs,
    limit,
    legacyHeaders: false,
    standardHeaders: false,
    handler: (req, res, next, settings) => {
        res.status(settings.statusCode).json({
            success: false,
            statusCode: settings.statusCode,
            message: rateLimitMessage,
            errors: []
        })
    },
    ...options
})

const createAuthRateLimiter = (overrides = {}) => createRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    ...overrides
})

const createApiRateLimiter = (overrides = {}) => createRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 600,
    ...overrides
})

const authRateLimiter = createAuthRateLimiter()
const apiRateLimiter = createApiRateLimiter()

export {
    apiRateLimiter,
    authRateLimiter,
    createApiRateLimiter,
    createAuthRateLimiter,
    rateLimitMessage
}