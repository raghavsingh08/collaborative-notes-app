import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import PasswordField from "../components/ui/PasswordField"
import { useAuth } from "../context/AuthContext"

const LoginPage = () => {
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
            <h1>Login</h1>

            <form onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="email">Email</label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
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

                {error && <p role="alert">{error}</p>}

                <button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Logging in..." : "Login"}
                </button>
            </form>

            <p>
                Need an account? <Link to="/register">Register</Link>
            </p>
        </main>
    )
}

export default LoginPage
