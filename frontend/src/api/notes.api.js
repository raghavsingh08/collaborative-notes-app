import api from "./axios"

const getNotes = () => {
    return api.get("/notes")
}

const createNote = (noteData) => {
    return api.post("/notes", noteData)
}

const getNoteById = (noteId) => {
    return api.get(`/notes/${noteId}`)
}

const updateNote = (noteId, noteData) => {
    return api.patch(`/notes/${noteId}`, noteData)
}

const deleteNote = (noteId) => {
    return api.delete(`/notes/${noteId}`)
}

const shareNote = (noteId, shareData) => {
    return api.post(`/notes/${noteId}/share`, shareData)
}

const removeSharedUser = (noteId, userId) => {
    return api.delete(`/notes/${noteId}/share/${userId}`)
}

const getSharedUsers = (noteId) => {
    return api.get(`/notes/${noteId}/shared-users`)
}

export {
    getNotes,
    createNote,
    getNoteById,
    updateNote,
    deleteNote,
    shareNote,
    removeSharedUser,
    getSharedUsers
}
