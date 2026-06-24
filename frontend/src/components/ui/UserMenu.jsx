import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import { useTheme } from "../../context/ThemeContext"
import { getDisplayName } from "./uiUtils"

const getUserInitial = (user) => {
    const name = getDisplayName(user)
    return name.trim().charAt(0).toUpperCase() || "U"
}

const UserMenu = () => {
    const navigate = useNavigate()
    const menuRef = useRef(null)
    const { user, logout } = useAuth()
    const { theme, toggleTheme } = useTheme()
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        if (!isOpen) {
            return undefined
        }

        const handlePointerDown = (event) => {
            if (!menuRef.current?.contains(event.target)) {
                setIsOpen(false)
            }
        }

        document.addEventListener("pointerdown", handlePointerDown)

        return () => document.removeEventListener("pointerdown", handlePointerDown)
    }, [isOpen])

    const handleSettings = () => {
        setIsOpen(false)
        navigate("/settings")
    }

    const handleToggleTheme = () => {
        toggleTheme()
        setIsOpen(false)
    }

    const handleLogout = async () => {
        setIsOpen(false)
        await logout()
        navigate("/")
    }

    return (
        <div className="user-menu" ref={menuRef}>
            <button
                className="user-menu-trigger"
                type="button"
                onClick={() => setIsOpen((currentValue) => !currentValue)}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                aria-label="Open user menu"
            >
                {getUserInitial(user)}
            </button>

            {isOpen && (
                <div className="user-menu-dropdown" role="menu">
                    <div className="user-menu-profile">
                        <strong>{user?.username || "User"}</strong>
                        <span>{user?.email || "No email available"}</span>
                    </div>

                    <button type="button" role="menuitem" onClick={handleSettings}>
                        Settings
                    </button>
                    <button type="button" role="menuitem" onClick={handleToggleTheme}>
                        {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                    </button>
                    <button className="danger-menu-item" type="button" role="menuitem" onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            )}
        </div>
    )
}

export default UserMenu
