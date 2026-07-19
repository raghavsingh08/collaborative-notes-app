const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500

    return res.status(statusCode).json({
        success: false,
        statusCode,
        message: err.message || "Internal Server Error",
        errors: err.errors || [],
        ...(err.code ? { code: err.code } : {}),
        ...(err.currentContentRevision !== undefined
            ? { currentContentRevision: err.currentContentRevision }
            : {})
    })
}

export { errorHandler }