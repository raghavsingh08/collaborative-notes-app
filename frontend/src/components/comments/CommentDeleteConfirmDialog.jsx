import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { Trash2 } from "lucide-react"

const getFocusableElements = (container) => {
    if (!container) return []

    return Array.from(container.querySelectorAll(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((element) => !element.hasAttribute("hidden"))
}

const CommentDeleteConfirmDialog = ({ target, isDeleting, onConfirm, onCancel }) => {
    const dialogRef = useRef(null)
    const cancelButtonRef = useRef(null)
    const previousFocusRef = useRef(null)
    const isThread = target.type === "thread"
    const title = isThread ? "Delete comment thread?" : "Delete reply?"
    const message = isThread
        ? "This will permanently delete the comment and all of its replies. The highlighted text will remain."
        : "This reply will be permanently removed from the thread."
    const confirmLabel = isThread ? "Delete thread" : "Delete reply"

    useEffect(() => {
        previousFocusRef.current = document.activeElement
        const frame = requestAnimationFrame(() => cancelButtonRef.current?.focus())

        return () => {
            cancelAnimationFrame(frame)
            const previousFocus = previousFocusRef.current
            previousFocusRef.current = null

            requestAnimationFrame(() => {
                if (previousFocus?.isConnected && typeof previousFocus.focus === "function") {
                    previousFocus.focus()
                }
            })
        }
    }, [])

    const handleKeyDown = (event) => {
        if (event.key === "Escape") {
            event.preventDefault()
            event.stopPropagation()
            if (!event.repeat && !isDeleting) onCancel()
            return
        }

        if (event.key !== "Tab") return

        const focusable = getFocusableElements(dialogRef.current)
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

    return createPortal(
        <div
            className="modal-backdrop comment-delete-dialog-backdrop"
            onMouseDown={(event) => {
                if (!isDeleting && event.target === event.currentTarget) onCancel()
            }}
        >
            <section
                ref={dialogRef}
                className="modal-card delete-confirm-modal comment-delete-confirm-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="comment-delete-confirm-title"
                aria-describedby="comment-delete-confirm-description"
                onKeyDown={handleKeyDown}
            >
                <header className="modal-header">
                    <div>
                        <p className="eyebrow">Delete comment</p>
                        <h2 id="comment-delete-confirm-title">{title}</h2>
                    </div>
                </header>

                <p id="comment-delete-confirm-description">{message}</p>

                <div className="modal-actions">
                    <button
                        ref={cancelButtonRef}
                        className="ghost-button"
                        type="button"
                        disabled={isDeleting}
                        onClick={onCancel}
                    >
                        Cancel
                    </button>
                    <button
                        className="danger-button"
                        type="button"
                        disabled={isDeleting}
                        aria-busy={isDeleting}
                        onClick={onConfirm}
                    >
                        <Trash2 size={14} aria-hidden="true" />
                        {isDeleting ? "Deleting..." : confirmLabel}
                    </button>
                </div>
            </section>
        </div>,
        document.body
    )
}

export default CommentDeleteConfirmDialog