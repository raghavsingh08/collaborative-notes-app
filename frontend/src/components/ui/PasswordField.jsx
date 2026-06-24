import { useState } from "react"

const PasswordField = ({
    id,
    label,
    value,
    onChange,
    autoComplete,
    minLength,
    required = true
}) => {
    const [isVisible, setIsVisible] = useState(false)
    const labelText = isVisible ? "Hide password" : "Show password"

    return (
        <div className="password-field-group">
            <label htmlFor={id}>{label}</label>
            <div className="password-field">
                <input
                    id={id}
                    type={isVisible ? "text" : "password"}
                    value={value}
                    onChange={onChange}
                    autoComplete={autoComplete}
                    minLength={minLength}
                    required={required}
                />
                <button
                    className="password-toggle"
                    type="button"
                    onClick={() => setIsVisible((currentValue) => !currentValue)}
                    aria-label={labelText}
                    title={labelText}
                >
                    {isVisible ? "Hide" : "Show"}
                </button>
            </div>
        </div>
    )
}

export default PasswordField
