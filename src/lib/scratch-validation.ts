import { z } from 'zod'

export const scratchPadLimit = 100000
export const saveScratchPadSchema = z
  .object({
    body: z.string().max(scratchPadLimit),
    revision: z.number().int().nonnegative(),
  })
  .strict()
