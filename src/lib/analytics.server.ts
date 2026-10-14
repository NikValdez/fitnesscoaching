import { AnalyticsDatabase } from './analytics-database.server'
import { AnalyticsError } from './analytics-parsers'
import { publicPage, publicDiscovery } from './analytics-public'
import {
  parseAnalyticsUrl as parseUrl,
  type AnalyticsAction,
  type AnalyticsItem,
  type AnalyticsWorkspace,
  type Metrics,
} from './analytics-validation'

function parseAnalyticsUrl(value: string) {
  try {
    return parseUrl(value)
  } catch (error) {
    throw new AnalyticsError((error as Error).message)
  }
}
type Settings = { automatic: boolean; interval_hours: number; daily_limit: number }
type Row = {
  id: string
  kind: AnalyticsItem['kind']
  payload: Omit<AnalyticsItem, 'id' | 'kind' | 'version' | 'updatedAt'>
  version: number
  updated_at: Date
}
const uuid = () => crypto.randomUUID()
const unpack = (row: Row): AnalyticsItem => ({
  ...row.payload,
  id: row.id,
  kind: row.kind,
  version: row.version,
  updatedAt: row.updated_at.toISOString(),
})
export class AnalyticsService {
  constructor(private db = new AnalyticsDatabase()) {}
  private async settings() {
    return (
      await this.db.query<Settings>('SELECT * FROM rossiter_analytics_settings WHERE id = 1')
    )[0]
  }
  private async budget() {
    const allowed = await this.db.transaction(async () => {
      const s = await this.settings()
      const row = await this.db.query<{ requests: number }>(
        "INSERT INTO rossiter_analytics_usage(day, requests) VALUES ((now() AT TIME ZONE 'UTC')::date, 1) ON CONFLICT(day) DO UPDATE SET requests = rossiter_analytics_usage.requests + 1 WHERE rossiter_analytics_usage.requests < $1 RETURNING requests",
        s.daily_limit,
      )
      return row.length > 0
    })
    if (!allowed)
      throw new AnalyticsError(
        'The daily request limit has been reached. Refreshing resumes tomorrow (UTC).',
        429,
      )
  }
  private async get(id: string) {
    const row = (
      await this.db.query<Row>('SELECT * FROM rossiter_analytics_items WHERE id = $1', id)
    )[0]
    if (!row) throw new AnalyticsError('This item no longer exists.', 404)
    return unpack(row)
  }
  private async reference(id: string | null | undefined, kind: string, board = false) {
    if (!id) return
    const rows = await this.db.query(
      board
        ? "SELECT id FROM rossiter_content_idea WHERE id = $1 AND 'idea' = $2"
        : "SELECT id FROM rossiter_analytics_items WHERE id = $1 AND kind = $2 AND COALESCE((payload->>'archived')::boolean, false) = false",
      id,
      kind,
    )
    if (!rows.length)
      throw new AnalyticsError(`Choose an existing ${board ? 'production card' : kind}.`)
  }
  private async refs(fields: Partial<AnalyticsItem>) {
    await this.reference(fields.creatorId, 'creator')
    await this.reference(fields.campaignId, 'campaign')
    await this.reference(fields.accountId, 'account')
    await this.reference(fields.boardId, 'idea', true)
  }
  private async insert(
    kind: AnalyticsItem['kind'],
    payload: Row['payload'],
    identity?: string,
    unique = false,
  ) {
    const id = uuid()
    const rows = await this.db.query<Row>(
      `INSERT INTO rossiter_analytics_items(id, kind, identity, payload) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT(kind, identity) DO NOTHING RETURNING *`,
      id,
      kind,
      identity ?? null,
      JSON.stringify(payload),
    )
    if (rows.length) return { item: unpack(rows[0]), inserted: true }
    if (unique) throw new AnalyticsError('This profile or post is already tracked.')
    return {
      item: unpack(
        (
          await this.db.query<Row>(
            'SELECT * FROM rossiter_analytics_items WHERE kind = $1 AND identity = $2',
            kind,
            identity,
          )
        )[0],
      ),
      inserted: false,
    }
  }
  private async update(item: AnalyticsItem, fields: Partial<AnalyticsItem>) {
    const { id, kind, version, updatedAt, ...payload } = { ...item, ...fields }
    const row = (
      await this.db.query<Row>(
        'UPDATE rossiter_analytics_items SET payload = $1::jsonb, version = version + 1, updated_at = now() WHERE id = $2 AND version = $3 RETURNING *',
        JSON.stringify(payload),
        id,
        item.version,
      )
    )[0]
    if (!row)
      throw new AnalyticsError(
        'This item changed in another tab. Reload to review it; your draft is still here.',
        409,
      )
    return unpack(row)
  }
  private async snapshot(id: string, capturedAt: string, metrics: Metrics, source: string) {
    if (new Date(capturedAt).getTime() > Date.now() + 60000)
      throw new AnalyticsError('A metric snapshot cannot be dated in the future.')
    if (!Object.values(metrics).some((v) => v != null))
      throw new AnalyticsError('Enter at least one measured metric.')
    const item = await this.get(id)
    if (!['video', 'account'].includes(item.kind))
      throw new AnalyticsError('Metrics belong to a tracked profile or video.')
    await this.db.query(
      'INSERT INTO rossiter_analytics_snapshots(item_id, captured_at, metrics, source) VALUES ($1, $2, $3::jsonb, $4) ON CONFLICT(item_id, captured_at) DO UPDATE SET metrics = excluded.metrics, source = excluded.source',
      id,
      capturedAt,
      JSON.stringify(metrics),
      source,
    )
    const latest = (
      await this.db.query<{
        captured_at: Date
        metrics: Metrics
        source: string
      }>(
        'SELECT captured_at, metrics, source FROM rossiter_analytics_snapshots WHERE item_id = $1 ORDER BY captured_at DESC LIMIT 1',
        id,
      )
    )[0]
    await this.update(item, {
      metrics: latest.metrics,
      lastFetched: latest.captured_at.toISOString(),
      source: latest.source,
      error: null,
    })
  }
  async workspace(): Promise<AnalyticsWorkspace> {
    return this.db.transaction(async () => {
      const items = (
        await this.db.query<Row>(
          'SELECT * FROM rossiter_analytics_items ORDER BY updated_at DESC LIMIT 10000',
        )
      ).map(unpack)
      const snapshots = (
        await this.db.query<{
          item_id: string
          captured_at: Date
          metrics: Metrics
          source: string
        }>(
          "SELECT * FROM rossiter_analytics_snapshots WHERE captured_at >= now() - interval '366 days' ORDER BY captured_at",
        )
      ).map((r) => ({
        itemId: r.item_id,
        capturedAt: r.captured_at.toISOString(),
        metrics: r.metrics,
        source: r.source,
      }))
      const s = await this.settings()
      const requestsToday =
        (
          await this.db.query<{ requests: number }>(
            "SELECT requests FROM rossiter_analytics_usage WHERE day = (now() AT TIME ZONE 'UTC')::date",
          )
        )[0]?.requests ?? 0
      return {
        items,
        snapshots,
        settings: {
          configured: true,
          automatic: s.automatic,
          intervalHours: s.interval_hours,
          dailyLimit: s.daily_limit,
          requestsToday,
        },
      }
    }, true)
  }
  async history(id: string) {
    await this.get(id)
    const snapshots = await this.db.query<{ capturedAt: Date; metrics: Metrics; source: string }>(
      'SELECT captured_at AS "capturedAt", metrics, source FROM rossiter_analytics_snapshots WHERE item_id = $1 ORDER BY captured_at',
      id,
    )
    return {
      snapshots: snapshots.map((row) => ({ ...row, capturedAt: row.capturedAt.toISOString() })),
    }
  }
  async execute(action: AnalyticsAction): Promise<AnalyticsWorkspace> {
    let notice = ''
    switch (action.action) {
      case 'add-links': {
        let parsed
        try {
          parsed = action.urls.map(parseAnalyticsUrl)
        } catch (error) {
          throw new AnalyticsError((error as Error).message)
        }
        let added = 0
        await this.db.transaction(async () => {
          await this.refs(action)
          for (const link of parsed) {
            const result = await this.insert(
              link.kind,
              {
                title: link.handle ? `@${link.handle}` : link.url,
                url: link.url,
                platform: link.platform,
                handle: link.handle,
                tags: [],
                notes: '',
                creatorId: action.creatorId,
                campaignId: action.campaignId,
                autoRefresh: true,
                metrics: {},
                lastFetched: null,
              },
              link.identity,
            )
            if (result.inserted) added++
          }
        })
        notice = `${added} new links tracked. Existing links were skipped.`
        break
      }
      case 'add': {
        const { action: _, kind, url, ...fields } = action
        const parsed = ['account', 'video'].includes(kind) ? parseAnalyticsUrl(url ?? '') : null
        if (parsed && parsed.kind !== kind)
          throw new AnalyticsError(
            `This URL is a ${parsed.kind === 'account' ? 'profile' : 'post'}. Change the tracking type.`,
          )
        await this.db.transaction(async () => {
          await this.refs(fields)
          if (
            fields.accountId &&
            parsed &&
            (await this.get(fields.accountId)).platform !== parsed.platform
          )
            throw new AnalyticsError('The linked profile must use the same platform as this post.')
          await this.insert(
            kind,
            {
              ...fields,
              ...(parsed
                ? {
                    url: parsed.url,
                    platform: parsed.platform,
                    handle: parsed.handle,
                    metrics: {},
                    lastFetched: null,
                  }
                : {}),
            },
            parsed?.identity,
            true,
          )
        })
        notice = `${kind === 'video' ? 'Video' : kind === 'account' ? 'Profile' : kind === 'creator' ? 'Creator' : 'Campaign'} added.`
        break
      }
      case 'edit':
      case 'archive': {
        await this.db.transaction(async () => {
          const item = await this.get(action.id)
          if (item.version !== action.version)
            throw new AnalyticsError('This item changed in another tab. Reload to review it.', 409)
          const { action: _, id, version, ...fields } = action
          if (action.action === 'edit') {
            await this.refs(fields)
            if (
              'accountId' in fields &&
              fields.accountId &&
              (await this.get(fields.accountId)).platform !== item.platform
            )
              throw new AnalyticsError(
                'The linked profile must use the same platform as this post.',
              )
          }
          await this.update(item, fields)
        })
        notice =
          action.action === 'archive'
            ? action.archived
              ? 'Archived. You can restore it from Archived.'
              : 'Restored.'
            : 'Changes saved.'
        break
      }
      case 'snapshot':
        await this.db.transaction(() =>
          this.snapshot(action.id, action.capturedAt, action.metrics, 'manual'),
        )
        notice = 'Metric snapshot saved.'
        break
      case 'import': {
        const rows = action.rows.map((row) => {
          const parsed = parseAnalyticsUrl(row.url)
          if (parsed.kind !== 'video')
            throw new AnalyticsError('CSV imports require post or video URLs.')
          return { ...row, parsed }
        })
        await this.db.transaction(async () => {
          for (const row of rows) {
            await this.refs(row)
            const { item } = await this.insert(
              'video',
              {
                title: row.title || row.parsed.url,
                url: row.parsed.url,
                platform: row.parsed.platform,
                handle: row.parsed.handle,
                tags: [],
                notes: '',
                creatorId: row.creatorId,
                campaignId: row.campaignId,
                autoRefresh: true,
              },
              row.parsed.identity,
            )
            await this.snapshot(item.id, row.capturedAt, row.metrics, 'csv')
          }
        })
        notice = `${rows.length} metric snapshots imported.`
        break
      }
      case 'refresh':
        await this.refresh(action.id)
        notice = 'Metrics refreshed.'
        break
      case 'refresh-all': {
        const rows = await this.db.query<Row>(
          "SELECT * FROM rossiter_analytics_items WHERE kind IN ('account','video') AND COALESCE((payload->>'archived')::boolean,false) = false ORDER BY next_refresh_at LIMIT 10",
        )
        let ok = 0
        for (const row of rows) {
          try {
            await this.refresh(row.id)
            ok++
          } catch (error) {
            if (error instanceof AnalyticsError && [429, 503].includes(error.status)) throw error
          }
        }
        notice = `Refreshed ${ok} of ${rows.length} items. Any errors appear on their rows. Refresh again for the next batch.`
        break
      }
      case 'discover':
        try {
          notice = await this.discover(action.id)
        } catch (error) {
          await this.db.transaction(async () =>
            this.update(await this.get(action.id), {
              discoveryError:
                error instanceof AnalyticsError
                  ? error.message
                  : 'Post discovery failed. Try again later.',
            }),
          )
          throw error
        }
        break
      case 'settings':
        await this.db.query(
          'UPDATE rossiter_analytics_settings SET automatic = $1, interval_hours = $2, daily_limit = $3 WHERE id = 1',
          action.automatic,
          action.intervalHours,
          action.dailyLimit,
        )
        notice = 'Refresh preferences saved.'
        break
    }
    return { ...(await this.workspace()), notice }
  }
  private async lease(id: string) {
    const row = (
      await this.db.query<Row>(
        "UPDATE rossiter_analytics_items SET lease_until = now() + interval '10 minutes' WHERE id = $1 AND kind IN ('account','video') AND COALESCE((payload->>'archived')::boolean,false) = false AND (lease_until IS NULL OR lease_until < now()) RETURNING *",
        id,
      )
    )[0]
    if (!row) throw new AnalyticsError('This item is archived or is already refreshing.', 409)
    return unpack(row)
  }
  async refresh(id: string, discover = false) {
    const item = await this.lease(id)
    let limited = false
    try {
      const result = await publicPage(item, () => this.budget())
      await this.db.transaction(async () => {
        const current = await this.get(id)
        const { metrics, ...details } = result
        await this.update(
          current,
          Object.fromEntries(Object.entries(details).filter(([, value]) => value != null)),
        )
        if (Object.values(metrics).some((v) => v != null))
          await this.snapshot(id, new Date().toISOString(), metrics, result.source)
        else
          await this.update(await this.get(id), {
            metrics,
            lastFetched: new Date().toISOString(),
            error: null,
          })
      })
    } catch (error) {
      limited = error instanceof AnalyticsError && error.status === 429
      await this.db.transaction(async () => {
        const current = await this.get(id)
        await this.update(current, {
          error:
            error instanceof AnalyticsError
              ? error.message
              : 'This refresh failed. Your previous metrics are preserved.',
        })
      })
      throw error
    } finally {
      if (discover && !limited && item.kind === 'account') {
        try {
          await this.discover(id)
        } catch (error) {
          limited = error instanceof AnalyticsError && error.status === 429
          await this.db.transaction(async () =>
            this.update(await this.get(id), {
              discoveryError:
                error instanceof AnalyticsError
                  ? error.message
                  : 'Post discovery failed. Add individual URLs or try again later.',
            }),
          )
        }
      }
      await this.db.query(
        "UPDATE rossiter_analytics_items SET lease_until = NULL, next_refresh_at = CASE WHEN $2 THEN date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' + interval '1 day' ELSE now() + interval '24 hours' END WHERE id = $1",
        id,
        limited,
      )
    }
  }
  private async discover(id: string) {
    const item = await this.get(id)
    if (item.kind !== 'account' || item.archived)
      throw new AnalyticsError('Choose an active tracked profile.')
    const discovered = await publicDiscovery(item, () => this.budget())
    let added = 0
    await this.db.transaction(async () => {
      for (const row of discovered.rows) {
        let parsed
        try {
          parsed = parseAnalyticsUrl(row.url)
        } catch {
          continue
        }
        if (parsed.platform !== item.platform || parsed.kind !== 'video') continue
        const { item: video, inserted } = await this.insert(
          'video',
          {
            title: row.title || parsed.url,
            url: parsed.url,
            handle: item.handle,
            remoteId: row.remoteId,
            source: row.source,
            platform: parsed.platform,
            thumbnail: row.thumbnail,
            publishedAt: row.publishedAt,
            tags: item.tags,
            notes: '',
            creatorId: item.creatorId,
            campaignId: item.campaignId,
            accountId: item.id,
            autoRefresh: true,
          },
          parsed.identity,
        )
        if (inserted) added++
        else if (row.remoteId)
          await this.update(await this.get(video.id), {
            remoteId: row.remoteId,
            accountId: item.id,
            handle: item.handle,
          })
        if (Object.values(row.metrics).some((v) => v != null))
          await this.snapshot(video.id, new Date().toISOString(), row.metrics, row.source)
      }
      await this.update(await this.get(id), {
        cursor: discovered.cursor,
        discoveryError: null,
        lastDiscovered: new Date().toISOString(),
      })
    })
    return `${added} new posts tracked (${discovered.rows.length} returned). ${discovered.cursor ? 'Import older posts again for the next page.' : 'This feed may not include every post; you can also add individual URLs.'}`
  }
  async scheduled() {
    const s = await this.settings()
    if (!s.automatic) return
    const rows = await this.db.query<{ id: string }>(
      "SELECT id FROM rossiter_analytics_items WHERE kind IN ('account','video') AND COALESCE((payload->>'archived')::boolean,false) = false AND COALESCE((payload->>'autoRefresh')::boolean,true) = true AND next_refresh_at <= now() AND (lease_until IS NULL OR lease_until < now()) ORDER BY next_refresh_at LIMIT 10",
    )
    for (const row of rows) {
      try {
        await this.refresh(row.id, true)
      } catch (error) {
        if (error instanceof AnalyticsError && [429, 503].includes(error.status)) break
      }
    }
  }
}
