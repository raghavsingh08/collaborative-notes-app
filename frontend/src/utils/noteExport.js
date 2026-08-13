const COMMENT_MARK_TYPE = "commentMark"
const DEFAULT_FILENAME = "Untitled note"
const MAX_FILENAME_LENGTH = 100

const isObject = (value) => value !== null && typeof value === "object"

const cloneValue = (value) => {
    if (Array.isArray(value)) return value.map(cloneValue)
    if (!isObject(value)) return value

    return Object.fromEntries(
        Object.entries(value).map(([key, nestedValue]) => [key, cloneValue(nestedValue)])
    )
}

const cloneNodeForExport = (value) => {
    if (Array.isArray(value)) return value.map(cloneNodeForExport)
    if (!isObject(value)) return value

    return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => {
        if (key === "marks" && Array.isArray(nestedValue)) {
            const marks = nestedValue
                .filter((mark) => mark?.type !== COMMENT_MARK_TYPE)
                .map(cloneValue)

            return [key, marks]
        }

        return [key, cloneNodeForExport(nestedValue)]
    }))
}

const getChildren = (node) => Array.isArray(node?.content) ? node.content : []

const trimDocumentOutput = (value) => {
    const output = String(value || "")
    return output.trim() ? output.replace(/^\n+|\n+$/g, "") : ""
}

const escapeMarkdownText = (value) => String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("*", "\\*")
    .replaceAll("_", "\\_")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]")
    .replaceAll("`", "\\`")

const escapeMarkdownBlockStart = (value) => String(value || "").replace(
    /^(\s*)(#{1,6}(?=\s)|[>+*-](?=\s)|\d+[.)](?=\s))/,
    "$1\\$2"
)

const getLongestBacktickRun = (value) => {
    const matches = String(value || "").match(/`+/g) || []
    return matches.reduce((longest, match) => Math.max(longest, match.length), 0)
}

const wrapInlineCode = (value) => {
    const delimiter = "`".repeat(Math.max(1, getLongestBacktickRun(value) + 1))
    return `${delimiter}${String(value || "")}${delimiter}`
}

const getMark = (marks, type) => marks.find((mark) => mark?.type === type)

const serializeMarkdownText = (node) => {
    const marks = Array.isArray(node?.marks) ? node.marks : []
    const codeMark = getMark(marks, "code")
    let output = codeMark ? wrapInlineCode(node?.text) : escapeMarkdownText(node?.text)

    if (getMark(marks, "bold")) output = `**${output}**`
    if (getMark(marks, "italic")) output = `*${output}*`
    if (getMark(marks, "underline")) output = `<u>${output}</u>`
    if (getMark(marks, "strike")) output = `~~${output}~~`

    const linkMark = getMark(marks, "link")
    const href = typeof linkMark?.attrs?.href === "string" ? linkMark.attrs.href.trim() : ""

    if (href) {
        const escapedHref = href
            .replace(/\\/g, "\\\\")
            .replace(/[()]/g, "\\$&")
        output = `[${output}](${escapedHref})`
    }

    return output
}

const serializePlainText = (node) => {
    const text = String(node?.text || "")
    const marks = Array.isArray(node?.marks) ? node.marks : []
    const linkMark = getMark(marks, "link")
    const href = typeof linkMark?.attrs?.href === "string" ? linkMark.attrs.href.trim() : ""

    if (!href || text.trim() === href) return text
    return `${text} (${href})`
}

const getRawText = (nodes) => nodes.map((node) => {
    if (node?.type === "text") return String(node.text || "")
    if (node?.type === "hardBreak") return "\n"
    return getRawText(getChildren(node))
}).join("")

const serializeMarkdownInline = (nodes) => nodes.map((node) => {
    if (node?.type === "text") return serializeMarkdownText(node)
    if (node?.type === "hardBreak") return "  \n"
    return serializeMarkdownNode(node)
}).join("")

const serializePlainTextInline = (nodes) => nodes.map((node) => {
    if (node?.type === "text") return serializePlainText(node)
    if (node?.type === "hardBreak") return "\n"
    return serializePlainTextNode(node)
}).join("")

const serializeListMarkdown = (node, depth = 0) => {
    const ordered = node?.type === "orderedList"
    const start = Number.isInteger(node?.attrs?.start) ? node.attrs.start : 1
    const indent = "  ".repeat(depth)

    return getChildren(node).map((item, index) => {
        const marker = ordered ? `${start + index}.` : "-"
        const nonListChildren = getChildren(item).filter((child) => (
            child?.type !== "bulletList" && child?.type !== "orderedList"
        ))
        const nestedLists = getChildren(item).filter((child) => (
            child?.type === "bulletList" || child?.type === "orderedList"
        ))
        const itemBody = nonListChildren
            .map((child) => serializeMarkdownNode(child, { listDepth: depth }))
            .filter(Boolean)
            .join("\n\n")
        const continuationIndent = `${indent}${" ".repeat(marker.length + 1)}`
        const itemLines = itemBody ? itemBody.split("\n") : [""]
        const renderedItem = itemLines
            .map((line, lineIndex) => (
                lineIndex === 0 ? `${indent}${marker} ${line}` : `${continuationIndent}${line}`
            ))
            .join("\n")
        const nested = nestedLists
            .map((child) => serializeListMarkdown(child, depth + 1))
            .filter(Boolean)
            .join("\n")

        return nested ? `${renderedItem}\n${nested}` : renderedItem
    }).join("\n")
}

const serializeListPlainText = (node, depth = 0) => {
    const ordered = node?.type === "orderedList"
    const start = Number.isInteger(node?.attrs?.start) ? node.attrs.start : 1
    const indent = "  ".repeat(depth)

    return getChildren(node).map((item, index) => {
        const marker = ordered ? `${start + index}.` : "-"
        const nonListChildren = getChildren(item).filter((child) => (
            child?.type !== "bulletList" && child?.type !== "orderedList"
        ))
        const nestedLists = getChildren(item).filter((child) => (
            child?.type === "bulletList" || child?.type === "orderedList"
        ))
        const itemBody = nonListChildren
            .map((child) => serializePlainTextNode(child, { listDepth: depth }))
            .filter(Boolean)
            .join("\n\n")
        const continuationIndent = `${indent}${" ".repeat(marker.length + 1)}`
        const itemLines = itemBody ? itemBody.split("\n") : [""]
        const renderedItem = itemLines
            .map((line, lineIndex) => (
                lineIndex === 0 ? `${indent}${marker} ${line}` : `${continuationIndent}${line}`
            ))
            .join("\n")
        const nested = nestedLists
            .map((child) => serializeListPlainText(child, depth + 1))
            .filter(Boolean)
            .join("\n")

        return nested ? `${renderedItem}\n${nested}` : renderedItem
    }).join("\n")
}

const serializeMarkdownNode = (node, context = {}) => {
    if (!isObject(node)) return ""

    const children = getChildren(node)

    switch (node.type) {
        case "doc":
            return children.map((child) => serializeMarkdownNode(child, context)).filter(Boolean).join("\n\n")
        case "text":
            return serializeMarkdownText(node)
        case "paragraph":
            return escapeMarkdownBlockStart(serializeMarkdownInline(children))
        case "heading": {
            const level = Math.min(6, Math.max(1, Number(node?.attrs?.level) || 1))
            return `${"#".repeat(level)} ${serializeMarkdownInline(children)}`
        }
        case "bulletList":
        case "orderedList":
            return serializeListMarkdown(node, context.listDepth || 0)
        case "listItem":
            return children.map((child) => serializeMarkdownNode(child, context)).filter(Boolean).join("\n")
        case "blockquote": {
            const content = children.map((child) => serializeMarkdownNode(child, context)).filter(Boolean).join("\n\n")
            return content.split("\n").map((line) => (line ? `> ${line}` : ">")).join("\n")
        }
        case "codeBlock": {
            const code = getRawText(children)
            const fence = "`".repeat(Math.max(3, getLongestBacktickRun(code) + 1))
            const language = typeof node?.attrs?.language === "string" && /^[A-Za-z0-9_+-]+$/.test(node.attrs.language)
                ? node.attrs.language
                : ""
            return `${fence}${language}\n${code}\n${fence}`
        }
        case "hardBreak":
            return "  \n"
        case "horizontalRule":
            return "---"
        default:
            return children.map((child) => serializeMarkdownNode(child, context)).join("")
    }
}

const serializePlainTextNode = (node, context = {}) => {
    if (!isObject(node)) return ""

    const children = getChildren(node)

    switch (node.type) {
        case "doc":
            return children.map((child) => serializePlainTextNode(child, context)).filter(Boolean).join("\n\n")
        case "text":
            return serializePlainText(node)
        case "paragraph":
        case "heading":
            return serializePlainTextInline(children)
        case "bulletList":
        case "orderedList":
            return serializeListPlainText(node, context.listDepth || 0)
        case "listItem":
            return children.map((child) => serializePlainTextNode(child, context)).filter(Boolean).join("\n")
        case "blockquote": {
            const content = children.map((child) => serializePlainTextNode(child, context)).filter(Boolean).join("\n\n")
            return content.split("\n").map((line) => (line ? `> ${line}` : ">")).join("\n")
        }
        case "codeBlock":
            return serializePlainTextInline(children)
        case "hardBreak":
            return "\n"
        case "horizontalRule":
            return "---"
        default:
            return children.map((child) => serializePlainTextNode(child, context)).join("")
    }
}

const sanitizeNoteJsonForExport = (contentJson) => {
    if (!isObject(contentJson) && !Array.isArray(contentJson)) return contentJson ?? null
    return cloneNodeForExport(contentJson)
}

const serializeNoteToMarkdown = (contentJson) => (
    trimDocumentOutput(serializeMarkdownNode(sanitizeNoteJsonForExport(contentJson)))
)

const serializeNoteToPlainText = (contentJson) => (
    trimDocumentOutput(serializePlainTextNode(sanitizeNoteJsonForExport(contentJson)))
)

const createExportFilename = (title, extension) => {
    const removeControlCharacters = (value) => Array.from(String(value || "")).filter((character) => {
        const code = character.charCodeAt(0)
        return code >= 32 && code !== 127
    }).join("")
    const normalizedExtension = removeControlCharacters(extension)
        .trim()
        .replace(/^\.+/, "")
        .replace(/[<>:"/\\|?*]/g, "")
    const safeExtension = normalizedExtension ? `.${normalizedExtension}` : ""
    let baseName = removeControlCharacters(title)
        .replace(/[<>:"/\\|?*]/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/[. ]+$/g, "")

    baseName = baseName.slice(0, MAX_FILENAME_LENGTH).replace(/[. ]+$/g, "")

    if (!baseName || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i.test(baseName)) {
        baseName = DEFAULT_FILENAME
    }

    return `${baseName}${safeExtension}`
}

const downloadTextFile = (content, filename, mimeType) => {
    const blob = new Blob([String(content ?? "")], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")

    anchor.href = url
    anchor.download = filename
    anchor.style.display = "none"
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()

    setTimeout(() => URL.revokeObjectURL(url), 0)
}

export {
    createExportFilename,
    downloadTextFile,
    sanitizeNoteJsonForExport,
    serializeNoteToMarkdown,
    serializeNoteToPlainText
}
