import { useEffect } from "react"
import { Command } from "lucide-react"

const getFocusableElements = (container) => {
    if (!container) return []

    return Array.from(container.querySelectorAll(
        'input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((element) => !element.hasAttribute("hidden"))
}

const CommandPalette = ({
    isOpen,
    query,
    onQueryChange,
    visibleCommands,
    activeIndex,
    executingCommandId,
    commandError,
    searchInputRef,
    onClose,
    onMoveActive,
    onExecuteActive,
    onExecuteCommand
}) => {
    useEffect(() => {
        if (!isOpen) return undefined

        const frame = requestAnimationFrame(() => {
            searchInputRef.current?.focus()
        })

        return () => cancelAnimationFrame(frame)
    }, [isOpen, searchInputRef])

    if (!isOpen) return null

    const groups = visibleCommands.reduce((result, command, index) => {
        const group = command.group || "Commands"
        if (!result.has(group)) result.set(group, [])
        result.get(group).push({ command, index })
        return result
    }, new Map())

    const activeCommand = visibleCommands[activeIndex]
    const handleKeyDown = (event) => {
        if (event.key === "Escape") {
            event.preventDefault()
            event.stopPropagation()
            if (!event.repeat) onClose()
            return
        }

        if (event.key === "ArrowDown") {
            event.preventDefault()
            event.stopPropagation()
            onMoveActive(1)
            return
        }

        if (event.key === "ArrowUp") {
            event.preventDefault()
            event.stopPropagation()
            onMoveActive(-1)
            return
        }

        if (event.key === "Enter") {
            event.preventDefault()
            event.stopPropagation()
            onExecuteActive()
            return
        }

        if (event.key !== "Tab") return

        const focusable = getFocusableElements(event.currentTarget)
        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first.focus()
        }
    }

    return (
        <div className="command-palette-backdrop" onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose()
        }}>
            <section
                className="command-palette"
                role="dialog"
                aria-modal="true"
                aria-labelledby="command-palette-title"
                onKeyDownCapture={handleKeyDown}
            >
                <h2 id="command-palette-title" className="sr-only">Command palette</h2>
                <div className="command-palette-search-wrapper">
                    <div className="command-palette-search-icon-container">
                        <Command size={18} className="command-palette-search-icon" aria-hidden="true" />
                    </div>
                    <label className="sr-only" htmlFor="command-palette-search">Search commands</label>
                    <input
                        ref={searchInputRef}
                        id="command-palette-search"
                        className="command-palette-search"
                        type="text"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-controls="command-palette-results"
                        aria-activedescendant={activeCommand ? `command-palette-option-${activeCommand.id}` : undefined}
                        aria-label="Search commands"
                        placeholder="Search commands..."
                        value={query}
                        onChange={(event) => onQueryChange(event.target.value)}
                    />
                </div>

                <p className="sr-only" aria-live="polite">
                    {executingCommandId
                        ? "Command in progress"
                        : `${visibleCommands.length} command${visibleCommands.length === 1 ? "" : "s"} available`}
                </p>
                {commandError && <p className="command-palette-error" role="status">{commandError}</p>}

                <div id="command-palette-results" className="command-palette-results" role="listbox" aria-label="Commands">
                    {visibleCommands.length === 0 ? (
                        <p className="command-palette-empty">No matching commands.</p>
                    ) : (
                        Array.from(groups.entries()).map(([group, entries]) => (
                            <section key={group} className="command-palette-group" aria-labelledby={`command-palette-group-${group}`}>
                                <h3 id={`command-palette-group-${group}`}>{group}</h3>
                                {entries.map(({ command, index }) => {
                                    const Icon = command.icon
                                    const isActive = index === activeIndex
                                    const isPending = command.id === executingCommandId

                                    return (
                                        <button
                                            key={command.id}
                                            id={`command-palette-option-${command.id}`}
                                            className={`command-palette-option ${isActive ? "is-active" : ""}`}
                                            type="button"
                                            role="option"
                                            aria-selected={isActive}
                                            aria-disabled={command.disabled || isPending}
                                            disabled={command.disabled || Boolean(executingCommandId)}
                                            onMouseMove={() => {
                                                if (!command.disabled && !executingCommandId) {
                                                    onMoveActive(0, index)
                                                }
                                            }}
                                            onClick={() => onExecuteCommand(command)}
                                        >
                                            {Icon && <Icon size={16} aria-hidden="true" />}
                                            <span>{command.label}</span>
                                            {isPending && <span className="command-palette-pending">Working...</span>}
                                        </button>
                                    )
                                })}
                            </section>
                        ))
                    )}
                </div>

                <footer className="command-palette-footer">
                    <div className="command-palette-footer-keys">
                        <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
                        <span><kbd>↵</kbd> execute</span>
                        <span><kbd>esc</kbd> close</span>
                    </div>
                </footer>
            </section>
        </div>
    )
}

export default CommandPalette