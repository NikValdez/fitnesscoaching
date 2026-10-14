import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { PrismaClient } from '../src/generated/prisma-node/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { configureLocalNeon } from '../src/lib/neon-local'
import { analyticsActionSchema } from '../src/lib/analytics-validation'

const state = vi.hoisted(() => ({ client: undefined as unknown as PrismaClient }))
vi.mock('../src/lib/db.server', () => ({
  db: new Proxy(
    {},
    {
      get: (_, key) => {
        const value = Reflect.get(state.client, key)
        return typeof value === 'function' ? value.bind(state.client) : value
      },
    },
  ),
}))
import { AnalyticsService } from '../src/lib/analytics.server'

const url = process.env.ANALYTICS_TEST_DATABASE_URL
// This optional integration suite cannot run against the user's Neon database.
if (url && !['localhost', '127.0.0.1'].includes(new URL(url).hostname))
  throw new Error('Analytics integration tests require a local test database.')
const suite = url ? describe : describe.skip
suite('analytics database and daily collection', () => {
  const ids: string[] = []
  const service = new AnalyticsService()
  const parsed = (input: unknown) => analyticsActionSchema.parse(input)
  beforeAll(async () => {
    configureLocalNeon(url, process.env.NEON_LOCAL_PROXY)
    state.client = new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) })
    await state.client.analyticsItem.updateMany({
      data: { nextRefreshAt: new Date(Date.now() + 86400000) },
    })
  })
  afterEach(() => vi.unstubAllGlobals())
  afterAll(async () => {
    await state.client.analyticsItem.deleteMany({ where: { id: { in: ids } } })
    await state.client.$disconnect()
  })
  async function add(code: string) {
    const result = await service.execute(
      parsed({
        action: 'add',
        kind: 'video',
        url: `https://www.instagram.com/reel/${code}/`,
        title: code,
      }),
    )
    const item = result.items.find((item) => item.url === `https://www.instagram.com/p/${code}/`)!
    ids.push(item.id)
    return item
  }
  it('saves canonical identities, rejects duplicates, keeps old imports from replacing current metrics, and checks edit versions', async () => {
    const item = await add('Integration1')
    await expect(
      service.execute(parsed({ action: 'add', kind: 'video', url: item.url, title: 'Duplicate' })),
    ).rejects.toThrow('already tracked')
    const now = new Date().toISOString(),
      older = new Date(Date.now() - 86400000).toISOString()
    await service.execute(
      parsed({
        action: 'snapshot',
        id: item.id,
        capturedAt: now,
        metrics: { views: 100, likes: 10, comments: 0 },
      }),
    )
    const workspace = await service.execute(
      parsed({
        action: 'import',
        rows: [{ url: item.url, capturedAt: older, metrics: { views: 50, likes: 5 } }],
      }),
    )
    expect(workspace.items.find((i) => i.id === item.id)?.metrics?.views).toBe(100)
    expect((await service.history(item.id)).snapshots).toHaveLength(2)
    await expect(
      service.execute(
        parsed({ action: 'edit', id: item.id, version: item.version, title: 'Stale' }),
      ),
    ).rejects.toThrow('another tab')
    await expect(
      service.execute(
        parsed({
          action: 'snapshot',
          id: item.id,
          capturedAt: new Date(Date.now() + 86400000).toISOString(),
          metrics: { views: 999 },
        }),
      ),
    ).rejects.toThrow('future')
    expect((await service.history(item.id)).snapshots).toHaveLength(2)
  })
  it('preserves previous metrics and history after a blocked scrape and releases the lease', async () => {
    const item = await add('Integration2')
    await service.execute(
      parsed({
        action: 'snapshot',
        id: item.id,
        capturedAt: new Date().toISOString(),
        metrics: { views: 123, likes: 7, comments: 2 },
      }),
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Login required', { status: 403 })),
    )
    await expect(service.refresh(item.id)).rejects.toThrow('preserved')
    const updated = (await service.workspace()).items.find((i) => i.id === item.id)!
    expect(updated.metrics).toEqual({ views: 123, likes: 7, comments: 2 })
    expect(updated.error).toContain('preserved')
    expect((await service.history(item.id)).snapshots).toHaveLength(1)
    const row = await state.client.analyticsItem.findUniqueOrThrow({ where: { id: item.id } })
    expect(row.leaseUntil).toBeNull()
    expect(row.nextRefreshAt.getTime()).toBeGreaterThan(Date.now() + 23 * 3600000)
  })
  it('rejects overlapping refreshes and retains metadata edited while the scrape was pending', async () => {
    const item = await add('Integration3')
    let respond!: (response: Response) => void, started!: () => void
    const ready = new Promise<void>((resolve) => {
      started = resolve
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        started()
        return new Promise<Response>((resolve) => {
          respond = resolve
        })
      }),
    )
    const refresh = service.refresh(item.id)
    await ready
    await expect(service.refresh(item.id)).rejects.toThrow('already refreshing')
    await service.execute(
      parsed({
        action: 'edit',
        id: item.id,
        version: item.version,
        title: 'My title',
        tags: ['Strength'],
        notes: 'Keep this note',
      }),
    )
    respond(
      new Response(
        '<script type="application/json">{"shortcode":"Integration3","like_count":12,"comment_count":3}</script>',
      ),
    )
    await refresh
    const updated = (await service.workspace()).items.find((i) => i.id === item.id)!
    expect(updated.tags).toEqual(['Strength'])
    expect(updated.notes).toBe('Keep this note')
    expect(updated.metrics?.likes).toBe(12)
  })
  it('honors daily settings, request budgets and archive/restore, and stores one snapshot per successful daily run', async () => {
    await state.client.analyticsItem.updateMany({
      data: { nextRefreshAt: new Date(Date.now() + 86400000) },
    })
    const item = await add('Integration4')
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            '<script type="application/json">{"shortcode":"Integration4","like_count":12,"comment_count":3}</script>',
          ),
      ),
    )
    await service.execute(
      parsed({ action: 'settings', automatic: false, intervalHours: 24, dailyLimit: 500 }),
    )
    await service.scheduled()
    expect(fetch).not.toHaveBeenCalled()
    await service.execute(
      parsed({ action: 'settings', automatic: true, intervalHours: 24, dailyLimit: 500 }),
    )
    await service.scheduled()
    expect(fetch).toHaveBeenCalledTimes(1)
    await service.scheduled()
    expect(fetch).toHaveBeenCalledTimes(1)
    const current = (await service.workspace()).items.find((i) => i.id === item.id)!
    await service.execute(
      parsed({ action: 'archive', id: current.id, version: current.version, archived: true }),
    )
    await expect(service.refresh(item.id)).rejects.toThrow('archived')
    const archived = (await service.workspace()).items.find((i) => i.id === item.id)!
    await service.execute(
      parsed({ action: 'archive', id: archived.id, version: archived.version, archived: false }),
    )
    await service.execute(
      parsed({ action: 'settings', automatic: true, intervalHours: 24, dailyLimit: 1 }),
    )
    await expect(service.refresh(item.id)).rejects.toThrow('daily request limit')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect((await service.history(item.id)).snapshots).toHaveLength(1)
    await service.execute(
      parsed({ action: 'settings', automatic: true, intervalHours: 24, dailyLimit: 500 }),
    )
  })
})
