import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        environment: "node",
        fileParallelism: false,
        globalSetup: ["./tests/setup/globalSetup.js"],
        setupFiles: ["./tests/setup/testEnv.js"],
        testTimeout: 15000,
        hookTimeout: 30000
    }
})