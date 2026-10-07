import StarterKit from '@tiptap/starter-kit'
import LinkExtension from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import { TaskList, TaskItem } from '@tiptap/extension-list'
import { safeLink } from './rich-text'

const ScratchLink = LinkExtension.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      target: { default: '_blank', parseHTML: () => '_blank' },
      rel: {
        default: 'noopener noreferrer nofollow',
        parseHTML: () => 'noopener noreferrer nofollow',
      },
      class: { default: null, parseHTML: () => null },
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute('title')?.slice(0, 160) ?? null,
      },
    }
  },
})

export function scratchExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      trailingNode: false,
      link: false,
      undoRedo: false,
    }),
    ScratchLink.configure({
      openOnClick: false,
      defaultProtocol: 'https',
      isAllowedUri: safeLink,
      HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
    }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
      alignments: ['left', 'center', 'right'],
    }),
    Highlight,
    TaskList,
    TaskItem.configure({ nested: true, HTMLAttributes: { 'data-type': 'taskItem' } }),
  ]
}
