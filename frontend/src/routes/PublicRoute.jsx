import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

const PublicRoute = () => {
    const { isAuthenticated, isLoading } = useAuth()

    if (isLoading) {
        return (
            <div className="app-loading" aria-label="Loading application" aria-busy="true">
                <div className="app-loading-inner">
                    <div className="app-loading-mark" aria-hidden="true">
                        <span className="app-loading-pulse" />
                    </div>
                    <p className="app-loading-text">Loading workspace...</p>
                </div>
            </div>
        )
    }

    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />
    }

    return <Outlet />
}

export default PublicRoute
