import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  deleteLibraryEntrySchema,
  saveLibraryEntrySchema,
  parseVideoLink,
} from './library-validation'

export const getLibraryWorkspace = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireContentAdmin } = await import('./content.server')
  const { readContentLibrary } = await import('./library.server')
  const user = await requireContentAdmin()
  return { user: { name: user.name }, library: await readContentLibrary() }
})

export const getLibraryPreview = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.string().min(1).max(100) }).strict())
  .handler(async ({ data }) => {
    const { requireContentAdmin } = await import('./content.server')
    await requireContentAdmin()
    const { db } = await import('./db.server')
    const { resolveVideoEmbedUrl } = await import('./video-preview.server')
    const entry = await db.contentLibraryEntry.findFirst({
      where: { id: data.id, libraryId: 'main' },
    })
    if (!entry) throw new Error('This link was removed. Refresh the library.')
    return { src: await resolveVideoEmbedUrl(entry.url), url: entry.url }
  })

export const saveLibraryEntry = createServerFn({ method: 'POST' })
  .validator(saveLibraryEntrySchema)
  .handler(async ({ data }) => {
    const { requireContentAdmin } = await import('./content.server')
    const { updateContentLibrary } = await import('./library.server')
    await requireContentAdmin()
    return updateContentLibrary(data.revision, async (tx) => {
      const link = parseVideoLink(data.url)!
      const existing = data.id
        ? await tx.contentLibraryEntry.findFirst({ where: { id: data.id, libraryId: 'main' } })
        : null
      if (data.id && !existing) throw new Error('This link was removed. Refresh the library.')
      if (existing && existing.updatedAt.toISOString() !== data.expectedUpdatedAt)
        throw new Error(
          'This link was edited by another admin. Your draft is still here. Close it and reopen the link to review the latest changes.',
        )
      const duplicate = await tx.contentLibraryEntry.findFirst({
        where: {
          libraryId: 'main',
          url: link.url,
          ...(data.id ? { id: { not: data.id } } : {}),
        },
      })
      if (duplicate)
        throw new Error(`This video is already in the library as “${duplicate.title}”.`)
      const values = {
        ...link,
        title:
          data.title || `${link.platform === 'INSTAGRAM' ? 'Instagram' : 'TikTok'} inspiration`,
        notes: data.notes,
      }
      return existing
        ? tx.contentLibraryEntry.update({ where: { id: existing.id }, data: values })
        : tx.contentLibraryEntry.create({ data: values })
    })
  })

export const deleteLibraryEntry = createServerFn({ method: 'POST' })
  .validator(deleteLibraryEntrySchema)
  .handler(async ({ data }) => {
    const { requireContentAdmin } = await import('./content.server')
    const { updateContentLibrary } = await import('./library.server')
    await requireContentAdmin()
    return updateContentLibrary(data.revision, async (tx) => {
      const removed = await tx.contentLibraryEntry.deleteMany({
        where: {
          id: data.id,
          libraryId: 'main',
          updatedAt: new Date(data.expectedUpdatedAt),
        },
      })
      if (!removed.count)
        throw new Error(
          'This link was changed or removed by another admin. Refresh the library before deleting it.',
        )
    })
  })
