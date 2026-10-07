import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import {
  seedStudioDocument,
  readStudioDocument,
  mergeStudioUpdate,
  ensureStudioTodo,
} from '../src/lib/studio-document'
import { getSchema } from '@tiptap/react'
import { prosemirrorJSONToYDoc } from '@tiptap/y-tiptap'
import { scratchExtensions } from '../src/lib/scratch-extensions'
import { plainTextDocument } from '../src/lib/rich-text'
import { scratchPadLimit } from '../src/lib/scratch-validation'

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
  it('adds a single empty checklist to legacy snapshots without changing existing ideas', () => {
    const legacy = prosemirrorJSONToYDoc(
      getSchema(scratchExtensions()),
      plainTextDocument('An existing idea'),
      'default',
    )
    expect(readStudioDocument(legacy).body).toBe('An existing idea')
    expect(ensureStudioTodo(legacy)).toBe(true)
    const todo = readStudioDocument(legacy, 'todo')
    expect(todo.body).toBe('')
    expect(todo.document.content).toMatchObject([
      { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false } }] },
    ])
    expect(ensureStudioTodo(legacy)).toBe(false)
    expect(readStudioDocument(legacy, 'todo')).toEqual(todo)
    expect(readStudioDocument(legacy).body).toBe('An existing idea')
  })
  it('merges checkbox completion with concurrent task text and preserves it after restoration', () => {
    const shared = seedStudioDocument({ body: 'Leave this idea alone', document: null })
    const task = (doc: Y.Doc) =>
      (doc.getXmlFragment('todo').get(0) as Y.XmlElement).get(0) as Y.XmlElement<{
        checked: boolean
      }>
    const paragraph = task(shared).get(0) as Y.XmlElement
    const taskText = new Y.XmlText()
    paragraph.insert(0, [taskText])
    taskText.insert(0, 'Film a reel')
    const alice = clone(shared),
      bob = clone(shared)
    const vector = Y.encodeStateVector(shared)
    task(alice).setAttribute('checked', true)
    ;((task(bob).get(0) as Y.XmlElement).get(0) as Y.XmlText).insert(11, ' tomorrow')
    const merged = mergeStudioUpdate(
      mergeStudioUpdate(shared, Y.encodeStateAsUpdate(alice, vector)),
      Y.encodeStateAsUpdate(bob, vector),
    )
    const restored = clone(merged)
    expect(readStudioDocument(restored).body).toBe('Leave this idea alone')
    expect(readStudioDocument(restored, 'todo').body).toBe('Film a reel tomorrow')
    expect(readStudioDocument(restored, 'todo').document.content?.[0].content?.[0].attrs).toEqual({
      checked: true,
    })
  })
  it('validates both documents and rejects unexpected fields and oversized tasks', () => {
    const shared = seedStudioDocument({ body: 'Keep this', document: null })
    for (const field of ['default', 'todo']) {
      const invalid = clone(shared)
      invalid.getXmlFragment(field).insert(0, [new Y.XmlElement('script')])
      expect(() => mergeStudioUpdate(shared, Y.encodeStateAsUpdate(invalid))).toThrow()
    }
    const unexpected = clone(shared)
    unexpected.getMap('extra').set('text', 'Unexpected')
    expect(() => mergeStudioUpdate(shared, Y.encodeStateAsUpdate(unexpected))).toThrow()
    const oversized = clone(shared)
    const task = (oversized.getXmlFragment('todo').get(0) as Y.XmlElement).get(0) as Y.XmlElement
    const paragraph = task.get(0) as Y.XmlElement
    const text = new Y.XmlText()
    paragraph.insert(0, [text])
    text.insert(0, 'x'.repeat(scratchPadLimit + 1))
    expect(() => mergeStudioUpdate(shared, Y.encodeStateAsUpdate(oversized))).toThrow(
      'The to-do list has reached its size limit.',
    )
    expect(readStudioDocument(shared).body).toBe('Keep this')
    expect(readStudioDocument(shared, 'todo').body).toBe('')
  })
})
