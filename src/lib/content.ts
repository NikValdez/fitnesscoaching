import { createServerFn } from '@tanstack/react-start'
import {
  saveContentIdeaSchema,
  moveContentIdeaSchema,
  deleteContentIdeaSchema,
} from './content-validation'

export const getContentWorkspace = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireContentAdmin, readContentBoard } = await import('./content.server')
  const user = await requireContentAdmin()
  return { user: { name: user.name }, board: await readContentBoard() }
})

export const saveContentIdea = createServerFn({ method: 'POST' })
  .validator(saveContentIdeaSchema)
  .handler(async ({ data }) => {
    const { requireContentAdmin, updateContentBoard } = await import('./content.server')
    const user = await requireContentAdmin()
    return updateContentBoard(data.revision, async (tx) => {
      const { id, revision: _revision, ...values } = data
      const existing = id
        ? await tx.contentIdea.findFirst({ where: { id, boardId: 'main' } })
        : null
      if (id && !existing) throw new Error('This idea no longer exists. Refresh the board.')
      let position = existing?.position ?? 0
      if (!existing || existing.stage !== values.stage) {
        const last = await tx.contentIdea.aggregate({
          where: { boardId: 'main', stage: values.stage },
          _max: { position: true },
        })
        position = (last._max.position ?? -1) + 1
      }
      if (id) return tx.contentIdea.update({ where: { id }, data: { ...values, position } })
      return tx.contentIdea.create({ data: { ...values, position, authorId: user.id } })
    })
  })

export const moveContentIdea = createServerFn({ method: 'POST' })
  .validator(moveContentIdeaSchema)
  .handler(async ({ data }) => {
    const { requireContentAdmin, updateContentBoard } = await import('./content.server')
    await requireContentAdmin()
    return updateContentBoard(data.revision, async (tx) => {
      const idea = await tx.contentIdea.findFirst({ where: { id: data.id, boardId: 'main' } })
      if (!idea) throw new Error('This idea no longer exists. Refresh the board.')
      const target = await tx.contentIdea.findMany({
        where: { boardId: 'main', stage: data.stage, id: { not: data.id } },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      })
      const index =
        data.beforeId === null
          ? target.length
          : target.findIndex((item) => item.id === data.beforeId)
      if (index < 0) throw new Error('The destination changed. Refresh the board and try again.')
      target.splice(index, 0, idea)
      for (const [position, item] of target.entries()) {
        if (item.position !== position || item.stage !== data.stage) {
          await tx.contentIdea.update({
            where: { id: item.id },
            data: { position, stage: data.stage },
          })
        }
      }
    })
  })

export const deleteContentIdea = createServerFn({ method: 'POST' })
  .validator(deleteContentIdeaSchema)
  .handler(async ({ data }) => {
    const { requireContentAdmin, updateContentBoard } = await import('./content.server')
    await requireContentAdmin()
    return updateContentBoard(data.revision, async (tx) => {
      const result = await tx.contentIdea.deleteMany({ where: { id: data.id, boardId: 'main' } })
      if (!result.count) throw new Error('This idea no longer exists. Refresh the board.')
    })
  })
