/**
 * Icons — a minimal, consistent SVG icon set for the application.
 * All icons use currentColor for theme-aware rendering.
 * Size defaults to 16x16; pass size prop to override.
 */

const iconProps = (size = 16) => ({
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": true,
    focusable: false,
})

export const IconArrowLeft = ({ size = 16 }) => (
    <svg {...iconProps(size)}>
        <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
)

export const IconSettings = ({ size = 16 }) => (
    <svg {...iconProps(size)}>
        <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.42 1.42M11.54 11.54l1.41 1.41M3.05 12.95l1.42-1.42M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
)

export const IconShare = ({ size = 16 }) => (
    <svg {...iconProps(size)}>
        <circle cx="12" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="12" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="4" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10.5 3.75L5.5 7.25M10.5 12.25L5.5 8.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
)

export const IconTrash = ({ size = 16 }) => (
    <svg {...iconProps(size)}>
        <path d="M2 4h12M5.5 4V3a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v1M6 7v5M10 7v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3.5 4l.8 8.1a1 1 0 001 .9h5.4a1 1 0 001-.9L12.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
)

export const IconSearch = ({ size = 16 }) => (
    <svg {...iconProps(size)}>
        <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
)

export const IconUsers = ({ size = 16 }) => (
    <svg {...iconProps(size)}>
        <circle cx="6" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M1.5 13.5c0-2.485 2.015-4.5 4.5-4.5s4.5 2.015 4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M11 7c1.38 0 2.5 1.12 2.5 2.5M14.5 13.5c0-1.38-1.12-2.5-2.5-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
)

export const IconClose = ({ size = 16 }) => (
    <svg {...iconProps(size)}>
        <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
)

export const IconSave = ({ size = 16 }) => (
    <svg {...iconProps(size)}>
        <path d="M3 2h8l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M10 2v3.5a.5.5 0 01-.5.5h-4a.5.5 0 01-.5-.5V2M5 10h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
)

export const IconMoreHorizontal = ({ size = 16 }) => (
    <svg {...iconProps(size)}>
        <circle cx="3.5" cy="8" r="1.25" fill="currentColor" />
        <circle cx="8" cy="8" r="1.25" fill="currentColor" />
        <circle cx="12.5" cy="8" r="1.25" fill="currentColor" />
    </svg>
)

export const IconNote = ({ size = 16 }) => (
    <svg {...iconProps(size)}>
        <path d="M4 2h6l4 4v8a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M10 2v4h4M6 8h4M6 11h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
)

export const IconHome = ({ size = 16 }) => (
    <svg {...iconProps(size)}>
        <path d="M2 7L8 2l6 5v7a1 1 0 01-1 1H3a1 1 0 01-1-1V7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M6 14v-5h4v5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
)

export const IconSun = ({ size = 16 }) => (
    <svg {...iconProps(size)}>
        <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.42 1.42M11.54 11.54l1.41 1.41M3.05 12.95l1.42-1.42M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
)

export const IconMoon = ({ size = 16 }) => (
    <svg {...iconProps(size)}>
        <path d="M13.5 9.5A5.5 5.5 0 016.5 2.5a6 6 0 100 11 5.5 5.5 0 007-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
)

export const IconCheck = ({ size = 16 }) => (
    <svg {...iconProps(size)}>
        <path d="M3 8l3.5 3.5L13 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
)

export const IconPlus = ({ size = 16 }) => (
    <svg {...iconProps(size)}>
        <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
)

export const IconAlertCircle = ({ size = 16 }) => (
    <svg {...iconProps(size)}>
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 5v3.5M8 11h.01" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
)

export const IconLogOut = ({ size = 16 }) => (
    <svg {...iconProps(size)}>
        <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
)

export const IconChevronDown = ({ size = 16 }) => (
    <svg {...iconProps(size)}>
        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
)
