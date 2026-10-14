import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { analyticsActionSchema } from './analytics-validation'

export const getAnalyticsWorkspace = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireContentAdmin } = await import('./content.server')
  const user = await requireContentAdmin()
  const { AnalyticsService } = await import('./analytics.server')
  const { db } = await import('./db.server')
  return {
    user: { name: user.name },
    analytics: await new AnalyticsService().workspace(),
    board: await db.contentIdea.findMany({
      select: { id: true, title: true },
      orderBy: { title: 'asc' },
    }),
  }
})

export const getAnalyticsHistory = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.string().uuid() }).strict())
  .handler(async ({ data }) => {
    const { requireContentAdmin } = await import('./content.server')
    await requireContentAdmin()
    const { AnalyticsService } = await import('./analytics.server')
    return new AnalyticsService().history(data.id)
  })

export const mutateAnalytics = createServerFn({ method: 'POST' })
  .validator(analyticsActionSchema)
  .handler(async ({ data }) => {
    const { requireContentAdmin } = await import('./content.server')
    await requireContentAdmin()
    const { AnalyticsService } = await import('./analytics.server')
    return new AnalyticsService().execute(data)
  })
