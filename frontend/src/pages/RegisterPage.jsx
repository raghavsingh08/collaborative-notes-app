import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { IconAlertCircle, IconArrowLeft } from "../components/ui/Icons"
import PasswordField from "../components/ui/PasswordField"
import { useAuth } from "../context/AuthContext"
import usePageTitle from "../hooks/usePageTitle"

const RegisterPage = () => {
    usePageTitle("Create account")
    const { register } = useAuth()
    const navigate = useNavigate()
    const [username, setUsername] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async (event) => {
        event.preventDefault()
        setError("")
        setIsSubmitting(true)

        try {
            await register({ username, email, password })
            navigate("/login")
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Unable to create account. Please try again."
            )
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <main>
            <Link className="auth-back" to="/">
                <IconArrowLeft size={14} />
                Collaborative Notes
            </Link>

            <h1>Create your account</h1>
            <p className="auth-subtitle">Start writing and collaborating in seconds.</p>

            <form onSubmit={handleSubmit}>
                <div className="form-field">
                    <label htmlFor="username">Username</label>
                    <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        placeholder="yourname"
                        autoComplete="username"
                        required
                    />
                </div>

                <div className="form-field">
                    <label htmlFor="email">Email address</label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@example.com"
                        autoComplete="email"
                        required
                    />
                </div>

                <PasswordField
                    id="password"
                    label="Password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength="8"
                />

                {error && (
                    <div className="auth-error" role="alert">
                        <IconAlertCircle size={15} />
                        {error}
                    </div>
                )}

                <button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Creating account…" : "Create account"}
                </button>
            </form>

            <p className="auth-footer">
                Already have an account?{" "}
                <Link to="/login">Sign in</Link>
            </p>
        </main>
    )
}

export default RegisterPage
