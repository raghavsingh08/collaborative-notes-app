import express from "express"
import request from "supertest"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { app } from "../../src/app.js"
import { ApiError } from "../../src/utils/ApiError.js"
import { errorHandler } from "../../src/middleware/error.middleware.js"
import { createAuthRateLimiter, rateLimitMessage } from "../../src/middleware/rateLimit.middleware.js"
import { clearTestDB, closeTestDB, connectTestDB } from "../setup/testDb.js"

beforeAll(connectTestDB)
afterEach(clearTestDB)
afterAll(closeTestDB)

const createErrorTestApp = (error) => {
    const testApp = express()

    testApp.get("/error", () => {
        throw error
    })
    testApp.use(errorHandler)

    return testApp
}

describe("operational HTTP hardening", () => {
    it("returns a request ID from the liveness endpoint", async () => {
        const response = await request(app).get("/health")

        expect(response.status).toBe(200)
        expect(response.body.status).toBe("ok")
        expect(response.body.uptime).toEqual(expect.any(Number))
        expect(response.headers["x-request-id"]).toMatch(/^[A-Za-z0-9._-]{8,128}$/)
    })

    it("returns ready while the test MongoDB connection is available", async () => {
        const response = await request(app).get("/ready")

        expect(response.status).toBe(200)
        expect(response.body).toEqual({ status: "ready" })
    })

    it("preserves known API errors in production", async () => {
        const originalNodeEnv = process.env.NODE_ENV
        process.env.NODE_ENV = "production"
        const errorLog = vi.spyOn(console, "error").mockImplementation(() => {})

        try {
            const response = await request(createErrorTestApp(new ApiError(400, "Known validation error"))).get("/error")

            expect(response.status).toBe(400)
            expect(response.body).toMatchObject({
                success: false,
                statusCode: 400,
                message: "Known validation error"
            })
        } finally {
            process.env.NODE_ENV = originalNodeEnv
            errorLog.mockRestore()
        }
    })

    it("hides unexpected production error details", async () => {
        const originalNodeEnv = process.env.NODE_ENV
        process.env.NODE_ENV = "production"
        const errorLog = vi.spyOn(console, "error").mockImplementation(() => {})

        try {
            const response = await request(createErrorTestApp(new Error("Internal path C:\\private\\details"))).get("/error")

            expect(response.status).toBe(500)
            expect(response.body).toEqual({
                success: false,
                statusCode: 500,
                message: "Internal server error",
                errors: []
            })
        } finally {
            process.env.NODE_ENV = originalNodeEnv
            errorLog.mockRestore()
        }
    })

    it("rejects browser mutation requests from unapproved origins", async () => {
        const response = await request(app)
            .post("/api/v1/auth/login")
            .set("Origin", "https://untrusted.example")
            .send({ email: "user@example.com", password: "password123" })

        expect(response.status).toBe(403)
        expect(response.body).toMatchObject({
            success: false,
            statusCode: 403,
            message: "Origin is not allowed"
        })
    })

    it("returns the stable JSON response after an auth limiter is exceeded", async () => {
        const testApp = express()

        testApp.use(createAuthRateLimiter({ windowMs: 60_000, limit: 2 }))
        testApp.post("/login", (req, res) => {
            res.status(200).json({ success: true })
        })

        await request(testApp).post("/login")
        await request(testApp).post("/login")
        const limited = await request(testApp).post("/login")

        expect(limited.status).toBe(429)
        expect(limited.body).toEqual({
            success: false,
            statusCode: 429,
            message: rateLimitMessage,
            errors: []
        })
    })
})