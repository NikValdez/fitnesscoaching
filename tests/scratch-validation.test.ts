import { describe, expect, it } from 'vitest'
import {
  saveScratchSchema,
  editScratchSchema,
  convertScratchSchema,
  deleteScratchSchema,
  scratchTitle,
} from '../src/lib/scratch-validation'

describe('scratch pad inputs', () => {
  it('keeps freeform writing and derives a bounded first-line title', () => {
    expect(saveScratchSchema.parse({ body: '  A thought\n\nKeep the detail.  ' }).body).toBe(
      'A thought\n\nKeep the detail.',
    )
    expect(scratchTitle('  A thought\nKeep the detail.')).toBe('A thought')
    expect(scratchTitle('x'.repeat(200))).toHaveLength(160)
    expect(saveScratchSchema.safeParse({ body: '  ' }).success).toBe(false)
    expect(saveScratchSchema.safeParse({ body: 'x'.repeat(10001) }).success).toBe(false)
  })
  it('requires revisions and rejects forged ownership and card links', () => {
    const edit = { id: 'note', revision: 0, body: 'A thought' }
    expect(editScratchSchema.safeParse(edit).success).toBe(true)
    for (const values of [
      { revision: -1 },
      { revision: undefined },
      { authorId: 'another-admin' },
      { cardId: 'another-card' },
    ]) {
      expect(editScratchSchema.safeParse({ ...edit, ...values }).success).toBe(false)
    }
    expect(deleteScratchSchema.safeParse({ id: 'note', revision: 0, role: 'ADMIN' }).success).toBe(
      false,
    )
  })
  it('accepts conversion details but keeps the notes and destination on the server', () => {
    const conversion = { id: 'note', revision: 0, title: 'A video', format: 'VIDEO' }
    expect(convertScratchSchema.safeParse(conversion).success).toBe(true)
    for (const values of [
      { title: '' },
      { title: 'x'.repeat(161) },
      { notes: 'forged' },
      { stage: 'DONE' },
      { boardId: 'other' },
      { format: 'UNKNOWN' },
    ]) {
      expect(convertScratchSchema.safeParse({ ...conversion, ...values }).success).toBe(false)
    }
  })
})
