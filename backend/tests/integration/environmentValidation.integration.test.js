import { describe, expect, it } from "vitest"
import { validateEnvironment } from "../../src/config/env.js"

const validProductionEnvironment = {
    NODE_ENV: "production",
    MONGODB_URI: "mongodb+srv://example.test/database",
    ACCESS_TOKEN_SECRET: "safe-test-secret",
    CORS_ORIGIN: "https://app.example.com"
}

describe("startup environment validation", () => {
    it("accepts complete production configuration", () => {
        expect(() => validateEnvironment(validProductionEnvironment)).not.toThrow()
    })

    it("reports missing variable names without exposing values", () => {
        const environment = {
            ...validProductionEnvironment,
            MONGODB_URI: "",
            ACCESS_TOKEN_SECRET: "secret-that-must-not-appear"
        }

        expect(() => validateEnvironment(environment)).toThrow("MONGODB_URI")
        expect(() => validateEnvironment(environment)).not.toThrow("secret-that-must-not-appear")
    })
})