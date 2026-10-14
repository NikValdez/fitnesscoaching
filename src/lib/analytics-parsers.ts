import type { AnalyticsItem, AnalyticsPlatform, Metrics } from './analytics-validation'

// Native post fields follow the public page data used by SwingLoop.
// Missing public metrics remain null; comments arrays are never treated as totals.
type Data = Record<string, any>
const count = (value: unknown): number | null => {
  if (value == null || value === '') return null
  const raw = typeof value === 'number' ? value : Number(String(value).replaceAll(',', ''))
  return Number.isSafeInteger(raw) && raw >= 0 ? raw : null
}
const date = (value: unknown, seconds = false) => {
  if (!value) return null
  const parsed = new Date(
    seconds ? Number(value) * 1000 : typeof value === 'number' ? value : String(value),
  )
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null
}
const image = (value: unknown) => {
  if (typeof value !== 'string' || value.length > 4096) return null
  try {
    const u = new URL(value)
    return u.protocol === 'https:' && !u.username && !u.password ? u.href : null
  } catch {
    return null
  }
}
export class AnalyticsError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}
export function normalizeVideo(platform: AnalyticsPlatform, data: Data) {
  let p: Data
  let title: unknown
  let thumbnail: unknown
  let publishedAt: string | null
  let handle: unknown
  let metrics: Metrics
  switch (platform) {
    case 'tiktok':
      p = data.itemInfos ?? data.aweme_detail ?? data
      if (!p.aweme_id && !p.id)
        throw new AnalyticsError('The public page did not return this TikTok post.', 502)
      {
        const m = p.statistics ?? p.stats ?? p
        metrics = {
          views: count(m.play_count ?? m.playCount),
          likes: count(m.digg_count ?? m.diggCount),
          comments: count(m.comment_count ?? m.commentCount),
          shares: count(m.share_count ?? m.shareCount),
          saves: count(m.collect_count ?? m.collectCount),
        }
      }
      title = p.desc ?? p.text
      thumbnail =
        typeof p.video?.cover === 'string'
          ? p.video.cover
          : (p.video?.cover?.url_list?.[0] ?? p.covers?.[0])
      publishedAt = date(p.create_time ?? p.createTime, true)
      handle = p.author?.unique_id ?? p.author?.uniqueId ?? data.authorInfos?.uniqueId
      break
    case 'instagram':
      p = data.data?.xdt_shortcode_media ?? data
      if (!p.id && !p.code && !p.shortcode)
        throw new AnalyticsError('The public page did not return this Instagram post.', 502)
      metrics = {
        views: count(p.video_play_count ?? p.play_count ?? p.video_view_count),
        likes: count(p.edge_media_preview_like?.count ?? p.like_count),
        comments: count(p.edge_media_to_parent_comment?.count ?? p.comment_count),
        shares: count(p.share_count),
        saves: count(p.save_count),
      }
      title = p.edge_media_to_caption?.edges?.[0]?.node?.text ?? p.caption?.text
      thumbnail =
        p.thumbnail_src ?? p.display_url ?? p.display_uri ?? p.image_versions2?.candidates?.[0]?.url
      publishedAt = date(p.created_at) ?? date(p.taken_at_timestamp ?? p.taken_at, true)
      handle = p.owner?.username ?? p.user?.username
      break
    case 'youtube':
      p = data
      if (!p.id) throw new AnalyticsError('The public page did not return this YouTube video.', 502)
      metrics = {
        views: count(p.viewCountInt),
        likes: count(p.likeCountInt),
        comments: count(p.commentCountInt),
        shares: null,
        saves: null,
      }
      title = p.title
      thumbnail = p.thumbnail
      publishedAt = date(p.publishDate ?? p.publishedTime)
      handle = p.channel?.handle
      break
    case 'facebook':
      p = data
      if (!p.post_id && !p.video_id && !p.id)
        throw new AnalyticsError('The public page did not return this Facebook post.', 502)
      metrics = {
        views: count(p.view_count),
        likes: count(p.like_count),
        comments: count(p.comment_count),
        shares: count(p.share_count),
        saves: null,
      }
      title = p.description
      thumbnail = p.image_url ?? p.thumbnail
      publishedAt = date(p.creation_time ?? p.timestamp)
      handle = p.author?.handle
      break
    case 'x':
      p = data
      if (!p.legacy || !p.rest_id)
        throw new AnalyticsError('The public page did not return this X post.', 502)
      metrics = {
        views: count(p.views?.count),
        likes: count(p.legacy.favorite_count),
        comments: count(p.legacy.reply_count),
        shares: count(p.legacy.retweet_count),
        saves: count(p.legacy.bookmark_count),
      }
      title = p.legacy.full_text
      thumbnail = p.legacy.entities?.media?.[0]?.media_url_https
      publishedAt = date(p.legacy.created_at)
      handle = p.core?.user_results?.result?.legacy?.screen_name
      break
    case 'threads':
      p = data.post ?? data
      if (!p.id && !p.pk)
        throw new AnalyticsError('The public page did not return this Threads post.', 502)
      metrics = {
        views: count(p.view_count),
        likes: count(p.like_count),
        comments: count(p.text_post_app_info?.direct_reply_count ?? p.reply_count),
        shares: count(p.text_post_app_info?.repost_count),
        saves: null,
      }
      title = p.caption?.text
      thumbnail = p.image_versions2?.candidates?.[0]?.url
      publishedAt = date(p.taken_at, true)
      handle = p.user?.username
      break
    case 'snapchat':
      p = data.spotlight ?? data
      if (!p.engagementStats && p.viewCount == null)
        throw new AnalyticsError('The public page did not return this Snapchat Spotlight.', 502)
      metrics = {
        views: count(p.engagementStats?.viewCount ?? p.viewCount),
        likes: count(p.engagementStats?.likeCount),
        comments: count(p.engagementStats?.commentCount ?? p.commentCount),
        shares: count(p.engagementStats?.shareCount ?? p.shareCount),
        saves: null,
      }
      title = p.name ?? p.description
      thumbnail = p.thumbnailUrl
      publishedAt = date(Number(p.uploadDateMs))
      handle = p.creator?.personCreator?.username
      break
  }
  return {
    metrics,
    title: typeof title === 'string' && title.trim() ? title.trim().slice(0, 240) : undefined,
    thumbnail: image(thumbnail),
    publishedAt,
    handle: typeof handle === 'string' ? handle.slice(0, 200) : undefined,
  }
}
