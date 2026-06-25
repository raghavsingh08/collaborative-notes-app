import { Link } from "react-router-dom"
import { IconArrowLeft } from "../components/ui/Icons"
import usePageTitle from "../hooks/usePageTitle"

const NotFoundPage = () => {
    usePageTitle("Page not found")

    return (
        <main className="not-found-shell">
            <div className="not-found-content">
                <p className="not-found-code" aria-hidden="true">404</p>
                <h1>Page not found</h1>
                <p className="not-found-description">
                    The page you're looking for doesn't exist or has been moved.
                </p>
                <Link className="primary-button" to="/">
                    <IconArrowLeft size={14} />
                    Back to home
                </Link>
            </div>
        </main>
    )
}

export default NotFoundPage
