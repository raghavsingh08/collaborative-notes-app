import React from 'react';

const iconProps = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
};

const IconBold = () => <svg {...iconProps}><path d="M14 12a4 4 0 0 0 0-8H6v8" /><path d="M15 20a4 4 0 0 0 0-8H6v8Z" /></svg>;
const IconItalic = () => <svg {...iconProps}><line x1="19" y1="4" x2="10" y2="4" /><line x1="14" y1="20" x2="5" y2="20" /><line x1="15" y1="4" x2="9" y2="20" /></svg>;
const IconUnderline = () => <svg {...iconProps}><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3" /><line x1="4" y1="21" x2="20" y2="21" /></svg>;
const IconH1 = () => <svg {...iconProps}><path d="M4 12h8" /><path d="M4 18V6" /><path d="M12 18V6" /><path d="M17 12l3-2v8" /></svg>;
const IconH2 = () => <svg {...iconProps}><path d="M4 12h8" /><path d="M4 18V6" /><path d="M12 18V6" /><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1" /></svg>;
const IconBulletList = () => <svg {...iconProps}><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>;
const IconOrderedList = () => <svg {...iconProps}><line x1="10" y1="6" x2="21" y2="6" /><line x1="10" y1="12" x2="21" y2="12" /><line x1="10" y1="18" x2="21" y2="18" /><path d="M4 6h1v4" /><path d="M4 10h2" /><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" /></svg>;
const IconQuote = () => <svg {...iconProps}><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" /><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" /></svg>;
const IconUndo = () => <svg {...iconProps}><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>;
const IconRedo = () => <svg {...iconProps}><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" /></svg>;

export default function EditorToolbar({ editor }) {
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);

    React.useEffect(() => {
        if (!editor) return;
        const update = () => forceUpdate();
        editor.on('transaction', update);
        return () => {
            editor.off('transaction', update);
        };
    }, [editor]);

    if (!editor) {
        return null;
    }

    return (
        <div className="editor-formatting-toolbar" aria-label="Formatting options">
            <div className="toolbar-group">
                <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    disabled={!editor.can().chain().focus().toggleBold().run()}
                    className={`format-button ${editor.isActive('bold') ? 'is-active' : ''}`}
                    title="Bold"
                >
                    <IconBold />
                </button>
                <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    disabled={!editor.can().chain().focus().toggleItalic().run()}
                    className={`format-button ${editor.isActive('italic') ? 'is-active' : ''}`}
                    title="Italic"
                >
                    <IconItalic />
                </button>
                <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    disabled={!editor.can().chain().focus().toggleUnderline().run()}
                    className={`format-button ${editor.isActive('underline') ? 'is-active' : ''}`}
                    title="Underline"
                >
                    <IconUnderline />
                </button>
            </div>

            <div className="toolbar-divider" aria-hidden="true" />

            <div className="toolbar-group">
                <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    className={`format-button ${editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}`}
                    title="Heading 1"
                >
                    <IconH1 />
                </button>
                <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={`format-button ${editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}`}
                    title="Heading 2"
                >
                    <IconH2 />
                </button>
            </div>

            <div className="toolbar-divider" aria-hidden="true" />

            <div className="toolbar-group">
                <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={`format-button ${editor.isActive('bulletList') ? 'is-active' : ''}`}
                    title="Bullet List"
                >
                    <IconBulletList />
                </button>
                <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={`format-button ${editor.isActive('orderedList') ? 'is-active' : ''}`}
                    title="Ordered List"
                >
                    <IconOrderedList />
                </button>
                <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                        let chain = editor.chain().focus();
                        if (editor.isActive('bulletList')) {
                            chain = chain.toggleBulletList();
                        } else if (editor.isActive('orderedList')) {
                            chain = chain.toggleOrderedList();
                        }
                        chain.toggleBlockquote().run();
                    }}
                    className={`format-button ${editor.isActive('blockquote') ? 'is-active' : ''}`}
                    title="Blockquote"
                >
                    <IconQuote />
                </button>
            </div>

            <div className="toolbar-divider" aria-hidden="true" />

            <div className="toolbar-group">
                <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().chain().focus().undo().run()}
                    className="format-button"
                    title="Undo"
                >
                    <IconUndo />
                </button>
                <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().chain().focus().redo().run()}
                    className="format-button"
                    title="Redo"
                >
                    <IconRedo />
                </button>
            </div>
        </div>
    );
}
