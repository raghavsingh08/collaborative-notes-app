import { createContext, useContext, useEffect, useMemo, useState } from "react"

const ThemeContext = createContext(null)
const storageKey = "collaborative-notes-theme"

const getInitialTheme = () => {
    const storedTheme = localStorage.getItem(storageKey)

    if (storedTheme === "dark" || storedTheme === "light") {
        return storedTheme
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(getInitialTheme)

    useEffect(() => {
        document.documentElement.dataset.theme = theme
        localStorage.setItem(storageKey, theme)
    }, [theme])

    const toggleTheme = () => {
        setTheme((currentTheme) => currentTheme === "dark" ? "light" : "dark")
    }

    const value = useMemo(() => ({
        theme,
        setTheme,
        toggleTheme
    }), [theme])

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    )
}

export const useTheme = () => {
    const context = useContext(ThemeContext)

    if (!context) {
        throw new Error("useTheme must be used within a ThemeProvider")
    }

    return context
}
