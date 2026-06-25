import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { IconAlertCircle, IconArrowLeft } from "../components/ui/Icons"
import PasswordField from "../components/ui/PasswordField"
import { useAuth } from "../context/AuthContext"
import usePageTitle from "../hooks/usePageTitle"

const LoginPage = () => {
    usePageTitle("Sign in")
    const { login } = useAuth()
    const navigate = useNavigate()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async (event) => {
        event.preventDefault()
        setError("")
        setIsSubmitting(true)

        try {
            await login({ email, password })
            navigate("/dashboard")
        } catch {
            setError("Invalid email or password.")
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

            <h1>Welcome back</h1>
            <p className="auth-subtitle">Sign in to continue to your workspace.</p>

            <form onSubmit={handleSubmit}>
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
                    autoComplete="current-password"
                />

                {error && (
                    <div className="auth-error" role="alert">
                        <IconAlertCircle size={15} />
                        {error}
                    </div>
                )}

                <button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Signing in…" : "Sign in"}
                </button>
            </form>

            <p className="auth-footer">
                Don&rsquo;t have an account?{" "}
                <Link to="/register">Create one</Link>
            </p>
        </main>
    )
}

export default LoginPage
