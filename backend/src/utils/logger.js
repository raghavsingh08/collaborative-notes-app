const redactSensitiveText = (value) => {
    if (value === undefined || value === null) {
        return undefined
    }

    return String(value)
        .replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, "[REDACTED_MONGODB_URI]")
        .replace(/(bearer\s+)[^\s]+/gi, "$1[REDACTED]")
}

const cleanFields = (fields = {}) => Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined)
)

const writeLog = (level, event, fields = {}) => {
    if (process.env.NODE_ENV === "test" && process.env.ENABLE_TEST_LOGGING !== "true") {
        return
    }

    const payload = {
        timestamp: new Date().toISOString(),
        level,
        event,
        ...cleanFields(fields)
    }
    const writer = level === "error" ? console.error : level === "warn" ? console.warn : console.log

    writer(JSON.stringify(payload))
}

const logError = (event, error, fields = {}) => {
    writeLog("error", event, {
        ...fields,
        errorName: error?.name,
        errorCode: error?.code,
        errorMessage: redactSensitiveText(error?.message),
        stack: error?.stack
    })
}

export {
    logError,
    writeLog
}