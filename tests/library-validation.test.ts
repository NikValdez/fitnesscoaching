import { describe, expect, it } from 'vitest'
import {
  parseLibraryLink,
  saveLibraryEntrySchema,
  deleteLibraryEntrySchema,
} from '../src/lib/library-validation'

describe('inspiration library links', () => {
  it('recognizes supported video and share links and removes tracking parameters', () => {
    expect(parseLibraryLink(' https://instagram.com/reel/ABC_-12?igsh=tracking#fragment ')).toEqual(
      {
        url: 'https://www.instagram.com/reel/ABC_-12/',
        platform: 'INSTAGRAM',
      },
    )
    for (const url of [
      'https://www.instagram.com/p/ABC123/',
      'https://www.instagram.com/reels/ABC123/',
      'https://www.instagram.com/tv/ABC123/',
    ])
      expect(parseLibraryLink(url)?.platform).toBe('INSTAGRAM')
    for (const url of [
      'https://www.tiktok.com/@creator.name/video/123456789?is_from_webapp=1',
      'https://www.tiktok.com/t/ZAB123/',
      'https://vm.tiktok.com/ZAB123/',
      'https://vt.tiktok.com/ZAB123/',
    ])
      expect(parseLibraryLink(url)?.platform).toBe('TIKTOK')
    expect(parseLibraryLink('https://m.tiktok.com/@creator/video/123')).toEqual({
      url: 'https://www.tiktok.com/@creator/video/123/',
      platform: 'TIKTOK',
    })
  })
  it('normalizes YouTube video formats without losing the video identifier', () => {
    for (const url of [
      'https://youtu.be/Abc_123-xyz?si=tracking',
      'https://m.youtube.com/watch?v=Abc_123-xyz&list=playlist&t=12',
      'https://www.youtube.com/shorts/Abc_123-xyz?feature=share',
      'https://www.youtube.com/live/Abc_123-xyz/',
      'https://www.youtube.com/embed/Abc_123-xyz',
    ])
      expect(parseLibraryLink(url)).toEqual({
        url: 'https://www.youtube.com/watch?v=Abc_123-xyz',
        platform: 'YOUTUBE',
      })
  })
  it('supports Facebook videos, posts, and share links while keeping required query parameters', () => {
    for (const url of [
      'https://m.facebook.com/reel/123456?mibextid=tracking',
      'https://www.facebook.com/creator/videos/123456/',
      'https://www.facebook.com/creator/posts/pfbidABC123/',
      'https://www.facebook.com/groups/fitness/posts/123456/',
      'https://www.facebook.com/share/v/Share123/',
      'https://www.facebook.com/share/r/Share123/',
      'https://www.facebook.com/share/p/Share123/',
      'https://fb.watch/Share123/',
    ])
      expect(parseLibraryLink(url)?.platform).toBe('FACEBOOK')
    for (const path of ['watch/', 'video.php'])
      expect(parseLibraryLink(`https://m.facebook.com/${path}?v=123456&tracking=1`)).toEqual({
        url: 'https://www.facebook.com/watch/?v=123456',
        platform: 'FACEBOOK',
      })
    expect(
      parseLibraryLink(
        'https://www.facebook.com/permalink.php?story_fbid=pfbidABC123&id=456&tracking=1',
      ),
    ).toEqual({
      url: 'https://www.facebook.com/permalink.php?story_fbid=pfbidABC123&id=456',
      platform: 'FACEBOOK',
    })
  })
  it('recognizes Twitter/X and LinkedIn post links without tracking parameters', () => {
    for (const host of ['x.com', 'twitter.com', 'mobile.twitter.com'])
      expect(parseLibraryLink(`https://${host}/creator/status/123456/video/1?s=20`)).toEqual({
        url: 'https://x.com/creator/status/123456',
        platform: 'TWITTER',
      })
    for (const url of [
      'https://www.linkedin.com/feed/update/urn:li:activity:123456/?utm_source=share',
      'https://www.linkedin.com/feed/update/urn:li:ugcPost:123456/',
      'https://www.linkedin.com/posts/creator_fitness-advice-activity-123456-Abc1?utm_medium=share',
      'https://www.linkedin.com/pulse/fitness-advice-creator/',
    ])
      expect(parseLibraryLink(url)?.platform).toBe('LINKEDIN')
  })
  it('rejects unsafe URLs, lookalike hosts, profiles, and unsupported links', () => {
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
      'https://youtube.com/watch?list=playlist',
      'https://youtube.com/@creator',
      'https://youtu.be.evil.test/Abc_123-xyz',
      'https://youtube.com/redirect?q=https://evil.test',
      'https://www.facebook.com/profile.php?id=123456',
      'https://www.facebook.com/watch/?v=https://evil.test',
      'https://facebook.com.evil.test/reel/123456/',
      'https://www.facebook.com/l.php?u=https://evil.test',
      'https://www.facebook.com/creator/',
      'https://x.com/creator',
      'https://x.com.evil.test/creator/status/123456',
      'https://twitter.com/creator/status/not-a-post',
      'https://www.linkedin.com/in/creator/',
      'https://www.linkedin.com/company/fitness/',
      'https://www.linkedin.com.evil.test/feed/update/urn:li:activity:123456/',
      'not a link',
    ])
      expect(parseLibraryLink(url), url).toBeNull()
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
