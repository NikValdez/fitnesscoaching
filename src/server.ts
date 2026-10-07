import handler from '@tanstack/react-start/server-entry'
import { withIsolatedDatabaseRequest } from './lib/db.server'
import { cleanupMedia } from './lib/media.server'
export { AdminStudio } from './lib/studio-room.server'
export default {
  fetch: handler.fetch,
  scheduled: (_controller: ScheduledController, _env: Cloudflare.Env, ctx: ExecutionContext) => {
    ctx.waitUntil(withIsolatedDatabaseRequest(cleanupMedia))
  },
}
