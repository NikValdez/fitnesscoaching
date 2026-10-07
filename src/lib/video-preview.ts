import { parseLibraryLink } from './library-validation'

export function supportsVideoPreview(platform: string) {
  return ['INSTAGRAM', 'TIKTOK', 'YOUTUBE'].includes(platform)
}

export function videoEmbedUrl(value: string): string | null {
  const link = parseLibraryLink(value)
  if (!link) return null
  if (link.platform === 'INSTAGRAM') return `${link.url.replace('/reels/', '/reel/')}embed/`
  if (link.platform === 'YOUTUBE')
    return `https://www.youtube.com/embed/${new URL(link.url).searchParams.get('v')}?autoplay=0&rel=0`
  if (link.platform !== 'TIKTOK') return null
  const id = new URL(link.url).pathname.match(/^\/@[^/]+\/video\/(\d+)\/$/)?.[1]
  return id ? `https://www.tiktok.com/player/v1/${id}?autoplay=0&rel=0` : null
}
