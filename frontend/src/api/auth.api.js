import api from "./axios"

const registerUser = (userData) => {
    return api.post("/auth/register", userData)
}

const loginUser = (credentials) => {
    return api.post("/auth/login", credentials)
}

const logoutUser = () => {
    return api.post("/auth/logout")
}

const getCurrentUser = () => {
    return api.get("/auth/me")
}

const updateProfile = (profileData) => {
    return api.patch("/auth/profile", profileData)
}

const updatePassword = (passwordData) => {
    return api.patch("/auth/password", passwordData)
}

export {
    registerUser,
    loginUser,
    logoutUser,
    getCurrentUser,
    updateProfile,
    updatePassword
}
