const REQUIRED_BACKEND_ENVIRONMENT_VARIABLES = [
    "NODE_ENV",
    "MONGODB_URI",
    "ACCESS_TOKEN_SECRET",
    "CORS_ORIGIN"
]

const isMissing = (value) => typeof value !== "string" || value.trim() === ""

const validateEnvironment = (environment = process.env) => {
    if (environment.NODE_ENV === "test") {
        return
    }

    const missing = REQUIRED_BACKEND_ENVIRONMENT_VARIABLES.filter((name) => isMissing(environment[name]))

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(", ")}`)
    }

    if (!["development", "production"].includes(environment.NODE_ENV)) {
        throw new Error("NODE_ENV must be one of: development, production, test")
    }
}

export {
    REQUIRED_BACKEND_ENVIRONMENT_VARIABLES,
    validateEnvironment
}