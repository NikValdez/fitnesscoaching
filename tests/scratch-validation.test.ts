import { describe, expect, it } from 'vitest'
import { saveScratchPadSchema, scratchPadLimit } from '../src/lib/scratch-validation'

describe('continuous scratch pad inputs', () => {
  it('preserves exact writing, whitespace, and an intentionally cleared pad', () => {
    for (const body of ['', '  A thought\n\nKeep the detail.  ', '\n\n']) {
      expect(saveScratchPadSchema.parse({ body, revision: 0 }).body).toBe(body)
    }
  })
  it('requires a valid revision and enforces the size limit', () => {
    expect(
      saveScratchPadSchema.safeParse({ body: 'x'.repeat(scratchPadLimit), revision: 1 }).success,
    ).toBe(true)
    for (const change of [
      { body: 'x'.repeat(scratchPadLimit + 1) },
      { revision: -1 },
      { revision: 1.5 },
      { revision: undefined },
    ]) {
      expect(
        saveScratchPadSchema.safeParse({ body: 'A thought', revision: 0, ...change }).success,
      ).toBe(false)
    }
  })
  it('rejects forged pad identifiers, roles, and ownership', () => {
    for (const change of [
      { id: 'other' },
      { role: 'ADMIN' },
      { authorId: 'other' },
      { cardId: 'other' },
    ]) {
      expect(
        saveScratchPadSchema.safeParse({ body: 'A thought', revision: 0, ...change }).success,
      ).toBe(false)
    }
  })
})
