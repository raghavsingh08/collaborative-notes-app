import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useLocation } from "react-router-dom"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "../../context/ThemeContext"
import CommandPalette from "./CommandPalette"
import { CommandPaletteContext } from "./CommandPaletteContext"


const commandMatchesQuery = (command, query) => {
    if (!query) return true

    const searchableText = [command.label, ...(command.keywords || [])]
        .join(" ")
        .toLowerCase()

    return searchableText.includes(query)
}

export const CommandPaletteProvider = ({ children }) => {
    const { pathname } = useLocation()
    const { theme, toggleTheme } = useTheme()
    const commandScopesRef = useRef(new Map())
    const registrationRef = useRef(0)
    const previousFocusRef = useRef(null)
    const searchInputRef = useRef(null)
    const blockingDialogRef = useRef(false)
    const [registeredCommandScopes, setRegisteredCommandScopes] = useState([])
    const [isOpen, setIsOpen] = useState(false)
    const [query, setQuery] = useState("")
    const [activeIndex, setActiveIndex] = useState(-1)
    const [executingCommandId, setExecutingCommandId] = useState(null)
    const [commandError, setCommandError] = useState("")

    const setBlockingDialog = useCallback((isBlocked) => {
        blockingDialogRef.current = Boolean(isBlocked)
    }, [])

    const restorePreviousFocus = useCallback(() => {
        const previousFocus = previousFocusRef.current
        previousFocusRef.current = null

        requestAnimationFrame(() => {
            if (previousFocus?.isConnected && typeof previousFocus.focus === "function") {
                previousFocus.focus()
            }
        })
    }, [])

    const closePalette = useCallback(({ restoreFocus = true } = {}) => {
        setIsOpen(false)
        setQuery("")
        setActiveIndex(-1)
        setCommandError("")

        if (restoreFocus) {
            restorePreviousFocus()
        } else {
            previousFocusRef.current = null
        }
    }, [restorePreviousFocus])

    const openPalette = useCallback(({ selectQuery = false } = {}) => {
        if (blockingDialogRef.current) return

        if (!isOpen) {
            previousFocusRef.current = document.activeElement
            setIsOpen(true)
            setCommandError("")
            return
        }

        requestAnimationFrame(() => {
            searchInputRef.current?.focus()
            if (selectQuery) searchInputRef.current?.select()
        })
    }, [isOpen])

    const registerCommands = useCallback((scopeId, commands) => {
        const registrationId = ++registrationRef.current
        commandScopesRef.current.set(scopeId, { registrationId, commands })
        setRegisteredCommandScopes(Array.from(commandScopesRef.current.values()))

        return () => {
            const registration = commandScopesRef.current.get(scopeId)
            if (registration?.registrationId !== registrationId) return

            commandScopesRef.current.delete(scopeId)
            setRegisteredCommandScopes(Array.from(commandScopesRef.current.values()))
        }
    }, [])

    const globalCommands = useMemo(() => [{
        id: "global.toggle-theme",
        label: theme === "dark" ? "Use Light Theme" : "Use Dark Theme",
        keywords: ["dark", "light", "appearance", "theme"],
        group: "Appearance",
        icon: theme === "dark" ? Sun : Moon,
        closeBeforeExecute: true,
        execute: toggleTheme
    }], [theme, toggleTheme])

    const registeredCommands = useMemo(() => {
        const commands = []
        registeredCommandScopes.forEach((registration) => {
            registration.commands.forEach((command) => {
                if (!command?.id || command.hidden) return
                commands.push(command)
            })
        })
        return commands
    }, [registeredCommandScopes])

    const visibleCommands = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase()
        return [...globalCommands, ...registeredCommands]
            .filter((command) => commandMatchesQuery(command, normalizedQuery))
            .map((command) => ({
                ...command,
                disabled: command.enabled === false
            }))
    }, [globalCommands, query, registeredCommands])

    useEffect(() => {
        if (!isOpen) return

        const firstEnabledIndex = visibleCommands.findIndex((command) => !command.disabled)
        setActiveIndex(firstEnabledIndex)
    }, [isOpen, visibleCommands])

    useEffect(() => {
        if (!isOpen) return undefined

        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = "hidden"

        return () => {
            document.body.style.overflow = previousOverflow
        }
    }, [isOpen])

    useEffect(() => {
        closePalette({ restoreFocus: false })
    }, [closePalette, pathname])

    useEffect(() => {
        const handleShortcut = (event) => {
            const isCommandShortcut = (event.ctrlKey || event.metaKey) &&
                !event.altKey &&
                !event.isComposing &&
                String(event.key).toLowerCase() === "k"

            if (!isCommandShortcut || blockingDialogRef.current) return

            event.preventDefault()
            event.stopPropagation()
            openPalette({ selectQuery: true })
        }

        document.addEventListener("keydown", handleShortcut, true)
        return () => document.removeEventListener("keydown", handleShortcut, true)
    }, [openPalette])

    const moveActiveCommand = useCallback((direction, targetIndex) => {
        if (executingCommandId) return

        if (Number.isInteger(targetIndex)) {
            if (!visibleCommands[targetIndex]?.disabled) {
                setActiveIndex(targetIndex)
            }
            return
        }

        let nextIndex = activeIndex
        while (true) {
            nextIndex += direction
            if (nextIndex < 0 || nextIndex >= visibleCommands.length) return
            if (!visibleCommands[nextIndex].disabled) {
                setActiveIndex(nextIndex)
                return
            }
        }
    }, [activeIndex, executingCommandId, visibleCommands])

    const executeCommand = useCallback(async (command) => {
        if (!command || command.disabled || executingCommandId) return

        setCommandError("")

        if (command.closeBeforeExecute) {
            closePalette({ restoreFocus: false })
            try {
                command.execute?.()
            } catch (error) {
                console.error("Command execution failed:", error)
            }
            return
        }

        setExecutingCommandId(command.id)

        try {
            const result = await command.execute?.()
            const didSucceed = result !== false

            if (didSucceed && command.closeOnSuccess) {
                closePalette({ restoreFocus: false })
            } else if (!didSucceed) {
                requestAnimationFrame(() => searchInputRef.current?.focus())
            }
        } catch (error) {
            console.error("Command execution failed:", error)
            setCommandError("Unable to complete that command.")
            requestAnimationFrame(() => searchInputRef.current?.focus())
        } finally {
            setExecutingCommandId((currentCommandId) => (
                currentCommandId === command.id ? null : currentCommandId
            ))
        }
    }, [closePalette, executingCommandId])

    const executeActiveCommand = useCallback(() => {
        if (activeIndex < 0) return
        executeCommand(visibleCommands[activeIndex])
    }, [activeIndex, executeCommand, visibleCommands])

    const contextValue = useMemo(() => ({
        registerCommands,
        setBlockingDialog,
        closePalette,
        openPalette
    }), [closePalette, openPalette, registerCommands, setBlockingDialog])

    return (
        <CommandPaletteContext.Provider value={contextValue}>
            {children}
            <CommandPalette
                isOpen={isOpen}
                query={query}
                onQueryChange={setQuery}
                visibleCommands={visibleCommands}
                activeIndex={activeIndex}
                executingCommandId={executingCommandId}
                commandError={commandError}
                searchInputRef={searchInputRef}
                onClose={closePalette}
                onMoveActive={moveActiveCommand}
                onExecuteActive={executeActiveCommand}
                onExecuteCommand={executeCommand}
            />
        </CommandPaletteContext.Provider>
    )
}