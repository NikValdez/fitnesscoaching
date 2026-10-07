import { useMemo } from 'react'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCaret from '@tiptap/extension-collaboration-caret'
import { RichTextEditor } from './rich-text-editor'
import { scratchPadLimit } from '../lib/scratch-validation'
import type { StudioProvider } from '../lib/studio-provider'
import type { StudioDocumentField } from '../lib/studio-document'

export type ScratchEditorProps = {
  provider: StudioProvider
  name: string
  editable?: boolean
  onChange: (document: string) => void
  onSave: () => void
}

export function ScratchEditor({
  provider,
  name,
  documentField = 'default',
  label = 'Your idea',
  placeholder = 'An idea for a reel… A question clients keep asking… Something worth coming back to…',
  ...props
}: ScratchEditorProps & {
  documentField?: StudioDocumentField
  label?: string
  placeholder?: string
}) {
  const extensions = useMemo(
    () => [
      Collaboration.configure({ document: provider.document, field: documentField }),
      CollaborationCaret.configure({
        provider,
        user: {
          name,
          color: ['#2b4a7d', '#92518b', '#337563', '#bd6b32'][provider.document.clientID % 4],
        },
      }),
    ],
    [provider, documentField, name],
  )
  return (
    <RichTextEditor
      {...props}
      extensions={extensions}
      collaborative
      characterLimit={scratchPadLimit}
      className={documentField === 'todo' ? 'todo-editor' : ''}
      label={label}
      placeholder={placeholder}
      loadingText={
        documentField === 'todo' ? 'Loading your to-do list…' : 'Loading your scratch pad…'
      }
    />
  )
}
