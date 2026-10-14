import { z } from 'zod'

export const analyticsPlatforms = [
  'tiktok',
  'instagram',
  'youtube',
  'x',
  'snapchat',
  'threads',
  'facebook',
] as const
export type AnalyticsPlatform = (typeof analyticsPlatforms)[number]
export const platformNames: Record<AnalyticsPlatform, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  x: 'X',
  snapchat: 'Snapchat',
  threads: 'Threads',
  facebook: 'Facebook',
}
export const platformColors: Record<AnalyticsPlatform, string> = {
  tiktok: '#285c57',
  instagram: '#ab6482',
  youtube: '#bb675c',
  x: '#475156',
  snapchat: '#ba9a3c',
  threads: '#837765',
  facebook: '#6687ae',
}
export const metricNames = ['views', 'likes', 'comments', 'shares', 'saves', 'followers'] as const
export type Metrics = Partial<Record<(typeof metricNames)[number], number | null>>
export type AnalyticsItem = {
  id: string
  kind: 'account' | 'video' | 'creator' | 'campaign'
  version: number
  updatedAt: string
  url?: string
  platform?: AnalyticsPlatform
  handle?: string
  title: string
  creatorId?: string | null
  campaignId?: string | null
  accountId?: string | null
  boardId?: string | null
  tags: string[]
  notes: string
  publishedAt?: string | null
  thumbnail?: string | null
  metrics?: Metrics
  lastFetched?: string | null
  error?: string | null
  discoveryError?: string | null
  lastDiscovered?: string | null
  autoRefresh?: boolean
  collectionRunner?: 'cloudflare' | 'mac'
  collectionFailures?: number
  collectionAttemptDay?: string
  archived?: boolean
  cpm?: number
  budget?: number
  cursor?: string | null
  remoteId?: string
  source?: string
}
export type Snapshot = {
  itemId: string
  capturedAt: string
  metrics: Metrics
  source: string
}
export type AnalyticsSettings = {
  configured: boolean
  automatic: boolean
  intervalHours: number
  dailyLimit: number
  requestsToday: number
}
export type AnalyticsWorkspace = {
  items: AnalyticsItem[]
  snapshots: Snapshot[]
  settings: AnalyticsSettings
  notice?: string
}

const id = z.string().uuid()
const metrics = z
  .object(
    Object.fromEntries(
      metricNames.map((key) => [
        key,
        z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable().optional(),
      ]),
    ) as Record<(typeof metricNames)[number], z.ZodOptional<z.ZodNullable<z.ZodNumber>>>,
  )
  .strict()
const fields = {
  title: z.string().trim().min(1).max(240),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  notes: z.string().max(10000).default(''),
  creatorId: id.nullable().optional(),
  campaignId: id.nullable().optional(),
  accountId: id.nullable().optional(),
  boardId: z.string().min(1).max(200).nullable().optional(),
  autoRefresh: z.boolean().default(true),
  publishedAt: z.iso.datetime().nullable().optional(),
  cpm: z.number().min(0).max(100000).optional(),
  budget: z.number().min(0).max(100000000).optional(),
}
export const analyticsActionSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('add'),
      kind: z.enum(['account', 'video', 'creator', 'campaign']),
      url: z.string().max(2048).optional(),
      ...fields,
    })
    .strict(),
  z
    .object({
      action: z.literal('add-links'),
      urls: z.array(z.string().max(2048)).min(1).max(200),
      creatorId: id.nullable().optional(),
      campaignId: id.nullable().optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal('edit'),
      id,
      version: z.number().int().min(1),
      ...fields,
    })
    .strict(),
  z
    .object({
      action: z.literal('archive'),
      id,
      version: z.number().int().min(1),
      archived: z.boolean(),
    })
    .strict(),
  z.object({ action: z.literal('refresh'), id }).strict(),
  z.object({ action: z.literal('refresh-all') }).strict(),
  z.object({ action: z.literal('discover'), id }).strict(),
  z
    .object({
      action: z.literal('snapshot'),
      id,
      capturedAt: z.iso.datetime(),
      metrics,
    })
    .strict(),
  z
    .object({
      action: z.literal('import'),
      rows: z
        .array(
          z
            .object({
              url: z.string().max(2048),
              title: z.string().trim().max(240).optional(),
              capturedAt: z.iso.datetime(),
              metrics,
              creatorId: id.nullable().optional(),
              campaignId: id.nullable().optional(),
            })
            .strict(),
        )
        .min(1)
        .max(200),
    })
    .strict(),
  z
    .object({
      action: z.literal('settings'),
      automatic: z.boolean(),
      intervalHours: z.literal(24),
      dailyLimit: z.number().int().min(1).max(5000),
    })
    .strict(),
])
export type AnalyticsAction = z.infer<typeof analyticsActionSchema>

/** Canonical identities prevent duplicate tracking and never resolve arbitrary URLs. */
export function parseAnalyticsUrl(input: string) {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    throw new Error('Paste a complete public profile or video URL.')
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port)
    throw new Error('Use a public HTTPS profile or video URL.')
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  const parts = url.pathname.split('/').filter(Boolean)
  let platform: AnalyticsPlatform
  let kind: 'account' | 'video'
  let identity: string
  let handle = ''
  let canonical: string
  const token = (value: string | undefined, pattern = /^[\w.\-]+$/) => {
    if (!value || !pattern.test(value) || value.length > 200)
      throw new Error('This profile or video URL is incomplete.')
    return value
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') {
    platform = 'youtube'
    const video =
      host === 'youtu.be'
        ? parts[0]
        : ['shorts', 'live'].includes(parts[0])
          ? parts[1]
          : parts[0] === 'watch'
            ? url.searchParams.get('v')
            : null
    if (video) {
      kind = 'video'
      identity = token(video, /^[\w-]{11}$/)
      canonical = `https://www.youtube.com/watch?v=${identity}`
    } else {
      kind = 'account'
      handle = token(
        parts[0]?.startsWith('@')
          ? parts[0].slice(1)
          : ['channel', 'c', 'user'].includes(parts[0])
            ? parts[1]
            : undefined,
      )
      identity = parts[0] === 'channel' ? handle : handle.toLowerCase()
      canonical =
        parts[0] === 'channel'
          ? `https://www.youtube.com/channel/${handle}`
          : `https://www.youtube.com/@${handle}`
    }
  } else if (host === 'tiktok.com') {
    platform = 'tiktok'
    handle = token(parts[0]?.startsWith('@') ? parts[0].slice(1) : undefined)
    kind = parts[1] === 'video' || parts[1] === 'photo' ? 'video' : 'account'
    identity = kind === 'video' ? token(parts[2], /^\d+$/) : handle.toLowerCase()
    canonical = `https://www.tiktok.com/@${handle}${kind === 'video' ? `/video/${identity}` : ''}`
  } else if (host === 'instagram.com') {
    platform = 'instagram'
    kind = ['p', 'reel', 'reels', 'tv'].includes(parts[0]) ? 'video' : 'account'
    identity = token(kind === 'video' ? parts[1] : parts[0])
    handle = kind === 'account' ? identity.toLowerCase() : ''
    canonical =
      kind === 'video'
        ? `https://www.instagram.com/p/${identity}/`
        : `https://www.instagram.com/${handle}/`
  } else if (host === 'x.com' || host === 'twitter.com' || host === 'mobile.twitter.com') {
    platform = 'x'
    handle = token(parts[0])
    kind = parts[1] === 'status' ? 'video' : 'account'
    identity = kind === 'video' ? token(parts[2], /^\d+$/) : handle.toLowerCase()
    canonical = `https://x.com/${handle}${kind === 'video' ? `/status/${identity}` : ''}`
  } else if (host === 'threads.net' || host === 'threads.com') {
    platform = 'threads'
    handle = token(parts[0]?.startsWith('@') ? parts[0].slice(1) : undefined)
    kind = parts[1] === 'post' ? 'video' : 'account'
    identity = kind === 'video' ? token(parts[2]) : handle.toLowerCase()
    canonical = `https://www.threads.com/@${handle}${kind === 'video' ? `/post/${identity}` : ''}`
  } else if (host === 'snapchat.com') {
    platform = 'snapchat'
    kind = parts[0] === 'spotlight' ? 'video' : 'account'
    identity = token(
      kind === 'video'
        ? parts[1]
        : parts[0]?.startsWith('@')
          ? parts[0].slice(1)
          : parts[0] === 'add'
            ? parts[1]
            : undefined,
    )
    handle = kind === 'account' ? identity.toLowerCase() : ''
    canonical =
      kind === 'video'
        ? `https://www.snapchat.com/spotlight/${identity}`
        : `https://www.snapchat.com/add/${handle}`
  } else if (host === 'facebook.com' || host === 'm.facebook.com' || host === 'web.facebook.com') {
    platform = 'facebook'
    const post =
      parts[0] === 'reel'
        ? parts[1]
        : parts.includes('videos')
          ? parts[parts.indexOf('videos') + 1]
          : parts.includes('posts')
            ? parts[parts.indexOf('posts') + 1]
            : parts[0] === 'watch'
              ? url.searchParams.get('v')
              : parts[0] === 'story.php' || parts[0] === 'permalink.php'
                ? url.searchParams.get('story_fbid')
                : null
    kind = post ? 'video' : 'account'
    identity = token(
      post ||
        (parts[0] === 'profile.php'
          ? token(url.searchParams.get('id') || undefined, /^\d+$/)
          : parts[0] === 'people'
            ? token(parts[2], /^\d+$/)
            : parts[0]),
    )
    handle = kind === 'account' ? identity.toLowerCase() : parts[0] === 'reel' ? '' : parts[0]
    canonical =
      kind === 'video'
        ? `https://www.facebook.com/${parts[0] === 'reel' ? `reel/${identity}` : parts.includes('posts') ? `${token(parts[0])}/posts/${identity}` : `watch/?v=${identity}`}`
        : parts[0] === 'profile.php' || parts[0] === 'people'
          ? `https://www.facebook.com/profile.php?id=${identity}`
          : `https://www.facebook.com/${identity}`
  } else
    throw new Error(
      'Supported platforms: TikTok, Instagram, YouTube, X, Snapchat, Threads, and Facebook.',
    )
  if (
    kind === 'account' &&
    [
      'explore',
      'accounts',
      'login',
      'signup',
      'home',
      'feed',
      'settings',
      'search',
      'watch',
      'reel',
      'share',
      'sharer.php',
    ].includes(identity.toLowerCase())
  )
    throw new Error('Paste a profile URL or the original post URL.')
  if (kind === 'account' && platform !== 'youtube') identity = identity.toLowerCase()
  return {
    platform,
    kind,
    identity: `${platform}:${identity}`,
    handle,
    url: canonical,
  }
}

export function engagement(item: AnalyticsItem) {
  const m = item.metrics
  if (!m || m.views == null || m.views <= 0 || m.likes == null || m.comments == null) return null
  return ((m.likes + m.comments + (m.shares ?? 0)) / m.views) * 100
}
export function compact(value: number | null | undefined) {
  return value == null
    ? '—'
    : new Intl.NumberFormat('en', {
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(value)
}
export function csvCell(value: unknown) {
  let text = String(value ?? '')
  if (/^\s*[=+\-@]|^[\t\r]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}
export function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (!cell || quoted) quoted = !quoted
      else throw new Error('Invalid CSV quotes.')
    } else if (c === ',' && !quoted) {
      row.push(cell)
      cell = ''
    } else if (c === '\n' && !quoted) {
      row.push(cell.replace(/\r$/, ''))
      if (row.some(Boolean)) rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (quoted) throw new Error('A CSV field is missing its closing quote.')
  row.push(cell.replace(/\r$/, ''))
  if (row.some(Boolean)) rows.push(row)
  return rows
}
