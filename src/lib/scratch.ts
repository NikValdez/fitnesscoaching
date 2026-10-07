import { createServerFn } from '@tanstack/react-start'
import { saveScratchPadSchema } from './scratch-validation'

export const getScratchWorkspace = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireContentAdmin } = await import('./content.server')
  const user = await requireContentAdmin()
  return { user: { name: user.name } }
})

export const saveScratchPad = createServerFn({ method: 'POST' })
  .validator(saveScratchPadSchema)
  .handler(async () => {
    const { requireContentAdmin } = await import('./content.server')
    await requireContentAdmin()
    // Older open tabs must not replace a document that is now collaboratively edited.
    throw new Error(
      'The scratch pad now supports live collaboration. Copy any unsaved writing, then refresh this page.',
    )
  })
