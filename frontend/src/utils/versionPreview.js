import { generateHTML } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { yDocToProsemirrorJSON } from '@tiptap/y-tiptap'
import * as Y from 'yjs'
import { CommentMark } from '../components/editor/extensions/CommentMark'

const previewExtensions = [StarterKit, CommentMark]

const sanitizeHtml = (html) => {
    const template = document.createElement('template')
    template.innerHTML = String(html || '')

    template.content
        .querySelectorAll('script, style, iframe, object, embed, link, meta, form, input, button, textarea, select')
        .forEach((element) => element.remove())

    template.content.querySelectorAll('*').forEach((element) => {
        Array.from(element.attributes).forEach((attribute) => {
            const name = attribute.name.toLowerCase()
            const value = attribute.value.trim().toLowerCase()

            if (
                name.startsWith('on') ||
                name === 'style' ||
                name === 'srcdoc' ||
                ((name === 'href' || name === 'src') && /^(javascript|vbscript|data):/.test(value))
            ) {
                element.removeAttribute(attribute.name)
            }
        })

        if (element.getAttribute('target') === '_blank') {
            element.setAttribute('rel', 'noopener noreferrer')
        }
    })

    return template.innerHTML
}

const escapeHtml = (value) => {
    const element = document.createElement('div')
    element.textContent = String(value || '')
    return element.innerHTML
}

const hasVisibleHtml = (html) => {
    const template = document.createElement('template')
    template.innerHTML = String(html || '')

    return Boolean(
        template.content.textContent?.trim() ||
        template.content.querySelector('hr, img, video, audio, table, pre, blockquote, ul, ol')
    )
}

const normalizeJson = (value) => {
    if (!value) return null

    if (typeof value === 'string') {
        try {
            return JSON.parse(value)
        } catch {
            return null
        }
    }

    return value
}

const normalizeYjsState = (value) => {
    if (!value) return null
    if (value instanceof Uint8Array) return value
    if (value instanceof ArrayBuffer) return new Uint8Array(value)
    if (Array.isArray(value)) return Uint8Array.from(value)

    if (typeof value === 'string') {
        try {
            const binary = window.atob(value)
            return Uint8Array.from(binary, (character) => character.charCodeAt(0))
        } catch {
            return null
        }
    }

    if (value.data && value.data !== value) {
        return normalizeYjsState(value.data)
    }

    return null
}

const renderJson = (contentJson) => {
    try {
        return sanitizeHtml(generateHTML(contentJson, previewExtensions))
    } catch {
        return null
    }
}

const renderYjsState = (state) => {
    const encodedState = normalizeYjsState(state)

    if (!encodedState?.length) return null

    const ydoc = new Y.Doc()

    try {
        Y.applyUpdate(ydoc, encodedState)
        return renderJson(yDocToProsemirrorJSON(ydoc, 'default'))
    } catch {
        return null
    } finally {
        ydoc.destroy()
    }
}

const resolveSnapshotFields = (version) => {
    const snapshot = version?.snapshot && typeof version.snapshot === 'object'
        ? version.snapshot
        : {}

    return {
        title: version?.title ?? snapshot.title ?? '',
        contentJson: normalizeJson(
            version?.contentJson ?? version?.json ?? snapshot.contentJson ?? snapshot.json
        ),
        html: version?.html ?? snapshot.html ?? '',
        plainText: version?.content ?? version?.plainText ?? snapshot.content ?? snapshot.plainText ?? '',
        yjsState: version?.yjsState ?? version?.ydocState ?? snapshot.yjsState ?? snapshot.ydocState
    }
}

const renderVersionPreview = (version) => {
    const { title, contentJson, html, plainText, yjsState } = resolveSnapshotFields(version)
    const titleHtml = title ? `<h1>${escapeHtml(title)}</h1>` : ''
    let bodyHtml = contentJson ? renderJson(contentJson) : null

    if (!hasVisibleHtml(bodyHtml)) {
        const sanitizedHtml = html ? sanitizeHtml(html) : ''
        bodyHtml = hasVisibleHtml(sanitizedHtml) ? sanitizedHtml : null
    }

    if (!hasVisibleHtml(bodyHtml)) {
        const yjsHtml = renderYjsState(yjsState)
        bodyHtml = hasVisibleHtml(yjsHtml) ? yjsHtml : null
    }

    if (!hasVisibleHtml(bodyHtml) && String(plainText).length > 0) {
        bodyHtml = `<div>${escapeHtml(plainText).replace(/\r?\n/g, '<br>')}</div>`
    }

    if (!titleHtml && !hasVisibleHtml(bodyHtml)) {
        return '<p>No content</p>'
    }

    return `${titleHtml}${bodyHtml || ''}`
}

const unwrapVersionResponse = (response) => {
    const payload = response?.data ?? response

    return payload?.data?.version ??
        payload?.data ??
        payload?.version ??
        payload
}

export {
    renderVersionPreview,
    unwrapVersionResponse
}
