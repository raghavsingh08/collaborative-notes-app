import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import {
    getCurrentUser,
    loginUser,
    logoutUser,
    registerUser
} from "../api/auth.api"

const AuthContext = createContext(null)

const getUserFromResponse = (response) => {
    return response?.data?.user || response?.data?.data?.user || response?.data?.data || response?.data
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    const fetchCurrentUser = useCallback(async () => {
        setIsLoading(true)

        try {
            const response = await getCurrentUser()
            const currentUser = getUserFromResponse(response)

            setUser(currentUser)
            setIsAuthenticated(true)

            return currentUser
        } catch (error) {
            setUser(null)
            setIsAuthenticated(false)

            throw error
        } finally {
            setIsLoading(false)
        }
    }, [])

    const login = useCallback(async (credentials) => {
        await loginUser(credentials)
        return fetchCurrentUser()
    }, [fetchCurrentUser])

    const register = useCallback(async (userData) => {
        const response = await registerUser(userData)
        return getUserFromResponse(response)
    }, [])

    const logout = useCallback(async () => {
        try {
            await logoutUser()
        } finally {
            setUser(null)
            setIsAuthenticated(false)
        }
    }, [])

    useEffect(() => {
        fetchCurrentUser().catch(() => {})
    }, [fetchCurrentUser])

    const value = useMemo(() => ({
        user,
        isAuthenticated,
        isLoading,
        login,
        register,
        logout,
        fetchCurrentUser
    }), [user, isAuthenticated, isLoading, login, register, logout, fetchCurrentUser])

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    const context = useContext(AuthContext)

    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider")
    }

    return context
}
