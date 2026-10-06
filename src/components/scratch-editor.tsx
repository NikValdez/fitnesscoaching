import { useEffect, useRef, useState, type ReactNode } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import LinkExtension from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import { TaskList, TaskItem } from '@tiptap/extension-list'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Code,
  SquareCode,
  Highlighter,
  Link,
  Minus,
  Undo2,
  Redo2,
  RemoveFormatting,
  X,
} from 'lucide-react'
import { scratchPadLimit } from '../lib/scratch-validation'
import { safeLink } from '../lib/rich-text'

// Pasted links use the same safe attributes as links created by the toolbar.
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

export function ScratchEditor({
  value,
  onChange,
  onSave,
}: {
  value: string
  onChange: (document: string) => void
  onSave: () => void
}) {
  const callbacks = useRef({ onChange, onSave })
  callbacks.current = { onChange, onSave }
  const [linkOpen, setLinkOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [linkError, setLinkError] = useState('')
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        trailingNode: false,
        link: false,
      }),
      ScratchLink.configure({
        openOnClick: false,
        defaultProtocol: 'https',
        isAllowedUri: (url) => safeLink(url),
        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right'],
      }),
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true, HTMLAttributes: { 'data-type': 'taskItem' } }),
      Placeholder.configure({
        placeholder:
          'An idea for a reel… A question clients keep asking… Something worth coming back to…',
      }),
      CharacterCount.configure({ limit: scratchPadLimit }),
    ],
    content: JSON.parse(value),
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-label': 'Your idea',
        'aria-multiline': 'true',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor }) => callbacks.current.onChange(JSON.stringify(editor.getJSON())),
    onBlur: () => callbacks.current.onSave(),
  })

  useEffect(() => {
    if (editor && JSON.stringify(editor.getJSON()) !== value) {
      editor.commands.setContent(JSON.parse(value), { emitUpdate: false })
    }
  }, [editor, value])

  function tool(
    label: string,
    icon: ReactNode,
    action: () => void,
    active?: boolean,
    disabled = false,
  ) {
    return (
      <button
        type="button"
        className="scratch-tool"
        aria-label={label}
        title={label}
        aria-pressed={active}
        disabled={!editor || disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={action}
      >
        {icon}
      </button>
    )
  }

  return (
    <div
      className="scratch-editor"
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
          event.preventDefault()
          onSave()
        }
      }}
    >
      <div className="scratch-toolbar" role="group" aria-label="Text formatting">
        <select
          aria-label="Text style"
          disabled={!editor}
          value={
            editor?.isActive('heading') ? `h${editor.getAttributes('heading').level}` : 'paragraph'
          }
          onChange={(event) =>
            event.target.value === 'paragraph'
              ? editor?.chain().focus().setParagraph().run()
              : editor
                  ?.chain()
                  .focus()
                  .setHeading({ level: Number(event.target.value.slice(1)) as 1 | 2 | 3 })
                  .run()
          }
        >
          <option value="paragraph">Normal text</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>
        <div className="scratch-tool-group">
          {tool(
            'Bold',
            <Bold size={17} />,
            () => editor?.chain().focus().toggleBold().run(),
            editor?.isActive('bold'),
          )}
          {tool(
            'Italic',
            <Italic size={17} />,
            () => editor?.chain().focus().toggleItalic().run(),
            editor?.isActive('italic'),
          )}
          {tool(
            'Underline',
            <Underline size={17} />,
            () => editor?.chain().focus().toggleUnderline().run(),
            editor?.isActive('underline'),
          )}
          {tool(
            'Strikethrough',
            <Strikethrough size={17} />,
            () => editor?.chain().focus().toggleStrike().run(),
            editor?.isActive('strike'),
          )}
          {tool(
            'Highlight',
            <Highlighter size={17} />,
            () => editor?.chain().focus().toggleHighlight().run(),
            editor?.isActive('highlight'),
          )}
        </div>
        <div className="scratch-tool-group">
          {tool(
            'Bullet list',
            <List size={17} />,
            () => editor?.chain().focus().toggleBulletList().run(),
            editor?.isActive('bulletList'),
          )}
          {tool(
            'Numbered list',
            <ListOrdered size={17} />,
            () => editor?.chain().focus().toggleOrderedList().run(),
            editor?.isActive('orderedList'),
          )}
          {tool(
            'Checklist',
            <ListTodo size={17} />,
            () => editor?.chain().focus().toggleTaskList().run(),
            editor?.isActive('taskList'),
          )}
          {tool(
            'Quote',
            <Quote size={17} />,
            () => editor?.chain().focus().toggleBlockquote().run(),
            editor?.isActive('blockquote'),
          )}
        </div>
        <div className="scratch-tool-group">
          {tool(
            'Align left',
            <AlignLeft size={17} />,
            () => editor?.chain().focus().setTextAlign('left').run(),
            editor?.isActive({ textAlign: 'left' }),
          )}
          {tool(
            'Align center',
            <AlignCenter size={17} />,
            () => editor?.chain().focus().setTextAlign('center').run(),
            editor?.isActive({ textAlign: 'center' }),
          )}
          {tool(
            'Align right',
            <AlignRight size={17} />,
            () => editor?.chain().focus().setTextAlign('right').run(),
            editor?.isActive({ textAlign: 'right' }),
          )}
        </div>
        <div className="scratch-tool-group">
          {tool(
            'Add or edit link',
            <Link size={17} />,
            () => {
              setUrl(editor?.getAttributes('link').href ?? '')
              setLinkError('')
              setLinkOpen(true)
            },
            editor?.isActive('link'),
          )}
          {tool(
            'Inline code',
            <Code size={17} />,
            () => editor?.chain().focus().toggleCode().run(),
            editor?.isActive('code'),
          )}
          {tool(
            'Code block',
            <SquareCode size={17} />,
            () => editor?.chain().focus().toggleCodeBlock().run(),
            editor?.isActive('codeBlock'),
          )}
          {tool('Divider', <Minus size={17} />, () =>
            editor?.chain().focus().setHorizontalRule().run(),
          )}
          {tool('Clear formatting', <RemoveFormatting size={17} />, () =>
            editor?.chain().focus().unsetAllMarks().clearNodes().unsetTextAlign().run(),
          )}
        </div>
        <div className="scratch-tool-group">
          {tool(
            'Undo',
            <Undo2 size={17} />,
            () => editor?.chain().focus().undo().run(),
            undefined,
            !editor?.can().undo(),
          )}
          {tool(
            'Redo',
            <Redo2 size={17} />,
            () => editor?.chain().focus().redo().run(),
            undefined,
            !editor?.can().redo(),
          )}
        </div>
      </div>
      {linkOpen && (
        <form
          className="scratch-link-form"
          onSubmit={(event) => {
            event.preventDefault()
            const href = /^(https?:|mailto:)/i.test(url.trim())
              ? url.trim()
              : `https://${url.trim()}`
            if (!safeLink(href) || !url.trim()) {
              setLinkError('Enter a valid website or mailto link.')
              return
            }
            const chain = editor?.chain().focus().extendMarkRange('link')
            if (editor?.state.selection.empty && !editor.isActive('link'))
              chain
                ?.insertContent({
                  type: 'text',
                  text: href,
                  marks: [{ type: 'link', attrs: { href } }],
                })
                .run()
            else chain?.setLink({ href }).run()
            setLinkOpen(false)
          }}
        >
          <label htmlFor="scratch-link">Link URL</label>
          <input
            id="scratch-link"
            autoFocus
            value={url}
            placeholder="https://…"
            onChange={(event) => setUrl(event.target.value)}
          />
          <button className="button" type="submit">
            Apply link
          </button>
          <button
            className="text-link"
            type="button"
            onClick={() => {
              editor?.chain().focus().extendMarkRange('link').unsetLink().run()
              setLinkOpen(false)
            }}
          >
            Remove link
          </button>
          <button
            className="scratch-tool"
            type="button"
            aria-label="Close link editor"
            onClick={() => {
              setLinkOpen(false)
              editor?.commands.focus()
            }}
          >
            <X size={17} />
          </button>
          {linkError && (
            <p className="form-error" role="alert">
              {linkError}
            </p>
          )}
        </form>
      )}
      <EditorContent editor={editor} />
      {!editor && <div className="scratch-editor-loading">Loading your scratch pad…</div>}
    </div>
  )
}
