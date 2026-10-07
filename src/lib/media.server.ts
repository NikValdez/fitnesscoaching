import { env } from 'cloudflare:workers'
import type { Prisma } from '../generated/prisma/client'
import { db } from './db.server'
import { notifyStudioChange } from './content.server'
import { completeR2Upload, abortR2Upload } from './media-storage'
import {
  MEDIA_PART_SIZE,
  MEDIA_THUMBNAIL_MAX_BYTES,
  mediaContentType,
  mediaThumbnailKey,
  partLength,
  type MediaAction,
} from './media-validation'

export class MediaError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}
export function mediaBucket() {
  if (!env.SHARED_MEDIA) throw new MediaError('Shared media storage is not connected yet.', 503)
  return env.SHARED_MEDIA
}
const assetInclude = {
  parts: { orderBy: { partNumber: 'asc' as const } },
  card: { select: { id: true, title: true } },
}
export async function readMediaWorkspace() {
  const result = await db.$transaction(
    async (tx) => ({
      library: await tx.mediaLibrary.findUniqueOrThrow({ where: { id: 'main' } }),
      assets: await tx.mediaAsset.findMany({
        include: assetInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),
      cards: await tx.contentIdea.findMany({
        where: { boardId: 'main' },
        select: { id: true, title: true },
        orderBy: { title: 'asc' },
      }),
    }),
    { isolationLevel: 'RepeatableRead' },
  )
  return {
    revision: result.library.revision,
    configured: !!env.SHARED_MEDIA,
    assets: result.assets.map(
      ({ size, uploadId: _uploadId, objectKey: _objectKey, parts, ...asset }) => ({
        ...asset,
        size: Number(size),
        parts: parts.map((part) => part.partNumber),
      }),
    ),
    cards: result.cards,
    partSize: MEDIA_PART_SIZE,
  }
}
async function changed(tx: Prisma.TransactionClient) {
  await tx.mediaLibrary.update({ where: { id: 'main' }, data: { revision: { increment: 1 } } })
}
async function lockAsset(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "rossiter_media_asset" WHERE "id" = ${id} FOR UPDATE`
  const asset = await tx.mediaAsset.findUnique({
    where: { id },
    include: { parts: { orderBy: { partNumber: 'asc' } } },
  })
  if (!asset) throw new MediaError('This clip was removed. Refresh shared media.', 404)
  return asset
}
async function checkCard(tx: Prisma.TransactionClient, cardId: string | null) {
  if (cardId && !(await tx.contentIdea.findFirst({ where: { id: cardId, boardId: 'main' } })))
    throw new MediaError('This production card was removed. Choose another card.')
}
function assertUpload(asset: { status: string; expiresAt: Date; uploadId: string | null }) {
  if (asset.status !== 'UPLOADING' || !asset.uploadId)
    throw new MediaError('This upload is no longer accepting parts. Refresh shared media.', 409)
  if (asset.expiresAt <= new Date())
    throw new MediaError('This upload expired. Cancel it and upload the clip again.', 410)
}

export async function startMediaUpload(data: Extract<MediaAction, { action: 'start' }>) {
  const bucket = mediaBucket()
  await db.$transaction(
    async (tx) => {
      // Lock the singleton so duplicate start requests with the same id cannot create two rows.
      await tx.mediaLibrary.update({ where: { id: 'main' }, data: { revision: { increment: 1 } } })
      const existing = await tx.mediaAsset.findUnique({ where: { id: data.id } })
      if (existing) {
        if (
          existing.filename !== data.filename ||
          Number(existing.size) !== data.size ||
          existing.lastModified !== data.lastModified
        )
          throw new MediaError('This upload belongs to a different file.', 409)
        if (existing.status !== 'UPLOADING' && existing.status !== 'READY')
          throw new MediaError('This upload cannot be resumed.', 409)
        return
      }
      await checkCard(tx, data.cardId)
      const { action: _action, ...values } = data
      await tx.mediaAsset.create({
        data: {
          ...values,
          size: BigInt(data.size),
          objectKey: `clips/${data.id}/original`,
          contentType: mediaContentType(data.filename)!,
          expiresAt: new Date(Date.now() + 6 * 86400000),
        },
      })
    },
    { timeout: 15000 },
  )
  const session = await db.$transaction(
    async (tx) => {
      const asset = await lockAsset(tx, data.id)
      if (asset.status !== 'UPLOADING' && asset.status !== 'READY')
        throw new MediaError('This upload cannot be resumed.', 409)
      if (!asset.uploadId && asset.status !== 'READY') {
        const upload = await bucket.createMultipartUpload(asset.objectKey, {
          httpMetadata: { contentType: asset.contentType, cacheControl: 'private, no-store' },
          customMetadata: { assetid: asset.id },
        })
        await tx.mediaAsset.update({ where: { id: data.id }, data: { uploadId: upload.uploadId } })
      }
      return {
        id: asset.id,
        status: asset.status,
        parts: asset.parts.map((part) => part.partNumber),
      }
    },
    { timeout: 30000 },
  )
  await notifyStudioChange('media')
  return session
}

export async function uploadMediaPart(id: string, partNumber: number, request: Request) {
  const bucket = mediaBucket()
  // Check authorization/state and declared size before reading any file bytes.
  const initial = await db.mediaAsset.findUnique({ where: { id } })
  if (!initial) throw new MediaError('Upload not found.', 404)
  assertUpload(initial)
  const length = partLength(Number(initial.size), partNumber)
  if (!length) throw new MediaError('Invalid upload part.')
  const declared = request.headers.get('Content-Length')
  if (declared && Number(declared) !== length)
    throw new MediaError('This chunk has the wrong size.')
  // Bound even chunked requests rather than trusting Content-Length.
  if (!request.body) throw new MediaError('No file data received.')
  const reader = request.body.getReader()
  const bytes = new Uint8Array(length)
  let received = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      if (received + next.value.byteLength > length)
        throw new MediaError('This chunk is too large.', 413)
      bytes.set(next.value, received)
      received += next.value.byteLength
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  if (received !== length) throw new MediaError('The upload was interrupted. Retry this clip.')
  // Serialize parts, finalization, and cancellation for this asset. The lock is
  // acquired after receiving bytes, so slow client connections never hold a DB lock.
  return db.$transaction(
    async (tx) => {
      const asset = await lockAsset(tx, id)
      assertUpload(asset)
      const uploaded = await bucket
        .resumeMultipartUpload(asset.objectKey, asset.uploadId!)
        .uploadPart(partNumber, bytes)
      await tx.mediaUploadPart.upsert({
        where: { assetId_partNumber: { assetId: id, partNumber } },
        create: { assetId: id, ...uploaded },
        update: { etag: uploaded.etag },
      })
      return { partNumber }
    },
    { timeout: 30000 },
  )
}

async function completeMediaUpload(id: string) {
  const bucket = mediaBucket()
  await db.$transaction(
    async (tx) => {
      const asset = await lockAsset(tx, id)
      if (asset.status === 'READY') return
      assertUpload(asset)
      const count = Math.ceil(Number(asset.size) / MEDIA_PART_SIZE)
      if (
        asset.parts.length !== count ||
        asset.parts.some((part, index) => part.partNumber !== index + 1)
      )
        throw new MediaError('Some chunks are missing. Resume the upload before finishing.', 409)
      const object = await completeR2Upload(
        bucket,
        asset.objectKey,
        asset.uploadId!,
        asset.parts.map(({ partNumber, etag }) => ({ partNumber, etag })),
      )
      const marker = object?.customMetadata?.assetid ?? object?.customMetadata?.assetId
      if (!object || object.size !== Number(asset.size) || marker !== asset.id) {
        console.error('Shared media object verification failed', {
          assetId: asset.id,
          expectedSize: Number(asset.size),
          storedSize: object?.size,
          metadataKeys: Object.keys(object?.customMetadata ?? {}),
        })
        throw new MediaError(
          'The stored file did not match this upload. Cancel it and upload again.',
          409,
        )
      }
      await tx.mediaAsset.update({ where: { id }, data: { status: 'READY', uploadId: null } })
      await tx.mediaUploadPart.deleteMany({ where: { assetId: id } })
      await changed(tx)
    },
    { timeout: 30000 },
  )
}

export async function saveMediaThumbnail(id: string, request: Request) {
  const initial = await db.mediaAsset.findUnique({ where: { id }, select: { status: true } })
  if (initial?.status !== 'READY') throw new MediaError('Clip not found.', 404)
  if (request.headers.get('Content-Type') !== 'image/jpeg')
    throw new MediaError('Expected a JPEG thumbnail.', 415)
  const declared = Number(request.headers.get('Content-Length'))
  if (declared > MEDIA_THUMBNAIL_MAX_BYTES) throw new MediaError('Thumbnail is too large.', 413)
  if (!request.body) throw new MediaError('No thumbnail received.')
  const reader = request.body.getReader()
  const bytes = new Uint8Array(MEDIA_THUMBNAIL_MAX_BYTES)
  let size = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      if (size + next.value.byteLength > bytes.length)
        throw new MediaError('Thumbnail is too large.', 413)
      bytes.set(next.value, size)
      size += next.value.byteLength
    }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
  if (
    size < 4 ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8 ||
    bytes[2] !== 0xff ||
    bytes[size - 2] !== 0xff ||
    bytes[size - 1] !== 0xd9
  )
    throw new MediaError('Invalid JPEG thumbnail.')
  await db.$transaction(
    async (tx) => {
      // Share the original's lock so late frame generation cannot leave a
      // thumbnail behind after another admin deletes the clip.
      const asset = await lockAsset(tx, id)
      if (asset.status !== 'READY') throw new MediaError('Clip not found.', 404)
      const bucket = mediaBucket(),
        key = mediaThumbnailKey(id)
      if (await bucket.head(key)) return
      await bucket.put(key, bytes.subarray(0, size), {
        httpMetadata: { contentType: 'image/jpeg', cacheControl: 'private, no-store' },
        customMetadata: { assetid: id },
      })
    },
    { timeout: 30000 },
  )
}

async function removeMedia(id: string, expectedUpdatedAt?: string) {
  mediaBucket()
  // Save the deletion intent before touching R2. Failed deletions stay retryable
  // and the daily cleanup retries them even when the browser has been closed.
  await db.$transaction(
    async (tx) => {
      const asset = await lockAsset(tx, id)
      if (asset.status === 'DELETING') return
      if (expectedUpdatedAt) {
        if (asset.status !== 'READY' || asset.updatedAt.toISOString() !== expectedUpdatedAt)
          throw new MediaError(
            'This clip changed in another admin’s session. Refresh before deleting it.',
            409,
          )
      } else if (asset.status === 'READY')
        throw new MediaError('Uploaded clips must be deleted from the library.', 409)
      await tx.mediaAsset.update({ where: { id }, data: { status: 'DELETING' } })
      await changed(tx)
    },
    { timeout: 15000 },
  )
  await purgeMedia(id)
}
async function purgeMedia(id: string) {
  const bucket = mediaBucket()
  await db.$transaction(
    async (tx) => {
      const asset = await lockAsset(tx, id)
      if (asset.status !== 'DELETING') return
      if (asset.uploadId) {
        // An already completed/aborted multipart upload has no remaining parts.
        await abortR2Upload(bucket.resumeMultipartUpload(asset.objectKey, asset.uploadId))
      }
      await bucket.delete([asset.objectKey, mediaThumbnailKey(id)])
      await tx.mediaAsset.delete({ where: { id } })
      await changed(tx)
    },
    { timeout: 30000 },
  )
}

export async function mutateMedia(data: MediaAction) {
  if (data.action === 'start') return startMediaUpload(data)
  if (data.action === 'complete') await completeMediaUpload(data.id)
  else if (data.action === 'abort') await removeMedia(data.id)
  else if (data.action === 'delete') await removeMedia(data.id, data.expectedUpdatedAt)
  else if (data.action === 'edit') {
    const { action: _action, id, expectedUpdatedAt, ...values } = data
    await db.$transaction(
      async (tx) => {
        const asset = await lockAsset(tx, id)
        if (asset.status !== 'READY' || asset.updatedAt.toISOString() !== expectedUpdatedAt)
          throw new MediaError(
            'Another admin changed this clip. Your draft is still here. Close and reopen it to review their changes.',
            409,
          )
        await checkCard(tx, data.cardId)
        await tx.mediaAsset.update({ where: { id }, data: values })
        await changed(tx)
      },
      { timeout: 15000 },
    )
  }
  await notifyStudioChange('media')
  return { id: data.id }
}

export async function cleanupMedia() {
  const pending = await db.mediaAsset.findMany({
    where: {
      OR: [{ status: 'DELETING' }, { status: 'UPLOADING', expiresAt: { lte: new Date() } }],
    },
    select: { id: true },
    take: 100,
  })
  for (const asset of pending) {
    try {
      await removeMedia(asset.id)
    } catch (error) {
      console.error('Shared media cleanup failed', asset.id, error)
    }
  }
  if (pending.length) await notifyStudioChange('media')
}
