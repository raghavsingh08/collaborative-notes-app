import api from './axios'

export const getComments = async (noteId) => {
    const res = await api.get(`/notes/${noteId}/comments`)
    return res.data
}

export const createComment = async (noteId, payload) => {
    const res = await api.post(`/notes/${noteId}/comments`, payload)
    return res.data
}

export const replyToComment = async (threadId, content) => {
    const res = await api.post(`/comments/${threadId}/replies`, { body: content })
    return res.data
}

export const resolveComment = async (threadId) => {
    const res = await api.patch(`/comments/${threadId}/resolve`)
    return res.data
}

export const reopenComment = async (threadId) => {
    const res = await api.patch(`/comments/${threadId}/reopen`)
    return res.data
}

export const deleteCommentThread = async (threadId) => {
    const res = await api.delete(`/comments/${threadId}`)
    return res.data
}

export const deleteCommentReply = async (threadId, replyId) => {
    const res = await api.delete(`/comments/${threadId}/replies/${replyId}`)
    return res.data
}

export const markCommentThreadAsRead = async (threadId) => {
    const res = await api.post(`/comments/${threadId}/read`)
    return res.data
}
