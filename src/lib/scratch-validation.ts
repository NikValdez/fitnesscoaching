import { z } from 'zod'

const reference = { id: z.string().min(1).max(100), revision: z.number().int().nonnegative() }
export const scratchBodySchema = z.string().trim().min(1, 'Write something first.').max(10000)
export const saveScratchSchema = z.object({ body: scratchBodySchema }).strict()
export const editScratchSchema = z.object({ ...reference, body: scratchBodySchema }).strict()
export const deleteScratchSchema = z.object(reference).strict()
export const convertScratchSchema = z
  .object({
    ...reference,
    title: z.string().trim().min(1, 'Give your card a title.').max(160),
    format: z.enum(['VIDEO', 'POST', 'STORY', 'ARTICLE', 'OTHER']),
  })
  .strict()

export function scratchTitle(body: string) {
  return body.trim().split('\n')[0].slice(0, 160)
}
