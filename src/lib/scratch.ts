import { createServerFn } from '@tanstack/react-start'
import {
  saveScratchSchema,
  editScratchSchema,
  deleteScratchSchema,
  convertScratchSchema,
} from './scratch-validation'

export const getScratchWorkspace = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireContentAdmin } = await import('./content.server')
  const { db } = await import('./db.server')
  const user = await requireContentAdmin()
  const ideas = await db.contentScratch.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: { card: { select: { id: true, title: true, stage: true } } },
  })
  return { user: { name: user.name }, ideas }
})

const includeCard = { card: { select: { id: true, title: true, stage: true } } } as const
const conflict =
  'This idea changed in another tab. Refresh ideas and try again; your draft is still here.'

export const saveScratch = createServerFn({ method: 'POST' })
  .validator(saveScratchSchema)
  .handler(async ({ data }) => {
    const { requireContentAdmin } = await import('./content.server')
    const { db } = await import('./db.server')
    const user = await requireContentAdmin()
    return db.contentScratch.create({
      data: { body: data.body, authorId: user.id },
      include: includeCard,
    })
  })

export const editScratch = createServerFn({ method: 'POST' })
  .validator(editScratchSchema)
  .handler(async ({ data }) => {
    const { requireContentAdmin } = await import('./content.server')
    const { db } = await import('./db.server')
    await requireContentAdmin()
    return db.$transaction(async (tx) => {
      const result = await tx.contentScratch.updateMany({
        where: { id: data.id, revision: data.revision },
        data: { body: data.body, revision: { increment: 1 } },
      })
      if (!result.count) throw new Error(conflict)
      return tx.contentScratch.findUniqueOrThrow({ where: { id: data.id }, include: includeCard })
    })
  })

export const deleteScratch = createServerFn({ method: 'POST' })
  .validator(deleteScratchSchema)
  .handler(async ({ data }) => {
    const { requireContentAdmin } = await import('./content.server')
    const { db } = await import('./db.server')
    await requireContentAdmin()
    const result = await db.contentScratch.deleteMany({
      where: { id: data.id, revision: data.revision },
    })
    if (!result.count) throw new Error(conflict)
    return { id: data.id }
  })

export const convertScratch = createServerFn({ method: 'POST' })
  .validator(convertScratchSchema)
  .handler(async ({ data }) => {
    const { requireContentAdmin } = await import('./content.server')
    const { db } = await import('./db.server')
    const user = await requireContentAdmin()
    return db.$transaction(
      async (tx) => {
        // Use the board's write lock so conversion and card ordering stay atomic.
        await tx.contentBoard.update({
          where: { id: 'main' },
          data: { revision: { increment: 1 } },
        })
        const idea = await tx.contentScratch.findUnique({
          where: { id: data.id },
          include: includeCard,
        })
        if (!idea) throw new Error('This idea no longer exists. Refresh ideas.')
        // Repeated submissions return the same card, including from another admin.
        if (idea.card) return idea
        const lock = await tx.contentScratch.updateMany({
          where: { id: data.id, revision: data.revision },
          data: { revision: { increment: 1 } },
        })
        if (!lock.count) throw new Error(conflict)
        const last = await tx.contentIdea.aggregate({
          where: { boardId: 'main', stage: 'CONCEPTS' },
          _max: { position: true },
        })
        const card = await tx.contentIdea.create({
          data: {
            title: data.title,
            notes: idea.body,
            format: data.format,
            stage: 'CONCEPTS',
            position: (last._max.position ?? -1) + 1,
            authorId: user.id,
          },
        })
        return tx.contentScratch.update({
          where: { id: idea.id },
          data: { cardId: card.id },
          include: includeCard,
        })
      },
      { timeout: 15000 },
    )
  })
