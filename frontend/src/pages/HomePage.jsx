import { Link } from "react-router-dom"
import { IconSearch, IconUsers, IconSave, IconShare, IconCheck } from "../components/ui/Icons"
import usePageTitle from "../hooks/usePageTitle"
import "./HomePage.css"

/* ----------------------------------------------------------------
   Tiny inline SVG icons used ONLY on this landing page.
   These avoid modifying the shared Icons.jsx component.
   ---------------------------------------------------------------- */

/* Brand logo mark — two overlapping note pages with a collaborative accent */
const BrandLogo = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Back page */}
        <rect x="5" y="2" width="14" height="18" rx="3" fill="currentColor" opacity="0.25" />
        {/* Front page */}
        <rect x="3" y="4" width="14" height="18" rx="3" fill="currentColor" opacity="0.6" />
        {/* Writing lines */}
        <line x1="7" y1="10" x2="13" y2="10" stroke="var(--lp-bg)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="7" y1="14" x2="11" y2="14" stroke="var(--lp-bg)" strokeWidth="1.5" strokeLinecap="round" />
        {/* Collab dot */}
        <circle cx="18" cy="6" r="3.5" fill="var(--lp-accent)" />
    </svg>
)

const ChevronRight = ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4l4 4-4 4" /></svg>
)
const Clock = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="8" r="6.5" /><path d="M8 4.5V8l2.5 1.5" /></svg>
)
const Activity = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 8h-2.5l-2 4-3-8-2 4H2" /></svg>
)
const MessageCircle = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 7.5a5.5 5.5 0 0 1-5.5 5.5H3l1.5-1.5A5.5 5.5 0 1 1 14 7.5Z" /></svg>
)
const Shield = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 1.5L2.5 4v3.5c0 3.5 2.3 6 5.5 7 3.2-1 5.5-3.5 5.5-7V4L8 1.5Z" /></svg>
)
const Link2 = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 9.5a3 3 0 0 0 4.2.3l2-2a3 3 0 0 0-4.2-4.3l-1 1" /><path d="M9.5 6.5a3 3 0 0 0-4.2-.3l-2 2a3 3 0 0 0 4.2 4.3l1-1" /></svg>
)
/* Small doc icon for the editor titlebar — simpler than the brand mark */
const DocIcon = ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2h5.5L13 5.5V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" /><path d="M9 2v4h4" /></svg>
)

const HomePage = () => {
    usePageTitle("")

    return (
        <div className="lp-wrapper">
            {/* ============ NAVIGATION ============ */}
            <nav className="lp-nav">
                <div className="lp-nav-inner">
                    <Link className="lp-nav-brand" to="/">
                        <BrandLogo size={22} />
                        Collaborative Notes
                    </Link>
                    <div className="lp-nav-links">
                        <a href="#features">Features</a>
                        <a href="#how-it-works">How it works</a>
                        <a href="#security">Security</a>
                        <a href="#footer">About</a>
                    </div>
                    <div className="lp-nav-actions">
                        <Link className="lp-btn lp-btn-ghost" to="/login">Sign in</Link>
                        <Link className="lp-btn lp-btn-primary" to="/register">Get started free</Link>
                    </div>
                </div>
            </nav>

            {/* ============ HERO SECTION ============ */}
            <section className="lp-hero">
                <div className="lp-hero-content">
                    <div className="lp-hero-badge">
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--lp-teal)" }} />
                        Real-time collaboration for modern teams
                    </div>

                    <h1>
                        Think together.<br />
                        <span className="lp-hero-gradient">Create</span> together.
                    </h1>

                    <p className="lp-hero-subtitle">
                        A collaborative notes workspace that helps teams write, discuss, and build ideas together in real time. With threaded comments, version history, and seamless sharing.
                    </p>

                    <div className="lp-hero-actions">
                        <Link className="lp-btn lp-btn-primary" to="/register">
                            Get started for free <ChevronRight size={16} />
                        </Link>
                        <Link className="lp-btn lp-btn-secondary" to="/login">
                            Book a demo
                        </Link>
                    </div>

                    <div className="lp-hero-trust">
                        <div className="lp-trust-item">
                            <span className="lp-trust-dot" />
                            Secure by default
                        </div>
                        <div className="lp-trust-item">
                            <span className="lp-trust-dot" />
                            Real-time sync
                        </div>
                        <div className="lp-trust-item">
                            <span className="lp-trust-dot" />
                            Auto save
                        </div>
                    </div>

                    <div className="lp-hero-social">
                        <div className="lp-avatar-stack">
                            <div className="lp-avatar-sm">S</div>
                            <div className="lp-avatar-sm">A</div>
                            <div className="lp-avatar-sm">M</div>
                            <div className="lp-avatar-sm">J</div>
                            <div className="lp-avatar-sm">+</div>
                        </div>
                        <span className="lp-social-text">Loved by productive teams</span>
                    </div>
                </div>

                {/* ============ HERO EDITOR MOCKUP ============ */}
                <div className="lp-editor-mock" aria-hidden="true">
                    {/* Title Bar */}
                    <div className="lp-editor-titlebar">
                        <div className="lp-editor-dots"><span /><span /><span /></div>
                        <div className="lp-editor-titlebar-center">
                            <DocIcon size={14} />
                            Weekly Sync Notes
                        </div>
                        <div className="lp-editor-titlebar-right">
                            <div className="lp-avatar-stack" style={{ marginRight: 8 }}>
                                <div className="lp-avatar-sm" style={{ width: 24, height: 24, fontSize: 9, borderWidth: 1.5 }}>S</div>
                                <div className="lp-avatar-sm" style={{ width: 24, height: 24, fontSize: 9, borderWidth: 1.5 }}>A</div>
                                <div className="lp-avatar-sm" style={{ width: 24, height: 24, fontSize: 9, borderWidth: 1.5 }}>M</div>
                            </div>
                            <span style={{ fontSize: 12, color: "var(--lp-text-tertiary)" }}>
                                <IconShare size={12} /> Share
                            </span>
                            <span className="lp-autosave-indicator">
                                <span className="lp-autosave-dot" />
                                Saving...
                            </span>
                        </div>
                    </div>

                    {/* Editor Layout: Sidebar | Main | Panel */}
                    <div className="lp-editor-layout">
                        {/* Sidebar */}
                        <div className="lp-editor-sidebar">
                            <div className="lp-sidebar-item active"><DocIcon size={14} /> Weekly Sync Notes</div>
                            <div className="lp-sidebar-item"><DocIcon size={14} /> API Migration Plan</div>
                            <div className="lp-sidebar-item"><DocIcon size={14} /> Design Review <span className="lp-unread-badge" /></div>
                            <div className="lp-sidebar-item"><DocIcon size={14} /> Sprint Retro</div>
                            <div className="lp-sidebar-item"><DocIcon size={14} /> Architecture Decisions</div>
                        </div>

                        {/* Main Editor Content */}
                        <div className="lp-editor-main">
                            <div className="lp-editor-toolbar">
                                <span className="lp-toolbar-btn">H1</span>
                                <span className="lp-toolbar-btn">H2</span>
                                <span className="lp-toolbar-btn" style={{ fontWeight: 800 }}>B</span>
                                <span className="lp-toolbar-btn" style={{ fontStyle: "italic" }}>I</span>
                                <span className="lp-toolbar-btn" style={{ fontSize: 11 }}>&lt;/&gt;</span>
                                <span className="lp-toolbar-btn">≡</span>
                                <span className="lp-toolbar-btn">☰</span>
                            </div>

                            <h2>Weekly Sync Notes</h2>
                            <p style={{ fontSize: 13, color: "var(--lp-text-tertiary)", marginBottom: 16 }}>Last edited 2 minutes ago by Sarah, Alex, and Mike</p>

                            <h2 style={{ fontSize: 16, marginTop: 16, fontWeight: 600 }}>Action items</h2>

                            <div className="lp-editor-checkbox">
                                <span className="lp-check-icon checked"><IconCheck size={12} /></span>
                                <span className="lp-checkbox-done">Review pull request for auth flow refactor</span>
                            </div>
                            <div className="lp-editor-checkbox">
                                <span className="lp-check-icon checked"><IconCheck size={12} /></span>
                                <span className="lp-checkbox-done">Update API documentation for v2 endpoints</span>
                            </div>
                            <div className="lp-editor-checkbox">
                                <span className="lp-check-icon" />
                                <span>Schedule design review for dashboard redesign</span>
                            </div>
                            <div className="lp-editor-checkbox">
                                <span className="lp-check-icon" />
                                <span>Draft migration plan for database schema changes<span className="lp-blinking-cursor">|</span></span>
                            </div>

                            <h2 style={{ fontSize: 16, marginTop: 20, fontWeight: 600 }}>Discussion</h2>
                            <p>
                                <span className="lp-inline-comment">The dashboard redesign timeline feels tight — can we push the beta by a week?</span> We should align with the design team before committing to anything.
                            </p>

                            {/* Collaborative Cursors */}
                            <div className="lp-collab-cursor lp-cursor-sarah" style={{ top: 100, left: 320 }}>
                                <span className="lp-cursor-flag">Sarah</span>
                                <span className="lp-cursor-line" />
                            </div>
                            <div className="lp-collab-cursor lp-cursor-alex" style={{ top: 260, left: 180 }}>
                                <span className="lp-cursor-flag">Alex</span>
                                <span className="lp-cursor-line" />
                            </div>
                        </div>

                        {/* Right Panel */}
                        <div className="lp-editor-panel">
                            {/* Thread Section */}
                            <div className="lp-panel-section">
                                <div className="lp-panel-header">
                                    <span>Thread</span>
                                    <span style={{ color: "var(--lp-accent)", cursor: "pointer", textTransform: "none", letterSpacing: 0, fontWeight: 500 }}>Resolve</span>
                                </div>
                                <div className="lp-thread-message">
                                    <div className="lp-thread-avatar" style={{ background: "var(--lp-collab-1)", color: "white" }}>S</div>
                                    <div className="lp-thread-content">
                                        <span className="lp-thread-name">Sarah <span className="lp-thread-time">2m ago</span></span>
                                        <p className="lp-thread-text">I think pushing the beta by one week is reasonable. Let me check with design.</p>
                                        <span className="lp-thread-replies">2 replies</span>
                                    </div>
                                </div>
                                <div className="lp-thread-message">
                                    <div className="lp-thread-avatar" style={{ background: "var(--lp-collab-2)", color: "white" }}>A</div>
                                    <div className="lp-thread-content">
                                        <span className="lp-thread-name">Alex <span className="lp-thread-time">1m ago</span></span>
                                        <p className="lp-thread-text">@Sarah Sounds good — I'll update the sprint board.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Version History */}
                            <div className="lp-panel-section">
                                <div className="lp-panel-header">
                                    <span>Version History</span>
                                    <span style={{ color: "var(--lp-accent)", cursor: "pointer", textTransform: "none", letterSpacing: 0, fontWeight: 500 }}>View all</span>
                                </div>
                                <div className="lp-version-item">
                                    <span className="lp-version-label">Version 8</span>
                                    <span className="lp-version-current">Current</span>
                                </div>
                                <div className="lp-version-item">
                                    <span className="lp-version-label">Version 7</span>
                                    <span className="lp-version-time">Today, 9:32 AM</span>
                                </div>
                                <div className="lp-version-item">
                                    <span className="lp-version-label">Version 6</span>
                                    <span className="lp-version-time">Yesterday</span>
                                </div>
                            </div>

                            {/* Activity */}
                            <div className="lp-panel-section">
                                <div className="lp-panel-header">
                                    <span>Activity</span>
                                    <span style={{ color: "var(--lp-accent)", cursor: "pointer", textTransform: "none", letterSpacing: 0, fontWeight: 500 }}>View all</span>
                                </div>
                                <div className="lp-activity-item">
                                    <span className="lp-activity-dot" style={{ background: "var(--lp-collab-3)" }} />
                                    <span className="lp-activity-text">Mike joined</span>
                                    <span className="lp-activity-time">2m</span>
                                </div>
                                <div className="lp-activity-item">
                                    <span className="lp-activity-dot" style={{ background: "var(--lp-collab-1)" }} />
                                    <span className="lp-activity-text">Sarah commented on §Discussion</span>
                                    <span className="lp-activity-time">3m</span>
                                </div>
                                <div className="lp-activity-item">
                                    <span className="lp-activity-dot" style={{ background: "var(--lp-collab-2)" }} />
                                    <span className="lp-activity-text">Alex completed 2 tasks</span>
                                    <span className="lp-activity-time">5m</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Status Bar */}
                    <div className="lp-editor-statusbar">
                        <span>Type '/' for commands</span>
                        <span className="lp-autosave-indicator">
                            <span className="lp-autosave-dot" />
                            Autosaved just now · 1,234 words
                        </span>
                    </div>
                </div>
            </section>

            {/* ============ TRUST STRIP ============ */}
            <section className="lp-trust-strip">
                <div className="lp-trust-strip-text">Everything your team needs in one workspace</div>
                <div className="lp-trust-strip-icons">
                    <div className="lp-trust-icon-item"><IconUsers size={15} /> Real-time Editing</div>
                    <div className="lp-trust-icon-item"><MessageCircle size={15} /> Threaded Comments</div>
                    <div className="lp-trust-icon-item"><Clock size={15} /> Version History</div>
                    <div className="lp-trust-icon-item"><Activity size={15} /> Activity Timeline</div>
                    <div className="lp-trust-icon-item"><Shield size={15} /> Permissions</div>
                    <div className="lp-trust-icon-item"><IconSave size={15} /> Autosave</div>
                </div>
            </section>

            {/* ============ STORYTELLING BENTO SECTION ============ */}
            <section className="lp-story" id="features">
                <div className="lp-story-header" id="how-it-works">
                    <p className="lp-eyebrow">How it works</p>
                    <h2>Everything teams need to build together</h2>
                </div>

                <div className="lp-bento">
                    {/* ---- 01 — Real-time Collaboration (Wide) ---- */}
                    <article className="lp-bento-card lp-bento-wide">
                        <div className="lp-bento-number">
                            <div className="lp-bento-icon"><IconUsers size={20} /></div>
                            01
                        </div>
                        <h3>Real-time collaboration</h3>
                        <p>See every change as it happens. Edit together in real time and stay perfectly in sync.</p>
                        <span className="lp-bento-link">Learn more <ChevronRight /></span>
                        <div className="lp-bento-visual">
                            <div className="lp-collab-visual">
                                <div className="lp-typing-indicator typing-sarah">
                                    <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--lp-collab-1)", color: "white", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700 }}>S</span>
                                    Sarah is typing...
                                </div>
                                <div className="lp-typing-indicator typing-alex" style={{ marginLeft: 48 }}>
                                    <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--lp-collab-2)", color: "white", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700 }}>A</span>
                                    Alex is editing...
                                </div>
                                <div className="lp-typing-indicator typing-mike" style={{ marginLeft: 96 }}>
                                    <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--lp-collab-3)", color: "white", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700 }}>M</span>
                                    Mike is typing...
                                </div>
                            </div>
                        </div>
                    </article>

                    {/* ---- 02 — Discuss (Narrow) ---- */}
                    <article className="lp-bento-card lp-bento-narrow">
                        <div className="lp-bento-number">
                            <div className="lp-bento-icon"><MessageCircle size={20} /></div>
                            02
                        </div>
                        <h3>Threaded comments</h3>
                        <p>Discuss ideas in context with threads and replies.</p>
                        <span className="lp-bento-link">Learn more <ChevronRight /></span>
                        <div className="lp-bento-visual">
                            <div className="lp-mini-thread">
                                <div className="lp-mini-comment">
                                    <div className="lp-mini-avatar" style={{ background: "var(--lp-collab-1)", color: "white" }}>S</div>
                                    <div className="lp-mini-bubble">
                                        <span className="lp-mini-name">Sarah <span className="lp-mini-time">2m ago</span></span>
                                        <p className="lp-mini-text">Great point!</p>
                                    </div>
                                </div>
                                <div className="lp-mini-comment">
                                    <div className="lp-mini-avatar" style={{ background: "var(--lp-collab-2)", color: "white" }}>A</div>
                                    <div className="lp-mini-bubble">
                                        <span className="lp-mini-name">Alex <span className="lp-mini-time">1m ago</span></span>
                                        <p className="lp-mini-text">I agree, let's go with this.</p>
                                    </div>
                                </div>
                                <div className="lp-mini-reply-input">Reply...</div>
                            </div>
                        </div>
                    </article>

                    {/* ---- 03 — Version History (Third) ---- */}
                    <article className="lp-bento-card lp-bento-third">
                        <div className="lp-bento-number">
                            <div className="lp-bento-icon"><Clock size={20} /></div>
                            03
                        </div>
                        <h3>Version history</h3>
                        <p>Track every change and restore any version, whenever you need.</p>
                        <span className="lp-bento-link">Learn more <ChevronRight /></span>
                        <div className="lp-bento-visual">
                            <div className="lp-mini-versions">
                                <div className="lp-mini-version">
                                    <span className="lp-mini-version-name">Version 8</span>
                                    <span className="lp-version-current">Current</span>
                                </div>
                                <div className="lp-mini-version">
                                    <span className="lp-mini-version-name">Version 7</span>
                                    <span className="lp-mini-version-meta">Today, 9:32 AM</span>
                                </div>
                                <div className="lp-mini-version">
                                    <span className="lp-mini-version-name">Version 6</span>
                                    <span className="lp-mini-version-meta">Yesterday</span>
                                </div>
                            </div>
                        </div>
                    </article>

                    {/* ---- 04 — Activity Timeline (Two Thirds) ---- */}
                    <article className="lp-bento-card lp-bento-two-thirds">
                        <div className="lp-bento-number">
                            <div className="lp-bento-icon"><Activity size={20} /></div>
                            04
                        </div>
                        <h3>Activity timeline</h3>
                        <p>See who did what and stay updated in real time.</p>
                        <span className="lp-bento-link">Learn more <ChevronRight /></span>
                        <div className="lp-bento-visual">
                            <div className="lp-mini-activity">
                                <div className="lp-mini-event">
                                    <span className="lp-mini-event-dot" style={{ background: "var(--lp-collab-3)" }} />
                                    <span className="lp-mini-event-text">Mike edited</span>
                                    <span className="lp-mini-event-time">2m ago</span>
                                </div>
                                <div className="lp-mini-event">
                                    <span className="lp-mini-event-dot" style={{ background: "var(--lp-collab-1)" }} />
                                    <span className="lp-mini-event-text">Sarah commented</span>
                                    <span className="lp-mini-event-time">3m ago</span>
                                </div>
                                <div className="lp-mini-event">
                                    <span className="lp-mini-event-dot" style={{ background: "var(--lp-collab-2)" }} />
                                    <span className="lp-mini-event-text">Alex updated</span>
                                    <span className="lp-mini-event-time">5m ago</span>
                                </div>
                                <div className="lp-mini-event">
                                    <span className="lp-mini-event-dot" style={{ background: "var(--lp-violet)" }} />
                                    <span className="lp-mini-event-text">You edited</span>
                                    <span className="lp-mini-event-time">10m ago</span>
                                </div>
                            </div>
                        </div>
                    </article>

                    {/* ---- 05 — Permission-based Sharing (Full) ---- */}
                    <article className="lp-bento-card lp-bento-full" id="security">
                        <div className="lp-bento-share-grid">
                            <div className="lp-share-visual">
                                <div className="lp-share-modal">
                                    <div className="lp-share-title">Share "Weekly Sync Notes"</div>
                                    <div className="lp-share-input-row">
                                        <div className="lp-share-input">Invite people or teams...</div>
                                        <div className="lp-share-role-btn">Can edit ▾</div>
                                    </div>
                                    <div className="lp-share-people-label">People with access</div>
                                    <div className="lp-share-person">
                                        <div className="lp-mini-avatar" style={{ background: "var(--lp-accent)", color: "white" }}>AJ</div>
                                        <div className="lp-share-person-info">
                                            <div className="lp-share-person-name">Alex Johnson</div>
                                            <div className="lp-share-person-email">alex@company.com</div>
                                        </div>
                                        <div className="lp-share-person-role">Owner ▾</div>
                                    </div>
                                    <div className="lp-share-person">
                                        <div className="lp-mini-avatar" style={{ background: "var(--lp-collab-1)", color: "white" }}>SC</div>
                                        <div className="lp-share-person-info">
                                            <div className="lp-share-person-name">Sarah Chen</div>
                                            <div className="lp-share-person-email">sarah@company.com</div>
                                        </div>
                                        <div className="lp-share-person-role">Can edit ▾</div>
                                    </div>
                                    <div className="lp-share-person">
                                        <div className="lp-mini-avatar" style={{ background: "var(--lp-collab-3)", color: "white" }}>MR</div>
                                        <div className="lp-share-person-info">
                                            <div className="lp-share-person-name">Mike Ross</div>
                                            <div className="lp-share-person-email">mike@company.com</div>
                                        </div>
                                        <div className="lp-share-person-role">Can comment ▾</div>
                                    </div>
                                    <div className="lp-share-link-section">
                                        <Link2 size={14} /> Anyone with the link · Can view
                                    </div>
                                </div>
                            </div>
                            <div style={{ padding: 32, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                                <div className="lp-bento-number">
                                    <div className="lp-bento-icon"><Shield size={20} /></div>
                                    05
                                </div>
                                <h3>Permission-based sharing</h3>
                                <p>Invite the right people. Control access with granular permissions for documents and folders.</p>
                                <span className="lp-bento-link">Learn more <ChevronRight /></span>
                            </div>
                        </div>
                    </article>
                </div>
            </section>

            {/* ============ FOOTER ============ */}
            <footer className="lp-footer" id="footer">
                <div className="lp-footer-cta">
                    <h2>Ready to build better, together?</h2>
                    <p>Join teams already collaborating in Collaborative Notes.</p>
                    <div className="lp-footer-cta-actions">
                        <Link className="lp-btn lp-btn-primary" to="/register">
                            Get started for free <ChevronRight size={16} />
                        </Link>
                        <Link className="lp-btn lp-btn-secondary" to="/login">
                            Book a demo
                        </Link>
                    </div>
                </div>

                <div className="lp-footer-bottom">
                    <div className="lp-footer-brand">
                        <div className="lp-footer-brand-name">
                            <BrandLogo size={18} />
                            Collaborative Notes
                        </div>
                        <p className="lp-footer-brand-desc">
                            A modern workspace for teams who think deeply and build together.
                        </p>
                    </div>
                    <div className="lp-footer-links">
                        <div className="lp-footer-column">
                            <h4>Product</h4>
                            <a href="#features">Features</a>
                            <a href="#how-it-works">How it works</a>
                            <a href="#security">Security</a>
                        </div>
                        <div className="lp-footer-column">
                            <h4>Resources</h4>
                            <a href="#">Documentation</a>
                            <a href="#">GitHub</a>
                            <a href="#">Contact</a>
                        </div>
                        <div className="lp-footer-column">
                            <h4>Legal</h4>
                            <a href="#">Privacy</a>
                            <a href="#">Terms</a>
                        </div>
                    </div>
                </div>

                <div className="lp-footer-copyright">
                    © 2026 Collaborative Notes. All rights reserved.
                </div>
            </footer>
        </div>
    )
}

export default HomePage
