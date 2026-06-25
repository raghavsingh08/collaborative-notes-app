import { Link } from "react-router-dom"
import { IconCheck, IconMoon, IconNote, IconSave, IconShare, IconUsers } from "../components/ui/Icons"
import usePageTitle from "../hooks/usePageTitle"

const features = [
    {
        icon: <IconUsers size={18} />,
        title: "Real-time collaboration",
        description: "Write together with live updates that keep every teammate in the same document."
    },
    {
        icon: <IconSave size={18} />,
        title: "Auto-save",
        description: "Keep ideas moving while changes are saved quietly in the background."
    },
    {
        icon: <IconShare size={18} />,
        title: "Note sharing",
        description: "Invite collaborators by username or email and manage access from one place."
    },
    {
        icon: <IconCheck size={18} />,
        title: "Secure authentication",
        description: "Protect workspaces with JWT authentication and HTTP-only cookies."
    },
    {
        icon: <IconMoon size={18} />,
        title: "Dark and light mode",
        description: "Switch the interface tone for focused writing in any environment."
    }
]

const HomePage = () => {
    usePageTitle("")

    return (
        <main className="home-shell">
            <section className="home-hero">
                {/* Decorative app preview */}
                <div className="hero-preview" aria-hidden="true">
                    <div className="preview-sidebar">
                        <span />
                        <span />
                        <span />
                    </div>
                    <div className="preview-document">
                        <div className="preview-toolbar">
                            <span>Saved</span>
                            <span>3 active</span>
                        </div>
                        <div className="preview-title" />
                        <div className="preview-line wide" />
                        <div className="preview-line" />
                        <div className="preview-line short" />
                        <div className="preview-comments">
                            <span>AR</span>
                            <span>MK</span>
                            <strong>Shared note</strong>
                        </div>
                    </div>
                </div>

                {/* Navbar */}
                <nav className="home-nav" aria-label="Public navigation">
                    <Link className="home-brand" to="/">
                        <IconNote size={16} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
                        Collaborative Notes
                    </Link>
                    <div>
                        <Link className="ghost-button" to="/login">Sign in</Link>
                        <Link className="primary-button" to="/register">Get started</Link>
                    </div>
                </nav>

                {/* Hero copy */}
                <div className="hero-copy">
                    <p className="eyebrow">Modern team notes</p>
                    <h1>Collaborative Notes</h1>
                    <p className="hero-tagline">A calmer way to write, share, and co-edit ideas in real time.</p>
                    <p className="hero-description">
                        Bring documents, teammates, and live collaboration into one focused workspace — with autosave, sharing, and a polished editor built for everyday work.
                    </p>
                    <div className="hero-actions">
                        <Link className="primary-button" to="/register">Get started free</Link>
                        <Link className="secondary-button" to="/login">Sign in</Link>
                    </div>
                </div>
            </section>

            <section className="home-section" aria-labelledby="features-title">
                <div className="section-heading">
                    <p className="eyebrow">Everything teams expect</p>
                    <h2 id="features-title">Built for shared thinking</h2>
                </div>

                <div className="feature-grid">
                    {features.map((feature) => (
                        <article className="feature-card" key={feature.title}>
                            <span aria-hidden="true">{feature.icon}</span>
                            <h3>{feature.title}</h3>
                            <p>{feature.description}</p>
                        </article>
                    ))}
                </div>
            </section>
        </main>
    )
}

export default HomePage
