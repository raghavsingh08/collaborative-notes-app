process.env.NODE_ENV = "test"
process.env.ACCESS_TOKEN_SECRET = "test-access-token-secret"
process.env.ACCESS_TOKEN_EXPIRY = "1h"
process.env.CORS_ORIGIN = "http://localhost:5173"

// Integration tests connect explicitly to MongoMemoryServer and never use this.
delete process.env.MONGODB_URI