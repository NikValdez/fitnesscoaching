import { z } from 'zod'

export const libraryPlatforms = [
  { id: 'INSTAGRAM', label: 'Instagram' },
  { id: 'TIKTOK', label: 'TikTok' },
] as const
export type LibraryPlatform = (typeof libraryPlatforms)[number]['id']

export function parseVideoLink(value: string): { url: string; platform: LibraryPlatform } | null {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
    const host = url.hostname.toLowerCase()
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
    } else return null
    url.search = ''
    url.hash = ''
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/`
    const normalized = url.toString()
    return normalized.length <= 2048 ? { url: normalized, platform } : null
  } catch {
    return null
  }
}

const videoLink = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => !!parseVideoLink(value), {
    message: 'Paste an Instagram Reel, video post, or TikTok video link.',
  })
const id = z.string().min(1).max(100)
const revision = z.number().int().nonnegative()
export const saveLibraryEntrySchema = z
  .object({
    id: id.optional(),
    expectedUpdatedAt: z.string().datetime().optional(),
    revision,
    url: videoLink,
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
