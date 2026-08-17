import * as Y from "yjs"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import Note from "../../src/models/note.model.js"
import {
    applyAndPersistYjsUpdate,
    getAuthoritativeYDocEntry,
    releaseAuthoritativeYDoc
} from "../../src/utils/yjsNoteState.js"
import { createTestNote, createTestUser } from "../helpers/factories.js"
import { clearTestDB, closeTestDB, connectTestDB } from "../setup/testDb.js"

const trackedNoteIds = new Set()

const createDeferred = () => {
    let resolve

    const promise = new Promise((nextResolve) => {
        resolve = nextResolve
    })

    return { promise, resolve }
}

const createContentJson = (text) => ({
    type: "doc",
    content: [{
        type: "paragraph",
        content: [{
            type: "text",
            text
        }]
    }]
})

const createUpdate = (client, value) => {
    let update

    client.once("update", (nextUpdate) => {
        update = nextUpdate
    })
    client.getMap("persistence-regression").set("value", value)

    return update
}

const createActiveYjsNote = async () => {
    const owner = await createTestUser()
    const note = await createTestNote({
        owner,
        contentJson: createContentJson("Seed content")
    })
    const entry = await getAuthoritativeYDocEntry(note)
    const client = new Y.Doc()

    Y.applyUpdate(client, Y.encodeStateAsUpdate(entry.ydoc))
    trackedNoteIds.add(String(note._id))

    return { note, client }
}

beforeAll(async () => {
    await connectTestDB()
})

afterEach(async () => {
    await Promise.all(Array.from(trackedNoteIds, (noteId) => releaseAuthoritativeYDoc(noteId)))
    trackedNoteIds.clear()
    vi.restoreAllMocks()
    await clearTestDB()
})

afterAll(async () => {
    await closeTestDB()
})

describe("Yjs persistence ordering", () => {
    it("persists the newest accepted Yjs state when an earlier write is delayed", async () => {
        const { note, client } = await createActiveYjsNote()
        const originalUpdateOne = Note.updateOne.bind(Note)
        const firstWriteStarted = createDeferred()
        const releaseFirstWrite = createDeferred()
        let writeCount = 0

        vi.spyOn(Note, "updateOne").mockImplementation(async (...args) => {
            writeCount += 1

            if (writeCount === 1) {
                firstWriteStarted.resolve()
                await releaseFirstWrite.promise
            }

            return originalUpdateOne(...args)
        })

        const firstPersistence = applyAndPersistYjsUpdate(note, createUpdate(client, "S1"))
        await firstWriteStarted.promise

        const secondPersistence = applyAndPersistYjsUpdate(note, createUpdate(client, "S2"))
        releaseFirstWrite.resolve()

        await expect(Promise.all([firstPersistence, secondPersistence])).resolves.toEqual([
            { persisted: true, reason: "ok" },
            { persisted: true, reason: "ok" }
        ])

        const storedNote = await Note.findById(note._id)
        const restoredDoc = new Y.Doc()
        Y.applyUpdate(restoredDoc, new Uint8Array(storedNote.yjsState))

        expect(restoredDoc.getMap("persistence-regression").get("value")).toBe("S2")
    })

    it("continues persisting later updates after a failed write", async () => {
        const { note, client } = await createActiveYjsNote()
        const originalUpdateOne = Note.updateOne.bind(Note)
        let writeCount = 0

        vi.spyOn(console, "error").mockImplementation(() => {})
        vi.spyOn(Note, "updateOne").mockImplementation((...args) => {
            writeCount += 1

            if (writeCount === 1) {
                return Promise.reject(new Error("Simulated MongoDB write failure"))
            }

            return originalUpdateOne(...args)
        })

        await expect(
            applyAndPersistYjsUpdate(note, createUpdate(client, "S1"))
        ).rejects.toThrow("Simulated MongoDB write failure")

        await expect(
            applyAndPersistYjsUpdate(note, createUpdate(client, "S2"))
        ).resolves.toEqual({ persisted: true, reason: "ok" })

        const storedNote = await Note.findById(note._id)
        const restoredDoc = new Y.Doc()
        Y.applyUpdate(restoredDoc, new Uint8Array(storedNote.yjsState))

        expect(restoredDoc.getMap("persistence-regression").get("value")).toBe("S2")
    })
})