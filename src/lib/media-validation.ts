import { z } from 'zod'

export const MEDIA_PART_SIZE = 16 * 1024 * 1024
export const MEDIA_MAX_SIZE = 10 * 1024 ** 3
export const MEDIA_THUMBNAIL_MAX_BYTES = 150 * 1024
export const mediaThumbnailKey = (id: string) => `clips/${id}/thumbnail.jpg`
export const mediaCategories = [
  { id: 'RAW', label: 'Raw footage' },
  { id: 'DEMOS', label: 'Exercise demos' },
  { id: 'BROLL', label: 'B-roll' },
  { id: 'FINISHED', label: 'Finished content' },
] as const
export const mediaAccept = '.mp4,.mov,.m4v,.webm,.mkv,.avi'
const types: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
}
export function mediaContentType(filename: string) {
  return types[filename.split('.').pop()?.toLowerCase() ?? ''] ?? null
}
const fields = {
  title: z.string().trim().min(1, 'Give the clip a title.').max(160),
  notes: z.string().trim().max(4000),
  category: z.enum(['RAW', 'DEMOS', 'BROLL', 'FINISHED']),
  tags: z
    .array(z.string().trim().min(1).max(40))
    .max(12)
    .transform((tags) => [...new Set(tags.map((tag) => tag.toLowerCase()))]),
  cardId: z.string().min(1).max(100).nullable(),
}
export const mediaStartSchema = z
  .object({
    action: z.literal('start'),
    id: z.uuid(),
    filename: z
      .string()
      .trim()
      .min(1)
      .max(240)
      .refine((name) => !/[\x00-\x1f\x7f/\\]/.test(name), 'Invalid filename.')
      .refine(
        (name) => !!mediaContentType(name),
        'Choose an MP4, MOV, M4V, WebM, MKV, or AVI video.',
      ),
    size: z.number().int().min(1).max(MEDIA_MAX_SIZE, 'Clips can be up to 10 GB.'),
    lastModified: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    ...fields,
  })
  .strict()
export const mediaActionSchema = z.discriminatedUnion('action', [
  mediaStartSchema,
  z.object({ action: z.literal('complete'), id: z.uuid() }).strict(),
  z.object({ action: z.literal('abort'), id: z.uuid() }).strict(),
  z
    .object({ action: z.literal('delete'), id: z.uuid(), expectedUpdatedAt: z.iso.datetime() })
    .strict(),
  z
    .object({
      action: z.literal('edit'),
      id: z.uuid(),
      expectedUpdatedAt: z.iso.datetime(),
      ...fields,
    })
    .strict(),
])
export type MediaAction = z.input<typeof mediaActionSchema>
export function partLength(size: number, part: number) {
  if (!Number.isSafeInteger(part) || part < 1 || part > Math.ceil(size / MEDIA_PART_SIZE)) return 0
  return Math.min(MEDIA_PART_SIZE, size - (part - 1) * MEDIA_PART_SIZE)
}
export function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  const unit = Math.min(3, Math.floor(Math.log(size) / Math.log(1024)))
  return `${(size / 1024 ** unit).toFixed(unit === 1 ? 0 : 1)} ${['B', 'KB', 'MB', 'GB'][unit]}`
}
// Single byte ranges cover native browser seeking and original-file downloads.
export function mediaRange(
  value: string | null,
  size: number,
): { offset: number; length: number } | null | false {
  if (!value) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(value)
  if (!match || (!match[1] && !match[2])) return false
  if (!match[1]) {
    const suffix = Number(match[2])
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return false
    const length = Math.min(size, suffix)
    return { offset: size - length, length }
  }
  const offset = Number(match[1])
  const end = match[2] ? Number(match[2]) : size - 1
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(end) || offset >= size || end < offset)
    return false
  return { offset, length: Math.min(size - 1, end) - offset + 1 }
}
