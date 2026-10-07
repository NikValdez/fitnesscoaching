import { describe, expect, it } from 'vitest'
import {
  parseVideoLink,
  saveLibraryEntrySchema,
  deleteLibraryEntrySchema,
} from '../src/lib/library-validation'

describe('inspiration library links', () => {
  it('recognizes supported video and share links and removes tracking parameters', () => {
    expect(parseVideoLink(' https://instagram.com/reel/ABC_-12?igsh=tracking#fragment ')).toEqual({
      url: 'https://www.instagram.com/reel/ABC_-12/',
      platform: 'INSTAGRAM',
    })
    for (const url of [
      'https://www.instagram.com/p/ABC123/',
      'https://www.instagram.com/reels/ABC123/',
      'https://www.instagram.com/tv/ABC123/',
    ])
      expect(parseVideoLink(url)?.platform).toBe('INSTAGRAM')
    for (const url of [
      'https://www.tiktok.com/@creator.name/video/123456789?is_from_webapp=1',
      'https://www.tiktok.com/t/ZAB123/',
      'https://vm.tiktok.com/ZAB123/',
      'https://vt.tiktok.com/ZAB123/',
    ])
      expect(parseVideoLink(url)?.platform).toBe('TIKTOK')
    expect(parseVideoLink('https://m.tiktok.com/@creator/video/123')).toEqual({
      url: 'https://www.tiktok.com/@creator/video/123/',
      platform: 'TIKTOK',
    })
  })
  it('rejects unsafe URLs, lookalike hosts, profiles, and non-video links', () => {
    for (const url of [
      'javascript:alert(1)',
      'data:text/html,bad',
      'http://www.instagram.com/reel/ABC/',
      'https://instagram.com.evil.test/reel/ABC/',
      'https://evil.instagram.com/reel/ABC/',
      'https://instagram.com@evil.test/reel/ABC/',
      'https://user:password@instagram.com/reel/ABC/',
      'https://www.instagram.com:444/reel/ABC/',
      'https://www.instagram.com/creator/',
      'https://www.instagram.com/',
      'https://www.tiktok.com/@creator',
      'https://www.tiktok.com/search?q=inspiration',
      'https://vm.tiktok.com/',
      'https://youtube.com/watch?v=123',
      'not a link',
    ])
      expect(parseVideoLink(url), url).toBeNull()
  })
  it('requires a saved version for edits/deletes and rejects ownership inputs', () => {
    const draft = { revision: 0, title: '', notes: '', url: 'https://www.instagram.com/reel/ABC/' }
    expect(saveLibraryEntrySchema.safeParse(draft).success).toBe(true)
    for (const extra of [
      { authorId: 'other' },
      { libraryId: 'private' },
      { role: 'ADMIN' },
      { platform: 'INSTAGRAM' },
      { revision: -1 },
      { title: 'x'.repeat(161) },
      { notes: 'x'.repeat(4001) },
      { id: 'entry' },
    ])
      expect(saveLibraryEntrySchema.safeParse({ ...draft, ...extra }).success).toBe(false)
    const saved = { id: 'entry', revision: 1, expectedUpdatedAt: '2026-10-06T12:00:00.000Z' }
    expect(saveLibraryEntrySchema.safeParse({ ...draft, ...saved }).success).toBe(true)
    expect(deleteLibraryEntrySchema.safeParse(saved).success).toBe(true)
    expect(deleteLibraryEntrySchema.safeParse({ id: 'entry', revision: 1 }).success).toBe(false)
  })
})
