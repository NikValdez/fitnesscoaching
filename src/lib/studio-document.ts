import * as Y from 'yjs'
import { getSchema } from '@tiptap/react'
import {
  prosemirrorJSONToYDoc,
  prosemirrorJSONToYXmlFragment,
  yDocToProsemirrorJSON,
} from '@tiptap/y-tiptap'
import { scratchExtensions } from './scratch-extensions'
import { padDocument, richTextPlainText, validRichDocument } from './rich-text'
import { scratchPadLimit } from './scratch-validation'

const schema = getSchema(scratchExtensions())
export type StudioDocumentField = 'default' | 'todo'

// Seed once on the server so admins opening an empty list together don't each
// insert their own first checkbox. Existing scratch-pad snapshots stay intact.
export function ensureStudioTodo(doc: Y.Doc) {
  if (doc.share.has('todo')) return false
  prosemirrorJSONToYXmlFragment(
    schema,
    {
      type: 'doc',
      content: [
        {
          type: 'taskList',
          content: [
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] },
          ],
        },
      ],
    },
    doc.getXmlFragment('todo'),
  )
  return true
}

export function seedStudioDocument(pad: { body: string; document: string | null }) {
  const doc = prosemirrorJSONToYDoc(schema, JSON.parse(padDocument(pad)), 'default')
  ensureStudioTodo(doc)
  return doc
}

export function readStudioDocument(doc: Y.Doc, field: StudioDocumentField = 'default') {
  if (
    !doc.share.has('default') ||
    [...doc.share.keys()].some((key) => key !== 'default' && key !== 'todo')
  )
    throw new Error('Unsupported formatting.')

  // Check both fields before accepting any update, including changes sent by
  // older tabs that still edit only the scratch pad.
  const read = (key: StudioDocumentField) => {
    const document = yDocToProsemirrorJSON(doc, key)
    if (!validRichDocument(document)) throw new Error('Unsupported formatting.')
    schema.nodeFromJSON(document).check()
    const body = richTextPlainText(document)
    if (body.length > scratchPadLimit || JSON.stringify(document).length > 1000000) {
      throw new Error(
        key === 'todo'
          ? 'The to-do list has reached its size limit.'
          : 'The scratch pad has reached its size limit.',
      )
    }
    return { document, body }
  }
  const pad = read('default')
  const todo = doc.share.has('todo') ? read('todo') : undefined
  if (field === 'todo') {
    if (!todo) throw new Error('The to-do list is not initialized.')
    return todo
  }
  return pad
}

// Validate in isolation before accepting an update into the shared document.
export function mergeStudioUpdate(current: Y.Doc, update: Uint8Array) {
  const next = new Y.Doc()
  try {
    Y.applyUpdate(next, Y.encodeStateAsUpdate(current))
    Y.applyUpdate(next, update)
    readStudioDocument(next)
    return next
  } catch (error) {
    next.destroy()
    throw error
  }
}
