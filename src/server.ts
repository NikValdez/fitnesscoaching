import handler from '@tanstack/react-start/server-entry'
import { withIsolatedDatabaseRequest } from './lib/db.server'
import { AnalyticsService } from './lib/analytics.server'
import { cleanupMedia } from './lib/media.server'
export { AdminStudio } from './lib/studio-room.server'
export default {
  fetch: handler.fetch,
  scheduled: (controller: ScheduledController, _env: Cloudflare.Env, ctx: ExecutionContext) => {
    if (controller.cron === '17 9 * * *') ctx.waitUntil(withIsolatedDatabaseRequest(cleanupMedia))
    else ctx.waitUntil(withIsolatedDatabaseRequest(() => new AnalyticsService().scheduled()))
  },
}
