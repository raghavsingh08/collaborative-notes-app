import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { updatePassword, updateProfile } from "../api/auth.api"
import { ErrorState, SuccessNotice } from "../components/ui/AppUI"
import { IconArrowLeft, IconMoon, IconSun } from "../components/ui/Icons"
import PasswordField from "../components/ui/PasswordField"
import { useAuth } from "../context/AuthContext"
import { useTheme } from "../context/ThemeContext"
import usePageTitle from "../hooks/usePageTitle"

const getMessageFromError = (error, fallback) => {
    return error?.response?.data?.message || fallback
}

const getUserFromResponse = (response) => {
    return response?.data?.user || response?.data?.data?.user || response?.data?.data || response?.data
}

const SettingsPage = () => {
    usePageTitle("Settings")
    const navigate = useNavigate()
    const { user, fetchCurrentUser } = useAuth()
    const { theme, toggleTheme } = useTheme()
    const [username, setUsername] = useState("")
    const [email, setEmail] = useState("")
    const [isEditingProfile, setIsEditingProfile] = useState(false)
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

    useEffect(() => {
        if (!profileMessage) return undefined
        const timer = setTimeout(() => setProfileMessage(""), 3500)
        return () => clearTimeout(timer)
    }, [profileMessage])

    useEffect(() => {
        if (!passwordMessage) return undefined
        const timer = setTimeout(() => setPasswordMessage(""), 3500)
        return () => clearTimeout(timer)
    }, [passwordMessage])

    const hasProfileChanged = username.trim() !== (user?.username || "") || email.trim() !== (user?.email || "")
    const canUpdatePassword = Boolean(oldPassword && newPassword)

    const handleCancelProfile = () => {
        setUsername(user?.username || "")
        setEmail(user?.email || "")
        setProfileError("")
        setProfileMessage("")
        setIsEditingProfile(false)
    }

    const handleProfileSubmit = async (event) => {
        event.preventDefault()

        if (!hasProfileChanged) return

        setProfileError("")
        setProfileMessage("")
        setIsSavingProfile(true)

        try {
            const response = await updateProfile({
                username: username.trim(),
                email: email.trim()
            })
            const updatedUser = getUserFromResponse(response)

            if (updatedUser?.username) setUsername(updatedUser.username)
            if (updatedUser?.email) setEmail(updatedUser.email)

            await fetchCurrentUser()
            setProfileMessage("Profile updated successfully.")
            setIsEditingProfile(false)
        } catch (error) {
            setProfileError(getMessageFromError(error, "Unable to update profile."))
        } finally {
            setIsSavingProfile(false)
        }
    }

    const handlePasswordSubmit = async (event) => {
        event.preventDefault()

        if (!canUpdatePassword) return

        setPasswordError("")
        setPasswordMessage("")
        setIsSavingPassword(true)

        try {
            await updatePassword({ oldPassword, newPassword })
            setOldPassword("")
            setNewPassword("")
            setPasswordMessage("Password updated successfully.")
        } catch (error) {
            setPasswordError(getMessageFromError(error, "Unable to update password."))
        } finally {
            setIsSavingPassword(false)
        }
    }

    return (
        <main className="settings-shell">
            <header className="settings-header">
                <button
                    className="settings-back-button"
                    type="button"
                    onClick={() => navigate("/dashboard")}
                >
                    <IconArrowLeft size={14} />
                    Dashboard
                </button>
                <div>
                    <p className="eyebrow">Workspace settings</p>
                    <h1>Settings</h1>
                </div>
            </header>

            <section className="settings-grid">
                {/* Profile Summary */}
                <section className="settings-card profile-summary-card">
                    <div className="settings-card-header">
                        <div>
                            <p className="eyebrow">Account</p>
                            <h2>Current profile</h2>
                        </div>
                    </div>

                    <div className="current-profile">
                        <div className="current-profile-text">
                            <strong>{user?.username || "User"}</strong>
                            <span>{user?.email || "No email available"}</span>
                        </div>
                        <button
                            className="secondary-button profile-edit-button"
                            type="button"
                            onClick={() => setIsEditingProfile(true)}
                        >
                            Edit profile
                        </button>
                    </div>

                    {isEditingProfile && (
                        <form className="profile-edit-form" onSubmit={handleProfileSubmit}>
                            <div className="form-field">
                                <label htmlFor="settings-username">Username</label>
                                <input
                                    id="settings-username"
                                    type="text"
                                    value={username}
                                    onChange={(event) => setUsername(event.target.value)}
                                    required
                                />
                            </div>

                            <div className="form-field">
                                <label htmlFor="settings-email">Email address</label>
                                <input
                                    id="settings-email"
                                    type="email"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    required
                                />
                            </div>

                            <div className="settings-actions">
                                <button
                                    className="primary-button"
                                    type="submit"
                                    disabled={isSavingProfile || !hasProfileChanged}
                                >
                                    {isSavingProfile ? "Saving…" : "Save profile"}
                                </button>
                                <button
                                    className="ghost-button"
                                    type="button"
                                    onClick={handleCancelProfile}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    )}

                    <ErrorState message={profileError} />
                    <SuccessNotice message={profileMessage} />
                </section>

                {/* Theme */}
                <section className="settings-card theme-card">
                    <div>
                        <p className="eyebrow">Appearance</p>
                        <h2>Theme</h2>
                    </div>

                    <p className="theme-current-label">
                        Current theme: <strong>{theme === "dark" ? "Dark" : "Light"}</strong>
                    </p>

                    <button
                        className="theme-toggle"
                        type="button"
                        onClick={toggleTheme}
                        aria-pressed={theme === "dark"}
                    >
                        <span className={theme === "light" ? "active" : ""}>
                            <IconSun size={14} />
                            Light
                        </span>
                        <span className={theme === "dark" ? "active" : ""}>
                            <IconMoon size={14} />
                            Dark
                        </span>
                    </button>
                </section>

                {/* Security */}
                <form className="settings-card security-card" onSubmit={handlePasswordSubmit}>
                    <div>
                        <p className="eyebrow">Security</p>
                        <h2>Change password</h2>
                    </div>

                    <PasswordField
                        id="old-password"
                        label="Current password"
                        value={oldPassword}
                        onChange={(event) => setOldPassword(event.target.value)}
                        autoComplete="current-password"
                    />

                    <PasswordField
                        id="new-password"
                        label="New password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        autoComplete="new-password"
                        minLength="8"
                    />

                    <ErrorState message={passwordError} />
                    <SuccessNotice message={passwordMessage} />

                    <button
                        className="primary-button"
                        type="submit"
                        disabled={isSavingPassword || !canUpdatePassword}
                    >
                        {isSavingPassword ? "Updating…" : "Update password"}
                    </button>
                </form>
            </section>
        </main>
    )
}

export default SettingsPage
