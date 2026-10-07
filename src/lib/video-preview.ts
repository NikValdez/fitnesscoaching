import { parseVideoLink } from './library-validation'

export function videoEmbedUrl(value: string): string | null {
  const link = parseVideoLink(value)
  if (!link) return null
  if (link.platform === 'INSTAGRAM') return `${link.url.replace('/reels/', '/reel/')}embed/`
  const id = new URL(link.url).pathname.match(/^\/@[^/]+\/video\/(\d+)\/$/)?.[1]
  return id ? `https://www.tiktok.com/player/v1/${id}?autoplay=0&rel=0` : null
}
