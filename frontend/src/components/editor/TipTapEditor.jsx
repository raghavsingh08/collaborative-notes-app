import React, { useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import EditorToolbar from './EditorToolbar';

const TipTapEditor = forwardRef(({ initialContent, initialContentJson, onUpdate, hasLoaded, ydoc, awareness, syncStatus }, ref) => {
    const hasInitializedYdoc = useRef(false);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                undoRedo: false // Disable default undo/redo due to Yjs conflict. TipTap Collaboration provides its own history API.
            }),
            Collaboration.configure({
                document: ydoc,
            }),
            CollaborationCaret.configure({
                provider: { awareness }
            })
        ],
        onUpdate: ({ editor }) => {
            if (onUpdate && !window.isInitializingYdoc && !window.isApplyingRemoteSync) {
                onUpdate({
                    content: editor.getText(),
                    contentJson: editor.getJSON(),
                });
            }
        },
        editorProps: {
            attributes: {
                class: 'content-editor',
                'aria-label': 'Note content',
            },
        },
    });

    useImperativeHandle(ref, () => ({
        getText: () => editor ? editor.getText() : initialContent,
        getJSON: () => editor ? editor.getJSON() : initialContentJson,
        getEditor: () => editor,
    }));

    useEffect(() => {
        if (editor && hasLoaded && syncStatus?.isComplete && ydoc && !editor.isDestroyed && !hasInitializedYdoc.current) {
            hasInitializedYdoc.current = true;

            // If the backend provided an authoritative Y.Doc state, it was already applied
            // to our local Y.Doc by the CollaborationProvider. We must NOT initialize from JSON.
            if (!syncStatus.useFallbackJson) {
                // EXPLICITLY CLEAR FLAGS so local update listeners are unblocked and can broadcast!
                window.isInitializingYdoc = false;
                window.isApplyingRemoteSync = false;
                return;
            }

            window.isInitializingYdoc = true;
            const originalClientId = ydoc.clientID;
            
            // Force a deterministic CRDT client ID so multiple browsers loading the same JSON 
            // from the REST API will generate the exact same base Yjs item signatures.
            // This prevents silent Yjs update buffering due to divergent CRDT histories.
            ydoc.clientID = 1;

            try {
                if (initialContentJson) {
                    editor.commands.setContent(initialContentJson, false);
                } else {
                    const htmlContent = initialContent
                        ? initialContent.split('\n').map(line => `<p>${line}</p>`).join('')
                        : '<p></p>';
                    editor.commands.setContent(htmlContent, false);
                }
            } finally {
                ydoc.clientID = originalClientId;
                window.isInitializingYdoc = false;
            }
        }
    }, [editor, hasLoaded, initialContent, initialContentJson, ydoc, syncStatus]);

    return (
        <>
            <EditorToolbar editor={editor} />
            <EditorContent editor={editor} />
        </>
    );
});

export default TipTapEditor;
