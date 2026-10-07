import { describe, expect, it, vi } from 'vitest'
import {
  mediaActionSchema,
  mediaStartSchema,
  mediaRange,
  MEDIA_MAX_SIZE,
  MEDIA_PART_SIZE,
  partLength,
} from '../src/lib/media-validation'
import { retryMediaPart, UploadError } from '../src/lib/media-upload'
const start = {
  action: 'start',
  id: '96ff45a8-11db-46cc-9877-2859188c13e0',
  filename: 'Squat.MOV',
  size: 1024,
  lastModified: 100,
  title: 'Squat demo',
  notes: '',
  category: 'RAW',
  tags: ['Strength', 'strength'],
  cardId: null,
}
describe('shared video upload boundaries', () => {
  it('accepts large supported originals, normalizes tags, and rejects unsafe metadata and ownership', () => {
    expect(mediaStartSchema.parse(start).tags).toEqual(['strength'])
    expect(mediaActionSchema.safeParse({ ...start, size: MEDIA_MAX_SIZE }).success).toBe(true)
    for (const extra of [
      { size: 0 },
      { size: MEDIA_MAX_SIZE + 1 },
      { filename: '../clip.mp4' },
      { filename: 'clip.html' },
      { filename: 'clip.mp4\r\nInjected: header' },
      { objectKey: 'someone/else' },
      { uploadId: 'other' },
      { authorId: 'user' },
      { contentType: 'text/html' },
      { category: 'invalid' },
      { tags: Array(13).fill('tag') },
    ])
      expect(
        mediaActionSchema.safeParse({ ...start, ...extra }).success,
        JSON.stringify(extra),
      ).toBe(false)
    expect(
      mediaActionSchema.safeParse({
        action: 'edit',
        id: start.id,
        title: 'x',
        notes: '',
        tags: [],
        category: 'RAW',
        cardId: null,
      }).success,
    ).toBe(false)
    expect(mediaActionSchema.safeParse({ action: 'delete', id: start.id }).success).toBe(false)
  })
  it('requires exact chunk sizes and handles the final chunk without permitting extra parts', () => {
    const size = MEDIA_PART_SIZE * 2 + 7
    expect(partLength(size, 1)).toBe(MEDIA_PART_SIZE)
    expect(partLength(size, 2)).toBe(MEDIA_PART_SIZE)
    expect(partLength(size, 3)).toBe(7)
    for (const part of [0, -1, 1.5, 4, NaN, Infinity]) expect(partLength(size, part)).toBe(0)
  })
  it('supports seeking, open-ended and suffix ranges and rejects invalid or multiple ranges', () => {
    expect(mediaRange(null, 100)).toBeNull()
    expect(mediaRange('bytes=10-19', 100)).toEqual({ offset: 10, length: 10 })
    expect(mediaRange('bytes=90-', 100)).toEqual({ offset: 90, length: 10 })
    expect(mediaRange('bytes=-10', 100)).toEqual({ offset: 90, length: 10 })
    expect(mediaRange('bytes=90-200', 100)).toEqual({ offset: 90, length: 10 })
    expect(mediaRange('bytes=-200', 100)).toEqual({ offset: 0, length: 100 })
    for (const value of [
      'bytes=100-',
      'bytes=10-9',
      'bytes=-0',
      'bytes=-',
      'bytes=0-1,5-6',
      'bytes=9007199254740993-',
      'garbage',
    ])
      expect(mediaRange(value, 100), value).toBe(false)
  })
  it('retries temporary network failures but stops on revocation or cancellation', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const temporary = vi
      .fn()
      .mockRejectedValueOnce(new UploadError('offline'))
      .mockResolvedValueOnce(undefined)
    const pending = retryMediaPart(temporary, controller.signal)
    await vi.runAllTimersAsync()
    await pending
    expect(temporary).toHaveBeenCalledTimes(2)
    const revoked = vi.fn().mockRejectedValue(new UploadError('revoked', 403))
    await expect(retryMediaPart(revoked, controller.signal)).rejects.toThrow('revoked')
    expect(revoked).toHaveBeenCalledTimes(1)
    controller.abort()
    const aborted = vi.fn().mockRejectedValue(new DOMException('paused', 'AbortError'))
    await expect(retryMediaPart(aborted, controller.signal)).rejects.toThrow('paused')
    expect(aborted).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
