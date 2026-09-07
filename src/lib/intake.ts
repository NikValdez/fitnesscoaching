import { createServerFn } from '@tanstack/react-start'
import { intakeSchema } from './intake-validation'

export const getIntake = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireClient } = await import('./access.server')
  const { setResponseHeader } = await import('@tanstack/react-start/server')
  setResponseHeader('Cache-Control', 'private, no-store')
  const user = await requireClient({ allowIncomplete: true })
  const { db } = await import('./db.server')
  const intake = await db.clientIntake.findUnique({
    where: { userId: user.id },
    include: { interests: true },
  })
  return { user, intake }
})

export const saveIntake = createServerFn({ method: 'POST' })
  .validator(intakeSchema)
  .handler(async ({ data }) => {
    const { requireClient } = await import('./access.server')
    const user = await requireClient({ allowIncomplete: true })
    const { db } = await import('./db.server')
    const { interests, ...input } = data
    const values = { ...input, phone: input.phone || null }
    // The owner comes only from the session. Replacing selected services is atomic.
    await db.clientIntake.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...values, interests: { create: interests } },
      update: { ...values, interests: { deleteMany: {}, create: interests } },
    })
    return { ok: true }
  })
