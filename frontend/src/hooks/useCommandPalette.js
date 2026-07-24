import { useContext, useEffect } from "react"
import { CommandPaletteContext } from "../components/command-palette/CommandPaletteContext"

export const useCommandPalette = () => {
    const context = useContext(CommandPaletteContext)

    if (!context) {
        throw new Error("useCommandPalette must be used within a CommandPaletteProvider")
    }

    return context
}

export const useCommandRegistration = (scopeId, commands) => {
    const { registerCommands } = useCommandPalette()

    useEffect(() => registerCommands(scopeId, commands), [commands, registerCommands, scopeId])
}