import { createServerFn } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'

export const getAccountSettings = createServerFn({ method: 'GET' }).handler(async () => {
  setResponseHeader('Cache-Control', 'private, no-store')
  const { requireAccount } = await import('./access.server')
  const { db } = await import('./db.server')
  const { isGoogleEnabled } = await import('./auth.server')
  const user = await requireAccount()
  const account = await db.account.findFirst({
    where: { userId: user.id, providerId: 'google' },
    select: { id: true },
  })
  return { name: user.name, email: user.email, googleEnabled: isGoogleEnabled(), googleConnected: Boolean(account) }
})
