import { Schema } from "prosemirror-model"
import * as Y from "yjs"
import { prosemirrorJSONToYXmlFragment } from "@tiptap/y-tiptap"
import Note from "../models/note.model.js"

const YJS_FRAGMENT_FIELD = "default"
const BOOTSTRAP_CLIENT_ID = 1
const MIN_PERSISTABLE_STATE_BYTES = 2

const activeYjsDocs = new Map()
const loadingYjsDocs = new Map()

const noteContentSchema = new Schema({
    nodes: {
        doc: {
            content: "block+"
        },
        paragraph: {
            content: "inline*",
            group: "block"
        },
        text: {
            group: "inline"
        },
        heading: {
            attrs: {
                level: {
                    default: 1
                }
            },
            content: "inline*",
            group: "block",
            defining: true
        },
        blockquote: {
            content: "block+",
            group: "block",
            defining: true
        },
        bulletList: {
            content: "listItem+",
            group: "block"
        },
        orderedList: {
            attrs: {
                start: {
                    default: 1
                },
                type: {
                    default: null
                }
            },
            content: "listItem+",
            group: "block"
        },
        listItem: {
            content: "paragraph block*",
            defining: true
        },
        codeBlock: {
            content: "text*",
            marks: "",
            group: "block",
            code: true,
            defining: true
        },
        horizontalRule: {
            group: "block"
        },
        hardBreak: {
            inline: true,
            group: "inline",
            selectable: false
        }
    },
    marks: {
        bold: {},
        italic: {},
        underline: {},
        strike: {},
        code: {
            code: true
        },
        link: {
            attrs: {
                href: {
                    default: null
                },
                target: {
                    default: null
                },
                rel: {
                    default: null
                },
                class: {
                    default: null
                }
            },
            inclusive: false
        }
    }
})

const isUsableEncodedState = (state) => {
    return Boolean(state && state.length > MIN_PERSISTABLE_STATE_BYTES)
}

const hasDocumentContent = (ydoc) => {
    return ydoc.getXmlFragment(YJS_FRAGMENT_FIELD).length > 0
}

const encodeYDoc = (ydoc) => Buffer.from(Y.encodeStateAsUpdate(ydoc))

const isPersistableYDocState = (ydoc, encodedState) => {
    return isUsableEncodedState(encodedState) && hasDocumentContent(ydoc)
}

const normalizeContentJson = (contentJson, content = "") => {
    if (contentJson?.type === "doc" && Array.isArray(contentJson.content)) {
        return contentJson
    }

    const lines = content ? String(content).split("\n") : [""]

    return {
        type: "doc",
        content: lines.map((line) => ({
            type: "paragraph",
            content: line
                ? [
                    {
                        type: "text",
                        text: line
                    }
                ]
                : undefined
        }))
    }
}

const createYDocFromNoteContent = (note) => {
    const ydoc = new Y.Doc()
    const originalClientId = ydoc.clientID
    const contentJson = normalizeContentJson(note.contentJson, note.content)

    ydoc.clientID = BOOTSTRAP_CLIENT_ID

    try {
        prosemirrorJSONToYXmlFragment(
            noteContentSchema,
            contentJson,
            ydoc.getXmlFragment(YJS_FRAGMENT_FIELD)
        )
    } finally {
        ydoc.clientID = originalClientId
    }

    return ydoc
}

const createEntry = (noteId, ydoc, lastPersistedState = null) => ({
    noteId,
    ydoc,
    lastPersistedState
})

const persistYDocState = async (entry) => {
    const encodedState = encodeYDoc(entry.ydoc)

    if (!isPersistableYDocState(entry.ydoc, encodedState)) {
        return false
    }

    if (entry.lastPersistedState?.equals(encodedState)) {
        return false
    }

    const yjsStateUpdatedAt = new Date()

    await Note.updateOne(
        { _id: entry.noteId },
        {
            $set: {
                yjsState: encodedState,
                yjsStateUpdatedAt
            }
        },
        {
            runValidators: true
        }
    )

    entry.lastPersistedState = encodedState
    return true
}

const loadYDocEntry = async (note) => {
    const noteId = String(note._id)
    const storedState = note.yjsState

    if (isUsableEncodedState(storedState)) {
        const ydoc = new Y.Doc()
        const storedBuffer = Buffer.from(storedState)

        Y.applyUpdate(ydoc, new Uint8Array(storedBuffer))

        const entry = createEntry(noteId, ydoc, storedBuffer)
        activeYjsDocs.set(noteId, entry)
        return entry
    }

    const ydoc = createYDocFromNoteContent(note)
    const entry = createEntry(noteId, ydoc)
    const encodedState = encodeYDoc(ydoc)

    if (!isPersistableYDocState(ydoc, encodedState)) {
        activeYjsDocs.set(noteId, entry)
        return entry
    }

    const yjsStateUpdatedAt = new Date()
    const bootstrappedNote = await Note.findOneAndUpdate(
        {
            _id: noteId,
            $or: [
                { yjsState: null },
                { yjsState: { $exists: false } }
            ]
        },
        {
            $set: {
                yjsState: encodedState,
                yjsStateUpdatedAt
            }
        },
        {
            new: true,
            runValidators: true
        }
    )

    if (bootstrappedNote) {
        entry.lastPersistedState = encodedState
        activeYjsDocs.set(noteId, entry)
        return entry
    }

    const refreshedNote = await Note.findById(noteId)

    if (refreshedNote?.yjsState && isUsableEncodedState(refreshedNote.yjsState)) {
        const refreshedYDoc = new Y.Doc()
        const refreshedState = Buffer.from(refreshedNote.yjsState)

        Y.applyUpdate(refreshedYDoc, new Uint8Array(refreshedState))

        const refreshedEntry = createEntry(noteId, refreshedYDoc, refreshedState)
        activeYjsDocs.set(noteId, refreshedEntry)
        return refreshedEntry
    }

    activeYjsDocs.set(noteId, entry)
    return entry
}

const getAuthoritativeYDocEntry = async (note) => {
    const noteId = String(note._id)
    const activeEntry = activeYjsDocs.get(noteId)

    if (activeEntry) {
        return activeEntry
    }

    const loadingEntry = loadingYjsDocs.get(noteId)

    if (loadingEntry) {
        return loadingEntry
    }

    const loadPromise = loadYDocEntry(note).finally(() => {
        loadingYjsDocs.delete(noteId)
    })

    loadingYjsDocs.set(noteId, loadPromise)
    return loadPromise
}

const normalizeYjsUpdate = (update) => {
    if (!update) {
        return null
    }

    if (Buffer.isBuffer(update)) {
        return new Uint8Array(update)
    }

    if (update instanceof ArrayBuffer) {
        return new Uint8Array(update)
    }

    if (ArrayBuffer.isView(update)) {
        return new Uint8Array(update.buffer, update.byteOffset, update.byteLength)
    }

    if (Array.isArray(update)) {
        return Uint8Array.from(update)
    }

    return null
}

const applyAndPersistYjsUpdate = async (note, update) => {
    const updateBuffer = normalizeYjsUpdate(update)

    if (!updateBuffer?.byteLength) {
        return {
            persisted: false,
            reason: "empty-update"
        }
    }

    const entry = await getAuthoritativeYDocEntry(note)

    Y.applyUpdate(entry.ydoc, updateBuffer)

    return {
        persisted: await persistYDocState(entry),
        reason: "ok"
    }
}

const getEncodedYjsState = async (note) => {
    const entry = await getAuthoritativeYDocEntry(note)
    const encodedState = encodeYDoc(entry.ydoc)

    if (!isPersistableYDocState(entry.ydoc, encodedState)) {
        return null
    }

    return encodedState
}

const releaseAuthoritativeYDoc = (noteId) => {
    activeYjsDocs.delete(String(noteId))
    loadingYjsDocs.delete(String(noteId))
}

export {
    applyAndPersistYjsUpdate,
    getAuthoritativeYDocEntry,
    getEncodedYjsState,
    releaseAuthoritativeYDoc
}
