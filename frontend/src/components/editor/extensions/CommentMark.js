import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export const CommentMark = Mark.create({
  name: 'commentMark',

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'comment-highlight',
        style: 'background-color: rgba(250, 204, 21, 0.2); border-bottom: 2px solid rgba(250, 204, 21, 0.5); cursor: pointer; transition: background-color 0.2s;'
      },
      onCommentClicked: null,
    };
  },

  addAttributes() {
    return {
      anchorId: {
        default: null,
        parseHTML: element => element.getAttribute('data-comment-id'),
        renderHTML: attributes => {
          if (!attributes.anchorId) {
            return {};
          }
          return {
            'data-comment-id': attributes.anchorId,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-comment-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setCommentMark: anchorId => ({ commands }) => {
        return commands.setMark(this.name, { anchorId });
      },
      unsetCommentMark: anchorId => ({ tr, dispatch }) => {
         if (dispatch) {
            tr.doc.descendants((node, pos) => {
              if (node.isText && node.marks) {
                const mark = node.marks.find(m => m.type.name === this.name && m.attrs.anchorId === anchorId);
                if (mark) {
                  tr.removeMark(pos, pos + node.nodeSize, mark);
                }
              }
            });
         }
         return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const { onCommentClicked } = this.options;
    
    return [
      new Plugin({
        key: new PluginKey('commentClickHandler'),
        props: {
          handleClick(view, pos, event) {
            const { doc } = view.state;
            const $pos = doc.resolve(pos);
            const marks = $pos.marks();
            
            const commentMark = marks.find(mark => mark.type.name === 'commentMark');
            if (commentMark && commentMark.attrs.anchorId) {
              if (onCommentClicked) {
                onCommentClicked(commentMark.attrs.anchorId);
                // Return true to stop propagation if desired, but returning false 
                // allows selection to still place the cursor normally.
              }
            }
            return false;
          },
        },
      }),
    ];
  },
});
