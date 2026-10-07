import { createServerFn } from '@tanstack/react-start'
import type { readMediaWorkspace } from './media.server'
export type MediaWorkspace = Awaited<ReturnType<typeof readMediaWorkspace>>
export type MediaAsset = MediaWorkspace['assets'][number]
export const getMediaWorkspace = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireContentAdmin } = await import('./content.server')
  const { readMediaWorkspace } = await import('./media.server')
  const user = await requireContentAdmin()
  return { user: { name: user.name }, media: await readMediaWorkspace() }
})
