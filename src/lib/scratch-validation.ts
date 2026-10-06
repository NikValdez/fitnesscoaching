import { z } from 'zod'
import { richTextPlainText, validRichDocument } from './rich-text'

export const scratchPadLimit = 100000
export const saveScratchPadSchema = z
  .object({
    body: z.string().max(scratchPadLimit),
    document: z.string().max(1000000).optional(),
    revision: z.number().int().nonnegative(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.document === undefined) return true
      try {
        const document: unknown = JSON.parse(data.document)
        return validRichDocument(document) && richTextPlainText(document) === data.body
      } catch {
        return false
      }
    },
    { message: 'The scratch pad contains unsupported formatting.' },
  )
