import { getAuth } from './auth.server'
import { db } from './db.server'
import { MediaError, mediaBucket } from './media.server'
import { mediaRange, mediaThumbnailKey } from './media-validation'

export const mediaPrivateHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, noarchive',
  'Cross-Origin-Resource-Policy': 'same-origin',
}
export async function authorizeMedia(request: Request, mutation = false) {
  if (
    mutation &&
    (request.headers.get('Origin') !== new URL(request.url).origin ||
      request.headers.get('Sec-Fetch-Site') === 'cross-site')
  )
    throw new MediaError('This request must come from the admin workspace.', 403)
  const session = await getAuth().api.getSession({ headers: request.headers })
  if (!session) throw new MediaError('Sign in again to continue.', 401)
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (user?.role !== 'ADMIN') throw new MediaError('Admin access required.', 403)
}
export async function mediaResponse(handler: () => Promise<Response>) {
  try {
    return await handler()
  } catch (error) {
    if (!(error instanceof MediaError)) console.error('Shared media request failed', error)
    return Response.json(
      {
        error:
          error instanceof MediaError
            ? error.message
            : 'Could not complete this request. Please retry.',
      },
      {
        status: error instanceof MediaError ? error.status : 500,
        headers: mediaPrivateHeaders,
      },
    )
  }
}
export async function serveMedia(request: Request, id: string) {
  await authorizeMedia(request)
  const asset = await db.mediaAsset.findUnique({ where: { id } })
  if (asset?.status !== 'READY') throw new MediaError('Clip not found.', 404)
  if (new URL(request.url).searchParams.has('thumbnail')) {
    const bucket = mediaBucket(),
      key = mediaThumbnailKey(id)
    const object = request.method === 'HEAD' ? await bucket.head(key) : await bucket.get(key)
    if (!object) throw new MediaError('Thumbnail not generated yet.', 404)
    return new Response('body' in object ? (object as R2ObjectBody).body : null, {
      headers: {
        ...mediaPrivateHeaders,
        'Content-Type': 'image/jpeg',
        'Content-Length': String(object.size),
        ETag: object.httpEtag,
      },
    })
  }
  const size = Number(asset.size)
  const range = mediaRange(request.headers.get('Range'), size)
  if (range === false)
    return new Response(null, {
      status: 416,
      headers: {
        ...mediaPrivateHeaders,
        'Content-Range': `bytes */${size}`,
        'Accept-Ranges': 'bytes',
      },
    })
  const bucket = mediaBucket()
  const object =
    request.method === 'HEAD'
      ? await bucket.head(asset.objectKey)
      : await bucket.get(asset.objectKey, range ? { range } : undefined)
  if (!object)
    throw new MediaError(
      'The original file is unavailable. Please contact the site administrator.',
      404,
    )
  const download = new URL(request.url).searchParams.has('download')
  const filename = encodeURIComponent(asset.filename).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )
  const headers = new Headers({
    ...mediaPrivateHeaders,
    'Content-Type': asset.contentType,
    'Accept-Ranges': 'bytes',
    'Content-Length': String(range ? range.length : size),
    'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${asset.filename.replace(/[^a-zA-Z0-9._ -]/g, '_')}"; filename*=UTF-8''${filename}`,
    ETag: object.httpEtag,
  })
  if (range)
    headers.set('Content-Range', `bytes ${range.offset}-${range.offset + range.length - 1}/${size}`)
  return new Response('body' in object ? (object as R2ObjectBody).body : null, {
    status: range ? 206 : 200,
    headers,
  })
}
