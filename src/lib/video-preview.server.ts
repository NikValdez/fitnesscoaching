import { parseVideoLink } from './library-validation'
import { videoEmbedUrl } from './video-preview'

const unavailable = 'This video cannot be previewed here. Open the original video to watch it.'

export async function resolveVideoEmbedUrl(value: string, request: typeof fetch = fetch) {
  let link = parseVideoLink(value)
  if (!link) throw new Error(unavailable)
  const direct = videoEmbedUrl(link.url)
  if (direct) return direct

  const visited = new Set<string>()
  const signal = AbortSignal.timeout(8000)
  for (let hop = 0; hop < 5; hop++) {
    if (!link || link.platform !== 'TIKTOK' || visited.has(link.url)) break
    visited.add(link.url)
    let response: Response
    try {
      response = await request(link.url, { redirect: 'manual', signal })
    } catch {
      throw new Error(unavailable)
    }
    const location = response.headers.get('location')
    await response.body?.cancel()
    if (![301, 302, 303, 307, 308].includes(response.status) || !location) break
    try {
      // Validate every redirect before any request; never follow arbitrary hosts.
      link = parseVideoLink(new URL(location, link.url).href)
    } catch {
      break
    }
    if (!link || link.platform !== 'TIKTOK') break
    const embed = videoEmbedUrl(link.url)
    if (embed) return embed
  }
  throw new Error(unavailable)
}
