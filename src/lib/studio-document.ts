import * as Y from 'yjs'
import { getSchema } from '@tiptap/react'
import { prosemirrorJSONToYDoc, yDocToProsemirrorJSON } from '@tiptap/y-tiptap'
import { scratchExtensions } from './scratch-extensions'
import { padDocument, richTextPlainText, validRichDocument } from './rich-text'
import { scratchPadLimit } from './scratch-validation'

const schema = getSchema(scratchExtensions())

export function seedStudioDocument(pad: { body: string; document: string | null }) {
  return prosemirrorJSONToYDoc(schema, JSON.parse(padDocument(pad)), 'default')
}

export function readStudioDocument(doc: Y.Doc) {
  const document = yDocToProsemirrorJSON(doc, 'default')
  if (!validRichDocument(document) || doc.share.size !== 1)
    throw new Error('Unsupported formatting.')
  schema.nodeFromJSON(document).check()
  const body = richTextPlainText(document)
  if (body.length > scratchPadLimit || JSON.stringify(document).length > 1000000) {
    throw new Error('The scratch pad has reached its size limit.')
  }
  return { document, body }
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
