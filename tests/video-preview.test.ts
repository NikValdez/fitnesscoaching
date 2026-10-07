import { describe, expect, it, vi } from 'vitest'
import { videoEmbedUrl } from '../src/lib/video-preview'
import { resolveVideoEmbedUrl } from '../src/lib/video-preview.server'

const video = 'https://www.tiktok.com/@creator/video/7123456789012345678/'

describe('library video previews', () => {
  it('constructs platform players from validated video links', () => {
    expect(videoEmbedUrl('https://instagram.com/reel/Abc_123?igsh=tracking')).toBe(
      'https://www.instagram.com/reel/Abc_123/embed/',
    )
    expect(videoEmbedUrl('https://www.instagram.com/reels/Abc_123/')).toBe(
      'https://www.instagram.com/reel/Abc_123/embed/',
    )
    expect(videoEmbedUrl('https://www.instagram.com/p/Abc_123/')).toBe(
      'https://www.instagram.com/p/Abc_123/embed/',
    )
    expect(videoEmbedUrl(video)).toBe(
      'https://www.tiktok.com/player/v1/7123456789012345678?autoplay=0&rel=0',
    )
    expect(videoEmbedUrl('https://youtu.be/Abc_123-xyz?si=tracking')).toBe(
      'https://www.youtube.com/embed/Abc_123-xyz?autoplay=0&rel=0',
    )
    for (const url of [
      'https://www.facebook.com/reel/123456/',
      'https://x.com/creator/status/123456',
      'https://www.linkedin.com/feed/update/urn:li:activity:123456/',
    ])
      expect(videoEmbedUrl(url)).toBeNull()
    expect(videoEmbedUrl('https://vm.tiktok.com/Share123/')).toBeNull()
    expect(videoEmbedUrl('https://www.tiktok.com/player/v1/7123456789012345678')).toBeNull()
    expect(videoEmbedUrl('https://evil.test/reel/Abc_123/')).toBeNull()
  })

  it('needs no outbound server request for full video links', async () => {
    const request = vi.fn<typeof fetch>()
    expect(await resolveVideoEmbedUrl(video, request)).toBe(videoEmbedUrl(video))
    expect(await resolveVideoEmbedUrl('https://www.instagram.com/reel/Abc_123/', request)).toBe(
      'https://www.instagram.com/reel/Abc_123/embed/',
    )
    expect(await resolveVideoEmbedUrl('https://www.youtube.com/shorts/Abc_123-xyz', request)).toBe(
      'https://www.youtube.com/embed/Abc_123-xyz?autoplay=0&rel=0',
    )
    await expect(
      resolveVideoEmbedUrl('https://www.facebook.com/reel/123456/', request),
    ).rejects.toThrow('cannot be previewed')
    expect(request).not.toHaveBeenCalled()
    await expect(resolveVideoEmbedUrl('https://evil.test/reel/Abc_123/', request)).rejects.toThrow(
      'cannot be previewed',
    )
    expect(request).not.toHaveBeenCalled()
  })

  it('resolves a short share link with validated manual redirects', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: 'https://www.tiktok.com/t/Share456/' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, { status: 301, headers: { location: `${video}?tracking=1` } }),
      )
    expect(await resolveVideoEmbedUrl('https://vm.tiktok.com/Share123/', request)).toBe(
      videoEmbedUrl(video),
    )
    expect(request).toHaveBeenCalledTimes(2)
    expect(request.mock.calls[0][1]).toMatchObject({ redirect: 'manual' })
    expect(request.mock.calls[1][0]).toBe('https://www.tiktok.com/t/Share456/')
  })

  it.each([
    'https://localhost/reel/123/',
    'http://127.0.0.1/',
    'https://www.tiktok.com.evil.test/@creator/video/123/',
    'https://user:password@www.tiktok.com/@creator/video/123/',
    'https://www.tiktok.com:444/@creator/video/123/',
    'https://www.instagram.com/reel/Abc_123/',
    'https://www.youtube.com/watch?v=Abc_123-xyz',
    'https://www.facebook.com/reel/123456/',
    'javascript:alert(1)',
  ])('never follows a share redirect to %s', async (location) => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 302, headers: { location } }))
    await expect(resolveVideoEmbedUrl('https://vm.tiktok.com/Share123/', request)).rejects.toThrow(
      'cannot be previewed',
    )
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('stops redirect loops and handles inaccessible links or network errors', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'https://vm.tiktok.com/Share123/' },
      }),
    )
    await expect(resolveVideoEmbedUrl('https://vm.tiktok.com/Share123/', request)).rejects.toThrow(
      'cannot be previewed',
    )
    expect(request).toHaveBeenCalledTimes(1)
    request.mockResolvedValue(new Response(null, { status: 403 }))
    await expect(resolveVideoEmbedUrl('https://vt.tiktok.com/Share123/', request)).rejects.toThrow(
      'cannot be previewed',
    )
    request.mockRejectedValue(new Error('Network error'))
    await expect(resolveVideoEmbedUrl('https://vt.tiktok.com/Share123/', request)).rejects.toThrow(
      'cannot be previewed',
    )
  })

  it('bounds long share-link redirect chains', async () => {
    let hop = 0
    const request = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: `https://vm.tiktok.com/Share${++hop}/` },
        }),
    )
    await expect(resolveVideoEmbedUrl('https://vm.tiktok.com/Share0/', request)).rejects.toThrow(
      'cannot be previewed',
    )
    expect(request).toHaveBeenCalledTimes(5)
  })
})
