import { createServerFn } from '@tanstack/react-start'
import { saveScratchPadSchema } from './scratch-validation'

export const getScratchWorkspace = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireContentAdmin } = await import('./content.server')
  const { db } = await import('./db.server')
  const user = await requireContentAdmin()
  const pad = await db.contentPad.findUniqueOrThrow({ where: { id: 'main' } })
  return { user: { name: user.name }, pad }
})

export const saveScratchPad = createServerFn({ method: 'POST' })
  .validator(saveScratchPadSchema)
  .handler(async ({ data }) => {
    const { requireContentAdmin } = await import('./content.server')
    const { db } = await import('./db.server')
    await requireContentAdmin()
    return db.$transaction(async (tx) => {
      const result = await tx.contentPad.updateMany({
        where: { id: 'main', revision: data.revision },
        data: { body: data.body, document: data.document ?? null, revision: { increment: 1 } },
      })
      const pad = await tx.contentPad.findUniqueOrThrow({ where: { id: 'main' } })
      // A lost response can be retried safely. Different stale text needs review.
      return {
        status:
          result.count || (pad.body === data.body && pad.document === (data.document ?? null))
            ? ('saved' as const)
            : ('conflict' as const),
        pad,
      }
    })
  })
