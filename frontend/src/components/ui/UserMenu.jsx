import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import { IconLogOut, IconSettings } from "./Icons"
import { getDisplayName } from "./uiUtils"

const getUserInitial = (user) => {
    const name = getDisplayName(user)
    return name.trim().charAt(0).toUpperCase() || "U"
}

const UserMenu = () => {
    const navigate = useNavigate()
    const menuRef = useRef(null)
    const { user, logout } = useAuth()
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        if (!isOpen) return undefined

        const handlePointerDown = (event) => {
            if (!menuRef.current?.contains(event.target)) {
                setIsOpen(false)
            }
        }

        const handleKeyDown = (event) => {
            if (event.key === "Escape") setIsOpen(false)
        }

        document.addEventListener("pointerdown", handlePointerDown)
        document.addEventListener("keydown", handleKeyDown)

        return () => {
            document.removeEventListener("pointerdown", handlePointerDown)
            document.removeEventListener("keydown", handleKeyDown)
        }
    }, [isOpen])

    const handleSettings = () => {
        setIsOpen(false)
        navigate("/settings")
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
                onClick={() => setIsOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                aria-label="Open user menu"
            >
                <span className="avatar-initial">{getUserInitial(user)}</span>
            </button>

            {isOpen && (
                <div className="user-menu-dropdown" role="menu">
                    <button type="button" role="menuitem" onClick={handleSettings}>
                        <IconSettings size={14} />
                        Settings
                    </button>
                    <button
                        className="danger-menu-item"
                        type="button"
                        role="menuitem"
                        onClick={handleLogout}
                    >
                        <IconLogOut size={14} />
                        Sign out
                    </button>
                </div>
            )}
        </div>
    )
}

export default UserMenu
