import { useEffect } from "react"

const BASE_TITLE = "Collaborative Notes"

/**
 * Sets document.title for the current page.
 * Pass a string or a reactive value that changes per page.
 *
 * @param {string} pageTitle — The page-specific segment (e.g. "Dashboard", "Settings", a note title)
 */
const usePageTitle = (pageTitle) => {
    useEffect(() => {
        if (pageTitle) {
            document.title = `${pageTitle} — ${BASE_TITLE}`
        } else {
            document.title = `${BASE_TITLE} — Write, share, and co-edit in real time`
        }

        return () => {
            document.title = `${BASE_TITLE} — Write, share, and co-edit in real time`
        }
    }, [pageTitle])
}

export default usePageTitle
