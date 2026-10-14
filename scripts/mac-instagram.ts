import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma-node/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { AnalyticsDatabase } from '../src/lib/analytics-database.server'
import { AnalyticsService } from '../src/lib/analytics.server'
import { AnalyticsError } from '../src/lib/analytics-parsers'
import { parseAnalyticsUrl } from '../src/lib/analytics-validation'

// Installed with only DATABASE_URL in a private local .env. No Instagram login,
// auth secret, or browser session is needed by this public-page collector.
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('The Mac collector database is not configured.')
  const db = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
  })
  const analyticsDb = new AnalyticsDatabase(db)
  const service = new AnalyticsService(analyticsDb)
  try {
    if (process.argv.includes('--status')) {
      const rows = await analyticsDb.query(
        `SELECT kind, payload->>'handle' AS handle, payload->>'collectionRunner' AS runner,
          payload->'metrics' AS metrics, payload->>'lastFetched' AS "lastFetched",
          payload->>'error' AS error, payload->>'discoveryError' AS "discoveryError",
          next_refresh_at AS "nextRefreshAt", lease_until AS "leaseUntil"
          FROM rossiter_analytics_items WHERE payload->>'platform' = 'instagram'
          ORDER BY kind, id LIMIT 200`,
      )
      console.log(JSON.stringify(rows, null, 2))
      return
    }
    if (process.argv.includes('--configure')) {
      await analyticsDb.transaction(async () => {
        const identity = parseAnalyticsUrl('https://www.instagram.com/steverossiter_/').identity
        const profiles = await analyticsDb.query<{ id: string }>(
          "SELECT id FROM rossiter_analytics_items WHERE kind = 'account' AND identity = $1",
          identity,
        )
        if (profiles.length !== 1) throw new Error('The tracked Instagram profile was not found.')
        const changed = await analyticsDb.query<{ id: string }>(
          `UPDATE rossiter_analytics_items SET
            payload = payload || '{"collectionRunner":"mac"}'::jsonb,
            version = version + 1, updated_at = now(), next_refresh_at = now()
            WHERE payload->>'platform' = 'instagram'
              AND (id = $1 OR payload->>'accountId' = $1 OR lower(payload->>'handle') = 'steverossiter_')
            RETURNING id`,
          profiles[0].id,
        )
        console.log(
          `${new Date().toISOString()} Configured Instagram collection on this Mac (${changed.length} tracked items).`,
        )
      })
      return
    }
    let attempted = 0,
      refreshed = 0,
      failed = 0
    // Bounded batches also collect posts discovered during this invocation.
    // Due dates, automatic switches, leases, and the request budget live in the
    // production database, so catch-up checks never create duplicate daily runs.
    for (let batch = 0; batch < 20; batch++) {
      const report = await service.scheduled('mac')
      attempted += report.attempted
      refreshed += report.refreshed
      failed += report.failed
      if (report.paused || report.limited || report.attempted === 0) break
    }
    if (attempted)
      console.log(
        `${new Date().toISOString()} Instagram daily collection: ${refreshed} refreshed, ${failed} failed (${attempted} attempted).`,
      )
    if (failed) process.exitCode = 1
  } finally {
    await db.$disconnect()
  }
}

void main().catch((error) => {
  // Database/transport exceptions can include connection details. Keep those
  // out of launchd logs; platform errors are already safe and saved in admin.
  console.error(
    `${new Date().toISOString()} ${error instanceof AnalyticsError ? error.message : 'The Mac collector could not complete this run. Check its database connection and network.'}`,
  )
  process.exitCode = 1
})
