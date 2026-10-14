import { parseAnalyticsUrl, type AnalyticsItem, type Metrics } from './analytics-validation'
import { AnalyticsError, normalizeVideo } from './analytics-parsers'

type Data = Record<string, any>
const count = (value: unknown) =>
  value == null || value === ''
    ? null
    : Number.isSafeInteger(Number(value)) && Number(value) >= 0
      ? Number(value)
      : null
export function embeddedObjects(html: string) {
  const objects: Data[] = []
  let visited = 0
  const walk = (value: any, depth = 0) => {
    if (++visited > 100000 || depth > 35) return
    if (typeof value === 'string' && value.length < 2 * 1024 * 1024 && /^[\[{]/.test(value)) {
      try {
        walk(JSON.parse(value), depth + 1)
      } catch {
        /* Not serialized JSON. */
      }
    } else if (value && typeof value === 'object') {
      if (!Array.isArray(value)) objects.push(value)
      for (const v of Object.values(value)) walk(v, depth + 1)
    }
  }
  for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const text = script[1].trim()
    try {
      walk(JSON.parse(text))
    } catch {
      // Read plain JSON assignments; never evaluate page JavaScript.
      for (const name of ['ytInitialPlayerResponse', 'ytInitialData']) {
        const marker = text.match(new RegExp(`(?:var\\s+)?${name}\\s*=\\s*`))
        if (!marker || marker.index == null) continue
        const start = marker.index + marker[0].length
        let string = false
        let escaped = false
        let depth = 0
        for (let i = start; i < text.length; i++) {
          const c = text[i]
          if (string) {
            if (escaped) escaped = false
            else if (c === '\\') escaped = true
            else if (c === '"') string = false
          } else if (c === '"') string = true
          else if (c === '{' || c === '[') depth++
          else if (c === '}' || c === ']') {
            if (--depth === 0) {
              try {
                walk(JSON.parse(text.slice(start, i + 1)))
              } catch {}
              break
            }
          }
        }
      }
    }
  }
  return objects
}
// Display text must contain an exact integer; rounded labels such as "1.2K"
// are not silently converted into precise history observations.
const pageText = (value: Data | string | undefined): string =>
  typeof value === 'string'
    ? value
    : (value?.simpleText ??
      value?.content ??
      value?.text ??
      value?.runs?.map((run: Data) => run.text).join('') ??
      '')
const textCount = (value: unknown, unit: string) => {
  if (typeof value !== 'string') return null
  const match = value.trim().match(new RegExp(`^([\\d,]+)\\s+${unit}$`, 'i'))
  return match ? count(match[1].replaceAll(',', '')) : null
}
function youtubeChannel(item: AnalyticsItem, objects: Data[]) {
  const metadata = objects.find((value) => value.channelMetadataRenderer)?.channelMetadataRenderer
  if (!metadata) return null
  const target = parseAnalyticsUrl(item.url!).identity
  const urls = [...(metadata.ownerUrls ?? []), metadata.channelUrl].filter(
    (url): url is string => typeof url === 'string',
  )
  const matches = urls.some((url) => {
    try {
      return parseAnalyticsUrl(url.replace(/^http:/, 'https:')).identity === target
    } catch {
      return false
    }
  })
  return matches ? metadata : null
}
export function publicProfile(item: AnalyticsItem, objects: Data[]) {
  if (item.platform === 'youtube') {
    const metadata = youtubeChannel(item, objects)
    if (metadata) {
      const legacy = objects.find(
        (value) => value.c4TabbedHeaderRenderer?.channelId === metadata.externalId,
      )?.c4TabbedHeaderRenderer
      const header = objects.find((value) => value.pageHeaderRenderer)?.pageHeaderRenderer?.content
        ?.pageHeaderViewModel
      const parts =
        header?.metadata?.contentMetadataViewModel?.metadataRows?.flatMap(
          (row: Data) => row.metadataParts ?? [],
        ) ?? []
      const labels = [
        pageText(legacy?.subscriberCountText),
        ...parts.map((part: Data) => part.accessibilityLabel ?? pageText(part.text)),
      ]
      const followers = labels
        .map((label: string) => textCount(label, 'subscribers?'))
        .find((value: number | null) => value !== null)
      if (followers != null)
        return {
          title: String(metadata.title || item.title).slice(0, 240),
          thumbnail: metadata.avatar?.thumbnails?.at(-1)?.url ?? null,
          remoteId: String(metadata.externalId),
          metrics: { followers },
          source: 'public-page',
        }
    }
  }
  if (item.platform === 'facebook') {
    const identity = parseAnalyticsUrl(item.url!).identity
    const profileId = identity.slice('facebook:'.length)
    const profile = objects.find(
      (value) =>
        String(value.id) === profileId &&
        (value.profile_social_context ||
          value.follower_count != null ||
          value.followers_count != null),
    )
    if (profile) {
      let followers = count(profile.follower_count ?? profile.followers_count)
      for (const entry of profile.profile_social_context?.content ?? []) {
        try {
          if (parseAnalyticsUrl(entry.uri).identity !== identity) continue
          const exposed = textCount(pageText(entry.text), 'followers?')
          if (exposed !== null) followers = exposed
        } catch {
          /* Unrelated navigation or a hidden count. */
        }
      }
      if (followers !== null)
        return {
          title: String(profile.name || item.title).slice(0, 240),
          thumbnail: profile.profilePicMedium?.uri ?? profile.profile_picture?.uri ?? null,
          metrics: { followers },
          source: 'public-page',
        }
    }
  }
  const tiktok = objects.find(
    (v) =>
      v.user?.uniqueId?.toLowerCase() === item.handle?.toLowerCase() &&
      v.stats?.followerCount != null,
  )
  if (item.platform === 'tiktok' && tiktok)
    return {
      title: String(tiktok.user.nickname || item.title).slice(0, 240),
      thumbnail: tiktok.user.avatarMedium,
      metrics: { followers: count(tiktok.stats.followerCount) },
      source: 'public-page',
    }
  const handle = item.handle?.toLowerCase()
  const p = objects.find(
    (v) =>
      (v.username ?? v.uniqueId ?? v.unique_id ?? v.screen_name)?.toLowerCase() === handle &&
      (v.follower_count != null ||
        v.followers_count != null ||
        v.edge_followed_by?.count != null ||
        v.stats?.followerCount != null),
  )
  if (p)
    return {
      title: (p.full_name ?? p.nickname ?? p.name ?? item.title).slice(0, 240),
      handle: item.handle,
      thumbnail: p.profile_pic_url ?? p.avatarMedium ?? null,
      metrics: {
        followers: count(
          p.follower_count ??
            p.followers_count ??
            p.edge_followed_by?.count ??
            p.stats?.followerCount,
        ),
      },
      source: 'public-page',
    }
  throw new AnalyticsError(
    'This platform did not expose profile metrics publicly. Record a manual snapshot or try again later.',
    422,
  )
}
export function publicVideo(item: AnalyticsItem, objects: Data[]) {
  const identity = parseAnalyticsUrl(item.url!).identity.split(':').slice(1).join(':')
  const platform = item.platform!
  if (platform === 'youtube') {
    const details = objects.find((v) => v.videoId === identity && v.viewCount != null)
    if (details)
      return {
        title: String(details.title || item.title).slice(0, 240),
        metrics: {
          views: count(details.viewCount),
          likes: null,
          comments: null,
          shares: null,
          saves: null,
        },
        thumbnail: details.thumbnail?.thumbnails?.at(-1)?.url ?? null,
        source: 'public-page',
      }
  }
  const natives = objects.filter(
    (v) =>
      String(
        (platform === 'tiktok'
          ? (v.itemInfos?.id ?? v.aweme_id ?? v.id)
          : platform === 'facebook'
            ? (v.post_id ?? v.video_id ?? v.id)
            : v.aweme_id) ??
          v.videoId ??
          v.shortcode ??
          v.code ??
          v.rest_id ??
          v.post_id ??
          '',
      ) === identity,
  )
  for (const native of natives) {
    try {
      const result = normalizeVideo(platform, native)
      if (Object.values(result.metrics).some((value) => value != null))
        return { ...result, source: 'public-page' }
    } catch {}
  }
  const structured = objects.find(
    (v) =>
      v['@type'] === 'VideoObject' &&
      (v.url === item.url || v.embedUrl?.includes(identity) || v.identifier === identity),
  )
  if (structured) {
    const metrics: Metrics = {}
    for (const s of Array.isArray(structured.interactionStatistic)
      ? structured.interactionStatistic
      : structured.interactionStatistic
        ? [structured.interactionStatistic]
        : []) {
      const type =
        typeof s.interactionType === 'string' ? s.interactionType : s.interactionType?.['@type']
      const key = /WatchAction|ViewAction$/.test(type ?? '')
        ? 'views'
        : /LikeAction$/.test(type ?? '')
          ? 'likes'
          : /CommentAction$/.test(type ?? '')
            ? 'comments'
            : /ShareAction$/.test(type ?? '')
              ? 'shares'
              : null
      if (key) metrics[key] = count(s.userInteractionCount)
    }
    if (Object.values(metrics).some((v) => v != null))
      return {
        title: String(structured.name || item.title).slice(0, 240),
        metrics,
        thumbnail: Array.isArray(structured.thumbnailUrl)
          ? structured.thumbnailUrl[0]
          : structured.thumbnailUrl,
        publishedAt: structured.uploadDate,
        source: 'public-page',
      }
  }
  throw new AnalyticsError(
    'This platform did not expose this post’s metrics publicly. Import a metric snapshot or try again later.',
    422,
  )
}
async function bounded(response: Response, limit = 2 * 1024 * 1024) {
  if (!response.ok) {
    await response.body?.cancel()
    throw new AnalyticsError(
      'The platform could not be read. Your last saved metrics are preserved.',
      502,
    )
  }
  const reader = response.body!.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > limit) {
      await reader.cancel()
      throw new AnalyticsError('The platform response was too large.', 502)
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let pos = 0
  for (const c of chunks) {
    bytes.set(c, pos)
    pos += c.length
  }
  return new TextDecoder().decode(bytes)
}
async function publicObjects(
  item: AnalyticsItem,
  budget: () => Promise<void>,
  tab?: 'videos' | 'shorts',
) {
  // The URL is canonical and host-allowlisted. Redirects never leave its platform.
  let url = parseAnalyticsUrl(item.url!).url
  if (tab && item.platform === 'youtube' && item.kind === 'account') url += `/${tab}`
  for (let hop = 0; hop < 3; hop++) {
    let response: Response
    await budget()
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'text/html',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(20000),
      })
    } catch {
      throw new AnalyticsError('The public page did not respond. Try later.', 502)
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('Location')
      await response.body?.cancel()
      if (!location) break
      let parsed
      try {
        parsed = parseAnalyticsUrl(new URL(location, url).href)
      } catch {
        throw new AnalyticsError('The platform requires a login to show these metrics.', 422)
      }
      if (
        parsed.platform !== item.platform ||
        parsed.kind !== item.kind ||
        parsed.identity !== parseAnalyticsUrl(item.url!).identity
      )
        throw new AnalyticsError('The platform requires a login to show these metrics.', 422)
      url = new URL(location, url).href
      continue
    }
    return embeddedObjects(await bounded(response))
  }
  throw new AnalyticsError('The platform requires a login to show these metrics.', 422)
}
async function tiktokEmbedObjects(item: AnalyticsItem, budget: () => Promise<void>) {
  const parsed = parseAnalyticsUrl(item.url!)
  if (parsed.platform !== 'tiktok') throw new AnalyticsError('Choose a TikTok profile or video.')
  // Public embeds expose counts without cookies or access tokens. Derive the
  // endpoint from the validated identity; never follow an embed redirect.
  const path =
    parsed.kind === 'video'
      ? `/embed/v2/${parsed.identity.slice('tiktok:'.length)}`
      : `/embed/@${encodeURIComponent(parsed.handle!)}`
  let response: Response
  await budget()
  try {
    response = await fetch(new URL(path, 'https://www.tiktok.com'), {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
    })
  } catch {
    throw new AnalyticsError(
      'TikTok’s public embed did not respond. Your last saved metrics are preserved.',
      502,
    )
  }
  return embeddedObjects(await bounded(response))
}
export async function publicPage(item: AnalyticsItem, budget = async () => {}) {
  if (item.platform === 'tiktok' && item.kind === 'video')
    return { ...publicVideo(item, await tiktokEmbedObjects(item, budget)), source: 'tiktok-embed' }
  const objects = await publicObjects(item, budget)
  return item.kind === 'account' ? publicProfile(item, objects) : publicVideo(item, objects)
}
export async function publicDiscovery(item: AnalyticsItem, budget = async () => {}) {
  let objects = await publicObjects(item, budget)
  if (item.platform === 'youtube') {
    const metadata = youtubeChannel(item, objects)
    if (!metadata)
      throw new AnalyticsError('The public page did not identify this YouTube channel.', 422)
    if (
      objects.some(
        (value) => pageText(value.simpleText) === "This channel doesn't have any content",
      )
    )
      return { rows: [], cursor: null }
    const tabs = objects.flatMap((value) => (value.tabRenderer ? [value.tabRenderer] : []))
    const uploads = tabs.filter((tab) => ['Videos', 'Shorts'].includes(tab.title))
    const feed: Data[] = []
    for (const upload of uploads) {
      const page = upload.selected
        ? objects
        : await publicObjects(item, budget, upload.title.toLowerCase() as 'videos' | 'shorts')
      if (youtubeChannel(item, page)?.externalId !== metadata.externalId) continue
      for (const tab of page.filter((value) => value.tabRenderer?.selected)) {
        if (!['Videos', 'Shorts'].includes(tab.tabRenderer.title)) continue
        feed.push(...embeddedObjects(`<script>${JSON.stringify(tab.tabRenderer.content)}</script>`))
      }
    }
    // Read uploads sections, excluding recommendations and featured channels.
    objects = feed.filter((value) => {
      const video =
        value.videoRenderer ??
        value.gridVideoRenderer ??
        value.reelItemRenderer ??
        value.shortsLockupViewModel
      if (!video) return false
      const owners = video.ownerText?.runs ?? video.shortBylineText?.runs ?? []
      return (
        !owners.length ||
        owners.some(
          (owner: Data) =>
            owner.navigationEndpoint?.browseEndpoint?.browseId === metadata.externalId,
        )
      )
    })
    if (!objects.length && uploads.length && feed.length) return { rows: [], cursor: null }
  }
  if (item.platform === 'facebook') {
    const profileId = parseAnalyticsUrl(item.url!).identity.slice('facebook:'.length)
    const profile = objects.find(
      (value) => String(value.id) === profileId && value.timeline_list_feed_units,
    )
    if (profile?.timeline_list_feed_units?.edges?.length === 0) return { rows: [], cursor: null }
    if (profile)
      objects = embeddedObjects(
        `<script>${JSON.stringify(profile.timeline_list_feed_units)}</script>`,
      )
  }
  let source = 'public-page'
  if (
    item.platform === 'tiktok' &&
    !objects.some(
      (value) =>
        (value.itemInfos?.id || value.aweme_id || value.id) &&
        (
          value.authorInfos?.uniqueId ??
          value.author?.uniqueId ??
          value.author?.unique_id
        )?.toLowerCase() === item.handle?.toLowerCase(),
    )
  ) {
    objects = await tiktokEmbedObjects(item, budget)
    source = 'tiktok-embed'
  }
  const rows: {
    url: string
    remoteId?: string
    title: string
    thumbnail: string | null
    publishedAt: string | null
    metrics: Metrics
    source: string
  }[] = []
  const seen = new Set<string>()
  for (let value of objects) {
    const handle =
      value.user?.username ??
      value.author?.uniqueId ??
      value.author?.unique_id ??
      value.authorInfos?.uniqueId
    let url: string | undefined
    let title: string | undefined
    let thumbnail: string | undefined
    if (
      item.platform === 'instagram' &&
      value.media_type &&
      value.code &&
      handle?.toLowerCase() === item.handle?.toLowerCase()
    ) {
      url = `https://www.instagram.com/p/${value.code}/`
      title = value.caption?.text
      thumbnail = value.display_uri
    } else if (
      item.platform === 'tiktok' &&
      (value.itemInfos?.id || value.aweme_id || value.id) &&
      handle?.toLowerCase() === item.handle?.toLowerCase()
    ) {
      url = `https://www.tiktok.com/@${item.handle}/video/${value.itemInfos?.id ?? value.aweme_id ?? value.id}`
      title = value.desc ?? value.itemInfos?.text
    } else if (item.platform === 'youtube') {
      const video =
        value.videoRenderer ??
        value.gridVideoRenderer ??
        value.reelItemRenderer ??
        value.shortsLockupViewModel
      const id = video?.videoId ?? video?.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId
      if (id) {
        url = `https://www.youtube.com/watch?v=${id}`
        title = pageText(video.title ?? video.overlayMetadata?.primaryText)
        thumbnail =
          video.thumbnail?.thumbnails?.at(-1)?.url ?? video.thumbnail?.sources?.at(-1)?.url
        const viewText = pageText(video.viewCountText ?? video.overlayMetadata?.secondaryText)
        const viewCount = textCount(viewText, 'views?')
        value = { id, title, thumbnail, viewCountInt: viewCount }
      }
    } else if (item.platform === 'facebook') {
      const profileId = parseAnalyticsUrl(item.url!).identity.slice('facebook:'.length)
      const owners =
        value.actors ?? [value.owner ?? value.actor ?? value.author ?? value.user].filter(Boolean)
      if (owners.some((owner: Data) => String(owner.id) === profileId)) {
        const candidate =
          value.url ??
          value.permalink_url ??
          (value.post_id
            ? `https://www.facebook.com/${profileId}/posts/${value.post_id}`
            : value.video_id
              ? `https://www.facebook.com/watch/?v=${value.video_id}`
              : null)
        try {
          const parsed = parseAnalyticsUrl(candidate)
          if (parsed.platform === 'facebook' && parsed.kind === 'video') url = parsed.url
        } catch {
          /* Not an original public post URL. */
        }
        title = value.description ?? pageText(value.message)
      }
    } else if (
      item.platform === 'threads' &&
      value.code &&
      handle?.toLowerCase() === item.handle?.toLowerCase()
    ) {
      url = `https://www.threads.com/@${item.handle}/post/${value.code}`
      title = value.caption?.text
    }
    if (!url || seen.has(url)) continue
    try {
      parseAnalyticsUrl(url)
    } catch {
      continue
    }
    seen.add(url)
    let normalized
    try {
      normalized = normalizeVideo(item.platform!, value)
    } catch {
      /* Some public feeds expose metadata only. */
    }
    rows.push({
      url,
      title: String(title || normalized?.title || url).slice(0, 240),
      thumbnail: thumbnail ?? normalized?.thumbnail ?? null,
      publishedAt: normalized?.publishedAt ?? null,
      metrics: normalized?.metrics ?? {},
      source,
    })
    if (rows.length >= 100) break
  }
  if (!rows.length)
    throw new AnalyticsError(
      item.platform === 'tiktok'
        ? 'TikTok’s public profile feed did not expose new posts. Add their video URLs to track them; existing video metrics can still refresh automatically.'
        : 'This profile’s public page did not expose posts. Add individual post URLs or import CSV.',
      422,
    )
  return { rows, cursor: null }
}
