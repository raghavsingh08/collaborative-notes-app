import { useEffect, useRef } from "react"

const isEditorShortcutTarget = (target) => (
    target instanceof Element && Boolean(
        target.closest('[data-editor-shortcut-scope="true"]')
    )
)

const useEditorShortcuts = ({ enabled, onManualSave, isBlocked }) => {
    const enabledRef = useRef(enabled)
    const onManualSaveRef = useRef(onManualSave)
    const isBlockedRef = useRef(isBlocked)

    enabledRef.current = enabled
    onManualSaveRef.current = onManualSave
    isBlockedRef.current = isBlocked

    useEffect(() => {
        const handleKeyDown = (event) => {
            const isManualSaveShortcut = (event.ctrlKey || event.metaKey) &&
                !event.shiftKey &&
                !event.altKey &&
                !event.isComposing &&
                !event.repeat &&
                String(event.key).toLowerCase() === "s"

            if (
                !isManualSaveShortcut ||
                !enabledRef.current ||
                isBlockedRef.current ||
                !isEditorShortcutTarget(event.target)
            ) {
                return
            }

            event.preventDefault()
            event.stopPropagation()

            Promise.resolve(onManualSaveRef.current?.()).catch(() => {
                // The existing save path owns save-status and error reporting.
            })
        }

        document.addEventListener("keydown", handleKeyDown, true)
        return () => document.removeEventListener("keydown", handleKeyDown, true)
    }, [])
}

export default useEditorShortcuts