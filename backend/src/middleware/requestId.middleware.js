import { randomUUID } from "crypto"

const REQUEST_ID_HEADER = "X-Request-ID"
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/

const requestId = (req, res, next) => {
    const incomingRequestId = req.get(REQUEST_ID_HEADER)
    const id = SAFE_REQUEST_ID.test(incomingRequestId || "")
        ? incomingRequestId
        : randomUUID()

    req.id = id
    res.setHeader(REQUEST_ID_HEADER, id)
    next()
}

export {
    REQUEST_ID_HEADER,
    requestId
}