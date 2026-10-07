import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import {
  seedStudioDocument,
  readStudioDocument,
  mergeStudioUpdate,
} from '../src/lib/studio-document'

function clone(doc: Y.Doc) {
  const copy = new Y.Doc()
  Y.applyUpdate(copy, Y.encodeStateAsUpdate(doc))
  return copy
}
const text = (doc: Y.Doc) =>
  (doc.getXmlFragment('default').get(0) as Y.XmlElement).get(0) as Y.XmlText

describe('shared studio CRDT', () => {
  it('merges concurrent edits and formatting at the same position in either order', () => {
    const original = seedStudioDocument({ body: 'A shared idea', document: null })
    const alice = clone(original),
      bob = clone(original)
    const vector = Y.encodeStateVector(original)
    text(alice).insert(2, 'great ')
    text(bob).insert(2, 'new ')
    text(alice).format(0, 1, { bold: {} })
    const left = mergeStudioUpdate(
      mergeStudioUpdate(original, Y.encodeStateAsUpdate(alice, vector)),
      Y.encodeStateAsUpdate(bob, vector),
    )
    const right = mergeStudioUpdate(
      mergeStudioUpdate(original, Y.encodeStateAsUpdate(bob, vector)),
      Y.encodeStateAsUpdate(alice, vector),
    )
    expect(readStudioDocument(left)).toEqual(readStudioDocument(right))
    expect(readStudioDocument(left).body).toContain('great ')
    expect(readStudioDocument(left).body).toContain('new ')
    expect(JSON.stringify(readStudioDocument(left).document)).toContain('bold')
  })
  it('merges offline differences, tolerates retries, and restores the exact binary document', () => {
    const shared = seedStudioDocument({ body: 'First', document: null })
    const offline = clone(shared)
    text(offline).insert(5, ' offline')
    text(shared).insert(0, 'Online ')
    const difference = Y.encodeStateAsUpdate(offline, Y.encodeStateVector(shared))
    const merged = mergeStudioUpdate(shared, difference)
    const retried = mergeStudioUpdate(merged, difference)
    expect(readStudioDocument(retried).body).toBe('Online First offline')
    expect(readStudioDocument(clone(retried))).toEqual(readStudioDocument(retried))
  })
  it('rejects invalid rich text without changing the shared document', () => {
    const shared = seedStudioDocument({ body: 'Keep this', document: null })
    const invalid = clone(shared)
    invalid.getXmlFragment('default').insert(1, [new Y.XmlElement('script')])
    expect(() => mergeStudioUpdate(shared, Y.encodeStateAsUpdate(invalid))).toThrow()
    expect(readStudioDocument(shared).body).toBe('Keep this')
  })
})
