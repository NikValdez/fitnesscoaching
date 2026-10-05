import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

export const getCoachingOffering = createServerFn({ method: 'GET' })
  .validator(
    z.object({ sessionId: z.string().max(255).optional(), refresh: z.boolean().optional() }),
  )
  .handler(async ({ data }) => {
    const { getRequestHeaders, setResponseHeader } = await import('@tanstack/react-start/server')
    setResponseHeader('Cache-Control', 'private, no-store')
    setResponseHeader('Referrer-Policy', 'no-referrer')
    const { coachingPageData } = await import('./subscriptions.server')
    return coachingPageData(getRequestHeaders(), data.sessionId, data.refresh)
  })

export type CoachingOfferingData = Awaited<ReturnType<typeof getCoachingOffering>>
