import NoteVersion from "../models/noteVersion.model.js"

const MAX_NOTE_VERSIONS = 20

const normalizeBuffer = (value) => {
    if (!value) {
        return null
    }

    return Buffer.from(value)
}

const stableStringify = (value) => {
    if (value === undefined || value === null) {
        return "null"
    }

    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(",")}]`
    }

    if (typeof value === "object") {
        return `{${Object.keys(value).sort().map((key) =>
            `${JSON.stringify(key)}:${stableStringify(value[key])}`
        ).join(",")}}`
    }

    return JSON.stringify(value)
}

const buffersEqual = (a, b) => {
    const left = normalizeBuffer(a)
    const right = normalizeBuffer(b)

    if (!left && !right) {
        return true
    }

    if (!left || !right) {
        return false
    }

    return left.equals(right)
}

const snapshotMatchesNote = (version, note) => {
    return version.title === (note.title || "") &&
        version.content === (note.content || "") &&
        stableStringify(version.contentJson) === stableStringify(note.contentJson) &&
        buffersEqual(version.yjsState, note.yjsState)
}

const pruneNoteVersions = async (noteId) => {
    const versionsToDelete = await NoteVersion.find({ noteId })
        .sort({ createdAt: -1 })
        .skip(MAX_NOTE_VERSIONS)
        .select("_id")

    if (versionsToDelete.length === 0) {
        return
    }

    await NoteVersion.deleteMany({
        _id: {
            $in: versionsToDelete.map((version) => version._id)
        }
    })
}

const createNoteVersionSnapshot = async ({
    note,
    createdBy,
    reason = "manual_save",
    skipIfDuplicate = true
}) => {
    const latestVersion = skipIfDuplicate
        ? await NoteVersion.findOne({ noteId: note._id }).sort({ createdAt: -1 })
        : null

    if (latestVersion && snapshotMatchesNote(latestVersion, note)) {
        return {
            created: false,
            version: latestVersion
        }
    }

    const version = await NoteVersion.create({
        noteId: note._id,
        title: note.title || "",
        content: note.content || "",
        contentJson: note.contentJson ?? null,
        yjsState: normalizeBuffer(note.yjsState),
        createdBy,
        reason
    })

    await pruneNoteVersions(note._id)

    return {
        created: true,
        version
    }
}

export {
    MAX_NOTE_VERSIONS,
    createNoteVersionSnapshot,
    pruneNoteVersions
}
