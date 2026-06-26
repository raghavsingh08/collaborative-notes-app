import React, { useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import EditorToolbar from './EditorToolbar';
import { CommentMark } from './extensions/CommentMark';

const TipTapEditor = forwardRef(({ initialContent, initialContentJson, onUpdate, hasLoaded, ydoc, awareness, syncStatus, onSelectionChange, onCommentClicked }, ref) => {
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
            }),
            CommentMark.configure({
                onCommentClicked: (anchorId) => {
                    if (onCommentClicked) onCommentClicked(anchorId)
                }
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
        onSelectionUpdate: ({ editor }) => {
            if (onSelectionChange) {
                const { state } = editor
                const { from, to, empty } = state.selection
                if (empty) {
                    onSelectionChange(null)
                    return
                }
                const selectedText = state.doc.textBetween(from, to, ' ')
                const hasExistingComment = editor.isActive('commentMark')
                onSelectionChange({ selectedText, from, to, hasExistingComment })
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
        setCommentMark: (anchorId) => {
            if (editor) editor.commands.setCommentMark(anchorId)
        },
        unsetCommentMark: (anchorId) => {
            if (editor) editor.commands.unsetCommentMark(anchorId)
        },
        scrollToComment: (anchorId) => {
            if (!editor) return
            const view = editor.view
            let pos = null
            view.state.doc.descendants((node, p) => {
                if (node.isText && node.marks) {
                    const mark = node.marks.find(m => m.type.name === 'commentMark' && m.attrs.anchorId === anchorId)
                    if (mark && pos === null) {
                        pos = p
                    }
                }
            })
            if (pos !== null) {
                // Flash the highlight briefly if possible, then scroll to it
                const dom = view.nodeDOM(pos)
                if (dom && dom.scrollIntoView) {
                    dom.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    // Optional: Brief highlight flash using native dom
                    if (dom.style) {
                        const original = dom.style.backgroundColor
                        dom.style.backgroundColor = 'rgba(250, 204, 21, 0.6)'
                        setTimeout(() => dom.style.backgroundColor = original, 1000)
                    }
                }
            }
        }
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
