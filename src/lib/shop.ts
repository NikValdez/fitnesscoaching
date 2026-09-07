import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

export const getShop = createServerFn({ method: 'GET' }).handler(async () => {
  const { checkoutConfiguration } = await import('./commerce.server')
  return checkoutConfiguration()
})

export const getPurchase = createServerFn({ method: 'GET' })
  .validator(z.object({ sessionId: z.string().max(255) }))
  .handler(async ({ data }) => {
    const { setResponseHeader } = await import('@tanstack/react-start/server')
    setResponseHeader('Cache-Control', 'private, no-store')
    setResponseHeader('Referrer-Policy', 'no-referrer')
    const { fulfillPurchase, checkoutConfiguration } = await import('./commerce.server')
    if (!checkoutConfiguration().enabled) return { status: 'unavailable' as const, testMode: false }
    try {
      return {
        status: await fulfillPurchase(data.sessionId),
        testMode: checkoutConfiguration().testMode,
      }
    } catch {
      return { status: 'unavailable' as const, testMode: checkoutConfiguration().testMode }
    }
  })
