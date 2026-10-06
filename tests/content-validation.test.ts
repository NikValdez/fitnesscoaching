import { describe, expect, it } from 'vitest'
import {
  saveContentIdeaSchema,
  moveContentIdeaSchema,
  deleteContentIdeaSchema,
} from '../src/lib/content-validation'

describe('content board inputs', () => {
  const idea = {
    revision: 0,
    title: 'A simple strength habit',
    notes: '',
    format: 'VIDEO',
    stage: 'CONCEPTS',
  }
  it('trims text and validates every supported stage', () => {
    expect(saveContentIdeaSchema.parse({ ...idea, title: '  A good idea  ' }).title).toBe(
      'A good idea',
    )
    for (const stage of ['CONCEPTS', 'PRE_PRODUCTION', 'FILMING', 'DONE']) {
      expect(saveContentIdeaSchema.safeParse({ ...idea, stage }).success).toBe(true)
    }
  })
  it('rejects blank or oversized content and unknown stages', () => {
    for (const change of [
      { title: '   ' },
      { title: 'x'.repeat(161) },
      { notes: 'x'.repeat(10001) },
      { stage: 'PUBLISHED' },
      { format: 'UNKNOWN' },
    ]) {
      expect(saveContentIdeaSchema.safeParse({ ...idea, ...change }).success).toBe(false)
    }
  })
  it('rejects forged permissions, board identifiers and missing revisions', () => {
    for (const change of [
      { role: 'ADMIN' },
      { authorId: 'someone-else' },
      { boardId: 'private' },
      { revision: -1 },
      { revision: 1.5 },
      { revision: undefined },
    ]) {
      expect(saveContentIdeaSchema.safeParse({ ...idea, ...change }).success).toBe(false)
    }
  })
  it('allows append and reorder while rejecting self-references', () => {
    const move = { id: 'idea-a', revision: 1, stage: 'FILMING', beforeId: null }
    expect(moveContentIdeaSchema.safeParse(move).success).toBe(true)
    expect(moveContentIdeaSchema.safeParse({ ...move, beforeId: 'idea-b' }).success).toBe(true)
    expect(moveContentIdeaSchema.safeParse({ ...move, beforeId: move.id }).success).toBe(false)
    expect(moveContentIdeaSchema.safeParse({ ...move, stage: 'INVALID' }).success).toBe(false)
    expect(
      deleteContentIdeaSchema.safeParse({ id: 'idea-a', revision: 1, authorId: 'other' }).success,
    ).toBe(false)
  })
})
