import axios from "axios"

const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1"

const api = axios.create({
    baseURL: apiBaseUrl,
    withCredentials: true
})

export default api
