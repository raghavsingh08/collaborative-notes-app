import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import PasswordField from "../components/ui/PasswordField"
import { useAuth } from "../context/AuthContext"

const RegisterPage = () => {
    const { register } = useAuth()
    const navigate = useNavigate()
    const [username, setUsername] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")

    const handleSubmit = async (event) => {
        event.preventDefault()
        setError("")

        try {
            await register({ username, email, password })
            navigate("/login")
        } catch (error) {
            setError(
                error.response?.data?.message ||
                "Unable to create account. Please try again."
            )
        }
    }

    return (
        <main>
            <h1>Register</h1>

            <form onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="username">Username</label>
                    <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        required
                    />
                </div>

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
                    autoComplete="new-password"
                    minLength="8"
                />

                {error && <p role="alert">{error}</p>}

                <button type="submit">Register</button>
            </form>

            <p>
                Already have an account? <Link to="/login">Login</Link>
            </p>
        </main>
    )
}

export default RegisterPage
