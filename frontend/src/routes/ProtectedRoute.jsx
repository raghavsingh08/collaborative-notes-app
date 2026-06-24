import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

const ProtectedRoute = () => {
    const { isAuthenticated, isLoading } = useAuth()

    if (isLoading) {
        return <p>Loading...</p>
    }

    if (isAuthenticated) {
        return <Outlet />
    }

    return <Navigate to="/login" replace />
}

export default ProtectedRoute
