import { z } from 'zod'

export const libraryPlatforms = [
  { id: 'INSTAGRAM', label: 'Instagram' },
  { id: 'TIKTOK', label: 'TikTok' },
  { id: 'FACEBOOK', label: 'Facebook' },
  { id: 'YOUTUBE', label: 'YouTube' },
  { id: 'TWITTER', label: 'Twitter / X' },
  { id: 'LINKEDIN', label: 'LinkedIn' },
] as const
export type LibraryPlatform = (typeof libraryPlatforms)[number]['id']

export const libraryLinkHelp =
  'Paste a post or video link from Instagram, TikTok, Facebook, YouTube, Twitter/X, or LinkedIn.'

export function parseLibraryLink(value: string): { url: string; platform: LibraryPlatform } | null {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
    const host = url.hostname.toLowerCase()
    const search = new URLSearchParams()
    let trailingSlash = true
    let platform: LibraryPlatform
    if (['instagram.com', 'www.instagram.com', 'm.instagram.com'].includes(host)) {
      if (!/^\/(?:reel|reels|p|tv)\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) return null
      platform = 'INSTAGRAM'
      url.hostname = 'www.instagram.com'
    } else if (['tiktok.com', 'www.tiktok.com', 'm.tiktok.com'].includes(host)) {
      if (!/^\/(?:@[A-Za-z0-9._-]+\/video\/\d+|t\/[A-Za-z0-9_-]+)\/?$/.test(url.pathname))
        return null
      platform = 'TIKTOK'
      url.hostname = 'www.tiktok.com'
    } else if (['vm.tiktok.com', 'vt.tiktok.com'].includes(host)) {
      if (!/^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) return null
      platform = 'TIKTOK'
    } else if (
      [
        'facebook.com',
        'www.facebook.com',
        'm.facebook.com',
        'web.facebook.com',
        'mbasic.facebook.com',
      ].includes(host)
    ) {
      const videoId = url.searchParams.get('v')
      const postId = url.searchParams.get('story_fbid')
      const ownerId = url.searchParams.get('id')
      if (/^\/(?:watch\/?|video\.php)$/.test(url.pathname) && /^\d+$/.test(videoId ?? '')) {
        url.pathname = '/watch/'
        search.set('v', videoId!)
      } else if (
        /^\/(?:permalink|story)\.php$/.test(url.pathname) &&
        /^(?:\d+|pfbid[A-Za-z0-9]+)$/.test(postId ?? '') &&
        /^\d+$/.test(ownerId ?? '')
      ) {
        search.set('story_fbid', postId!)
        search.set('id', ownerId!)
        trailingSlash = false
      } else if (
        !/^\/(?:reel\/\d+|(?:[A-Za-z0-9._-]+\/)?videos\/\d+|[A-Za-z0-9._-]+\/posts\/(?:\d+|pfbid[A-Za-z0-9]+)|groups\/[A-Za-z0-9._-]+\/(?:posts|permalink)\/\d+|share\/(?:[rvp]\/)?[A-Za-z0-9_-]+)\/?$/.test(
          url.pathname,
        )
      )
        return null
      platform = 'FACEBOOK'
      url.hostname = 'www.facebook.com'
    } else if (['fb.watch', 'www.fb.watch'].includes(host)) {
      if (!/^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) return null
      platform = 'FACEBOOK'
      url.hostname = 'fb.watch'
    } else if (
      [
        'youtube.com',
        'www.youtube.com',
        'm.youtube.com',
        'music.youtube.com',
        'youtu.be',
        'www.youtu.be',
      ].includes(host)
    ) {
      const videoId = host.endsWith('youtu.be')
        ? url.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/)?.[1]
        : /^\/watch\/?$/.test(url.pathname)
          ? url.searchParams.get('v')
          : url.pathname.match(/^\/(?:shorts|live|embed)\/([A-Za-z0-9_-]{11})\/?$/)?.[1]
      if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null
      platform = 'YOUTUBE'
      url.hostname = 'www.youtube.com'
      url.pathname = '/watch'
      search.set('v', videoId)
      trailingSlash = false
    } else if (
      [
        'twitter.com',
        'www.twitter.com',
        'mobile.twitter.com',
        'm.twitter.com',
        'x.com',
        'www.x.com',
        'mobile.x.com',
        'm.x.com',
      ].includes(host)
    ) {
      const post = url.pathname.match(
        /^\/([A-Za-z0-9_]{1,15}|i\/web|i)\/status\/(\d+)(?:\/(?:video|photo)\/\d+)?\/?$/,
      )
      if (!post) return null
      platform = 'TWITTER'
      url.hostname = 'x.com'
      url.pathname = `/${post[1]}/status/${post[2]}`
      trailingSlash = false
    } else if (['linkedin.com', 'www.linkedin.com', 'm.linkedin.com'].includes(host)) {
      if (
        !/^\/(?:feed\/update\/urn:li:(?:activity|ugcPost|share):\d+|posts\/[A-Za-z0-9_%.-]+-activity-\d+(?:-[A-Za-z0-9_-]+)?|pulse\/[A-Za-z0-9_%.-]+)\/?$/.test(
          url.pathname,
        )
      )
        return null
      platform = 'LINKEDIN'
      url.hostname = 'www.linkedin.com'
    } else return null
    url.search = search.toString()
    url.hash = ''
    url.pathname = `${url.pathname.replace(/\/+$/, '')}${trailingSlash ? '/' : ''}`
    const normalized = url.toString()
    return normalized.length <= 2048 ? { url: normalized, platform } : null
  } catch {
    return null
  }
}

const contentLink = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => !!parseLibraryLink(value), {
    message: libraryLinkHelp,
  })
const id = z.string().min(1).max(100)
const revision = z.number().int().nonnegative()
export const saveLibraryEntrySchema = z
  .object({
    id: id.optional(),
    expectedUpdatedAt: z.string().datetime().optional(),
    revision,
    url: contentLink,
    title: z.string().trim().max(160),
    notes: z.string().trim().max(4000),
  })
  .strict()
  .refine((value) => !value.id || !!value.expectedUpdatedAt, {
    message: 'Reload this link before editing it.',
  })
export const deleteLibraryEntrySchema = z
  .object({
    id,
    expectedUpdatedAt: z.string().datetime(),
    revision,
  })
  .strict()
