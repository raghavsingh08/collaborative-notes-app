import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { updatePassword, updateProfile } from "../api/auth.api"
import { ErrorState } from "../components/ui/AppUI"
import { useAuth } from "../context/AuthContext"
import { useTheme } from "../context/ThemeContext"

const getMessageFromError = (error, fallback) => {
    return error?.response?.data?.message || fallback
}

const getUserFromResponse = (response) => {
    return response?.data?.user || response?.data?.data?.user || response?.data?.data || response?.data
}

const SettingsPage = () => {
    const navigate = useNavigate()
    const { user, fetchCurrentUser } = useAuth()
    const { theme, toggleTheme } = useTheme()
    const [username, setUsername] = useState("")
    const [email, setEmail] = useState("")
    const [oldPassword, setOldPassword] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [profileMessage, setProfileMessage] = useState("")
    const [passwordMessage, setPasswordMessage] = useState("")
    const [profileError, setProfileError] = useState("")
    const [passwordError, setPasswordError] = useState("")
    const [isSavingProfile, setIsSavingProfile] = useState(false)
    const [isSavingPassword, setIsSavingPassword] = useState(false)

    useEffect(() => {
        setUsername(user?.username || "")
        setEmail(user?.email || "")
    }, [user])

    const handleProfileSubmit = async (event) => {
        event.preventDefault()
        setProfileError("")
        setProfileMessage("")
        setIsSavingProfile(true)

        try {
            const response = await updateProfile({
                username: username.trim(),
                email: email.trim()
            })
            const updatedUser = getUserFromResponse(response)

            if (updatedUser?.username) {
                setUsername(updatedUser.username)
            }

            if (updatedUser?.email) {
                setEmail(updatedUser.email)
            }

            await fetchCurrentUser()
            setProfileMessage("Profile updated.")
        } catch (error) {
            setProfileError(getMessageFromError(error, "Unable to update profile."))
        } finally {
            setIsSavingProfile(false)
        }
    }

    const handlePasswordSubmit = async (event) => {
        event.preventDefault()
        setPasswordError("")
        setPasswordMessage("")
        setIsSavingPassword(true)

        try {
            await updatePassword({ oldPassword, newPassword })
            setOldPassword("")
            setNewPassword("")
            setPasswordMessage("Password updated.")
        } catch (error) {
            setPasswordError(getMessageFromError(error, "Unable to update password."))
        } finally {
            setIsSavingPassword(false)
        }
    }

    return (
        <main className="settings-shell">
            <header className="settings-header">
                <button className="ghost-button" type="button" onClick={() => navigate("/dashboard")}>
                    Back
                </button>
                <div>
                    <p className="eyebrow">Workspace settings</p>
                    <h1>Settings</h1>
                </div>
            </header>

            <section className="settings-grid">
                <form className="settings-card" onSubmit={handleProfileSubmit}>
                    <div>
                        <p className="eyebrow">Account</p>
                        <h2>Profile</h2>
                        <p>Manage the identity teammates see while collaborating.</p>
                    </div>

                    <label htmlFor="settings-username">Username</label>
                    <input
                        id="settings-username"
                        type="text"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        required
                    />

                    <label htmlFor="settings-email">Email</label>
                    <input
                        id="settings-email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                    />

                    <ErrorState message={profileError} />
                    {profileMessage && <div className="notice notice-success" role="status">{profileMessage}</div>}

                    <button className="primary-button" type="submit" disabled={isSavingProfile}>
                        {isSavingProfile ? "Saving" : "Save profile"}
                    </button>
                </form>

                <form className="settings-card" onSubmit={handlePasswordSubmit}>
                    <div>
                        <p className="eyebrow">Security</p>
                        <h2>Password</h2>
                        <p>Change your password using your current password.</p>
                    </div>

                    <label htmlFor="old-password">Current password</label>
                    <input
                        id="old-password"
                        type="password"
                        value={oldPassword}
                        onChange={(event) => setOldPassword(event.target.value)}
                        required
                    />

                    <label htmlFor="new-password">New password</label>
                    <input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        minLength="8"
                        required
                    />

                    <ErrorState message={passwordError} />
                    {passwordMessage && <div className="notice notice-success" role="status">{passwordMessage}</div>}

                    <button className="primary-button" type="submit" disabled={isSavingPassword}>
                        {isSavingPassword ? "Updating" : "Update password"}
                    </button>
                </form>

                <section className="settings-card theme-card">
                    <div>
                        <p className="eyebrow">Appearance</p>
                        <h2>Theme</h2>
                        <p>Choose the interface tone for this browser.</p>
                    </div>

                    <button
                        className="theme-toggle"
                        type="button"
                        onClick={toggleTheme}
                        aria-pressed={theme === "dark"}
                    >
                        <span className={theme === "light" ? "active" : ""}>Light</span>
                        <span className={theme === "dark" ? "active" : ""}>Dark</span>
                    </button>
                </section>
            </section>
        </main>
    )
}

export default SettingsPage
