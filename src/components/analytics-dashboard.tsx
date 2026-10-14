import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  ChartNoAxesCombined,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Film,
  Heart,
  Camera,
  LockKeyhole,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Users,
  SquarePlay,
} from 'lucide-react'
import { coachingAnalyticsAccounts } from '../lib/analytics-accounts'
import { AdminWorkspace } from './admin-workspace'
import { getAnalyticsWorkspace, getAnalyticsHistory, mutateAnalytics } from '../lib/analytics'
type Workspace = { ideas: { id: string; title: string }[] }
import {
  analyticsPlatforms,
  compact,
  csvCell,
  engagement,
  metricNames,
  parseAnalyticsUrl,
  parseCSV,
  platformColors,
  platformNames,
  type AnalyticsAction,
  type AnalyticsItem,
  type AnalyticsPlatform,
  type AnalyticsWorkspace,
  type Metrics,
  type Snapshot,
} from '../lib/analytics-validation'
import { WorkspaceModal as Modal } from './workspace'

type Tab = 'overview' | 'videos' | 'creators' | 'campaigns' | 'formats' | 'settings'
type Dialog =
  | { kind: 'add'; itemKind: AnalyticsItem['kind'] }
  | { kind: 'edit' | 'detail' | 'snapshot'; id: string }
  | { kind: 'import' | 'links' }
  | null
const money = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
const when = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString('en', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Awaiting first snapshot'
const sourceNames: Record<string, string> = {
  'public-page': 'Public page',
  'tiktok-embed': 'TikTok public embed',
  manual: 'Manual snapshot',
  csv: 'CSV import',
}
function download(name: string, rows: unknown[][]) {
  const url = URL.createObjectURL(
    new Blob(['\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    }),
  )
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function Badge({ platform }: { platform?: AnalyticsPlatform }) {
  if (!platform) return null
  const Icon = platform === 'instagram' ? Camera : platform === 'youtube' ? SquarePlay : Film
  return (
    <span
      className="analytics-platform"
      style={{ '--platform-color': platformColors[platform] } as CSSProperties}
    >
      <Icon size={13} />
      {platformNames[platform]}
    </span>
  )
}

function totals(items: AnalyticsItem[], key: keyof Metrics) {
  const values = items.map((i) => i.metrics?.[key]).filter((v): v is number => v != null)
  return values.length ? values.reduce((a, b) => a + b, 0) : null
}
export function seriesFor(
  items: AnalyticsItem[],
  snapshots: Snapshot[],
  metric: keyof Metrics,
  from: string,
  to: string,
) {
  const start = new Date(`${from}T00:00:00Z`).getTime()
  const end = new Date(`${to}T23:59:59Z`).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return []
  const days = Math.min(366, Math.floor((end - start) / 86400000) + 1)
  const ids = new Map(items.map((i) => [i.id, i.platform!]))
  const histories = new Map<string, Snapshot[]>()
  for (const s of snapshots) {
    if (!ids.has(s.itemId)) continue
    const list = histories.get(s.itemId) ?? []
    list.push(s)
    histories.set(s.itemId, list)
  }
  for (const list of histories.values())
    list.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
  return Array.from({ length: days }, (_, index) => {
    const time = start + index * 86400000 + 86399999
    const values: Partial<Record<AnalyticsPlatform, number>> = {}
    for (const [id, list] of histories) {
      const latest = [...list].reverse().find((s) => new Date(s.capturedAt).getTime() <= time)
      const value = latest?.metrics[metric]
      if (value != null) {
        const p = ids.get(id)!
        values[p] = (values[p] ?? 0) + value
      }
    }
    return {
      date: new Date(start + index * 86400000).toISOString().slice(0, 10),
      values,
    }
  })
}
function Trend({
  items,
  snapshots,
  from,
  to,
}: {
  items: AnalyticsItem[]
  snapshots: Snapshot[]
  from: string
  to: string
}) {
  const [metric, setMetric] = useState<keyof Metrics>('views')
  const [table, setTable] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  const series = useMemo(
    () => seriesFor(items, snapshots, metric, from, to),
    [items, snapshots, metric, from, to],
  )
  const max = Math.max(1, ...series.flatMap((s) => Object.values(s.values)))
  const measured = series.some((s) => Object.keys(s.values).length)
  const width = 840,
    height = 220,
    left = 55,
    right = 12,
    top = 18,
    bottom = 30
  const x = (i: number) => left + (i / Math.max(1, series.length - 1)) * (width - left - right)
  const y = (value: number) => height - bottom - (value / max) * (height - top - bottom)
  const point = hover == null ? null : series[hover]
  return (
    <section className="analytics-panel analytics-trend">
      <div className="analytics-panel-heading">
        <div>
          <span className="studio-eyebrow">THE BIG PICTURE</span>
          <h2>Performance over time</h2>
          <p>Latest recorded totals, across every tracked platform.</p>
        </div>
        <label className="analytics-metric-select">
          <span className="sr-only">Chart metric</span>
          <select value={metric} onChange={(e) => setMetric(e.target.value as keyof Metrics)}>
            {['views', 'likes', 'comments', 'shares', 'followers'].map((key) => (
              <option key={key} value={key}>
                {key[0].toUpperCase() + key.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {measured ? (
        <div className="analytics-chart-wrap">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`${metric} recorded from ${from} to ${to}`}
            onMouseLeave={() => setHover(null)}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <g key={v}>
                <line
                  x1={left}
                  x2={width - right}
                  y1={y(v * max)}
                  y2={y(v * max)}
                  className="analytics-gridline"
                />
                <text x={left - 12} y={y(v * max) + 4} textAnchor="end">
                  {compact(Math.round(v * max))}
                </text>
              </g>
            ))}
            {analyticsPlatforms.map((p) => {
              const valid = series.flatMap((s, i) =>
                s.values[p] != null ? [{ i, value: s.values[p]! }] : [],
              )
              if (!valid.length) return null
              return (
                <g key={p}>
                  <path
                    d={valid
                      .map(
                        (v, i) =>
                          `${i === 0 || v.i !== valid[i - 1].i + 1 ? 'M' : 'L'}${x(v.i)},${y(v.value)}`,
                      )
                      .join(' ')}
                    fill="none"
                    stroke={platformColors[p]}
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {valid.length === 1 && (
                    <circle
                      cx={x(valid[0].i)}
                      cy={y(valid[0].value)}
                      r="4"
                      fill={platformColors[p]}
                    />
                  )}
                </g>
              )
            })}
            {series.length > 0 &&
              [0, Math.floor((series.length - 1) / 2), series.length - 1].map((i, index) => (
                <text
                  key={index}
                  x={x(i)}
                  y={height - 5}
                  textAnchor={index === 0 ? 'start' : index === 2 ? 'end' : 'middle'}
                >
                  {new Date(series[i].date + 'T12:00:00').toLocaleDateString('en', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </text>
              ))}
            {point && (
              <line
                x1={x(hover!)}
                x2={x(hover!)}
                y1={top}
                y2={height - bottom}
                className="analytics-hoverline"
              />
            )}
            {series.map((s, i) => (
              <rect
                key={s.date}
                x={x(i) - (width - left - right) / Math.max(1, series.length - 1) / 2}
                y={top}
                width={(width - left - right) / Math.max(1, series.length - 1)}
                height={height - top - bottom}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              >
                <title>{`${s.date}: ${Object.entries(s.values)
                  .map(
                    ([p, v]) => `${platformNames[p as AnalyticsPlatform]} ${v?.toLocaleString()}`,
                  )
                  .join(', ')}`}</title>
              </rect>
            ))}
          </svg>
          {point && (
            <div className="analytics-chart-readout" role="status">
              <strong>{point.date}</strong>
              {Object.entries(point.values).map(([p, v]) => (
                <span key={p}>
                  <i
                    style={{
                      background: platformColors[p as AnalyticsPlatform],
                    }}
                  />
                  {platformNames[p as AnalyticsPlatform]} {compact(v)}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="analytics-chart-empty">
          <div className="analytics-empty-lines" aria-hidden="true" />
          <ChartNoAxesCombined size={28} strokeWidth={1.2} />
          <strong>Your next view starts the story.</strong>
          <p>
            Refresh a tracked post or import a snapshot.
            <br />
            Your history will build here over time.
          </p>
        </div>
      )}
      <div className="analytics-chart-footer">
        <span>
          History begins with the first recorded snapshot. Added videos can change totals.
        </span>
        <button className="text-link" onClick={() => setTable(!table)}>
          {table ? 'Hide' : 'View'} chart data
        </button>
      </div>
      {table && (
        <div className="analytics-table-scroll">
          <table className="analytics-table">
            <caption className="sr-only">Daily recorded {metric} totals</caption>
            <thead>
              <tr>
                <th>Date</th>
                {analyticsPlatforms.map((p) => (
                  <th key={p}>{platformNames[p]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {series.map((s) => (
                <tr key={s.date}>
                  <td>{s.date}</td>
                  {analyticsPlatforms.map((p) => (
                    <td key={p}>{s.values[p]?.toLocaleString() ?? '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default function Analytics({
  initial,
  userName,
  board,
}: {
  initial: AnalyticsWorkspace
  userName: string
  board: Workspace['ideas']
}) {
  const [data, setData] = useState<AnalyticsWorkspace | null>(initial)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [tab, setTab] = useState<Tab>('overview')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [platform, setPlatform] = useState('all')
  const [creator, setCreator] = useState('all')
  const [campaign, setCampaign] = useState('all')
  const [search, setSearch] = useState('')
  const [archived, setArchived] = useState(false)
  const [sort, setSort] = useState('views')
  const [page, setPage] = useState(0)
  const today = new Date().toISOString().slice(0, 10)
  const [to, setTo] = useState(today)
  const [from, setFrom] = useState(new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10))
  const [range, setRange] = useState('30')
  const readOnly = false
  const load = useCallback(async () => {
    setData((await getAnalyticsWorkspace()).analytics)
  }, [])
  useEffect(() => {
    const reload = () => {
      if (!pending.current) void load().catch((e) => setError(e.message))
    }
    const timer = setInterval(reload, 60000)
    window.addEventListener('focus', reload)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', reload)
    }
  }, [load])
  const run = async (action: AnalyticsAction) => {
    if (pending.current) return false
    pending.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const next = await mutateAnalytics({ data: action })
      setData(next)
      setNotice(next.notice ?? 'Saved.')
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  const items = data?.items ?? []
  const creators = items.filter((i) => i.kind === 'creator' && !i.archived)
  const campaigns = items.filter((i) => i.kind === 'campaign' && !i.archived)
  const accounts = items.filter((i) => i.kind === 'account' && !i.archived)
  const filter = (item: AnalyticsItem) =>
    !!item.archived === archived &&
    (platform === 'all' || item.platform === platform) &&
    (creator === 'all' || item.creatorId === creator) &&
    (campaign === 'all' || item.campaignId === campaign) &&
    (!search ||
      `${item.title} ${item.handle} ${item.tags.join(' ')} ${item.notes}`
        .toLowerCase()
        .includes(search.toLowerCase()))
  const videos = items
    .filter((i) => i.kind === 'video' && filter(i))
    .sort((a, b) =>
      sort === 'latest'
        ? (b.publishedAt ?? b.updatedAt).localeCompare(a.publishedAt ?? a.updatedAt)
        : sort === 'engagement'
          ? (engagement(b) ?? -1) - (engagement(a) ?? -1)
          : (b.metrics?.[sort as keyof Metrics] ?? -1) - (a.metrics?.[sort as keyof Metrics] ?? -1),
    )
  const filteredAccounts = items.filter((i) => i.kind === 'account' && filter(i))
  const chartItems = [...videos, ...filteredAccounts]
  const snapshots = data?.snapshots ?? []
  const views = totals(videos, 'views')
  const likes = totals(videos, 'likes')
  const eligible = videos.filter((i) => engagement(i) != null)
  const eligibleViews = totals(eligible, 'views') ?? 0
  const rate = eligibleViews
    ? (eligible.reduce(
        (sum, i) => sum + (i.metrics!.likes! + i.metrics!.comments! + (i.metrics!.shares ?? 0)),
        0,
      ) /
        eligibleViews) *
      100
    : null
  const selected = dialog && 'id' in dialog ? items.find((i) => i.id === dialog.id) : null
  const [detailHistory, setDetailHistory] = useState<{
    id: string
    snapshots: Snapshot[]
  } | null>(null)
  useEffect(() => {
    if (dialog?.kind !== 'detail' || !selected) return
    let active = true
    setDetailHistory(null)
    void getAnalyticsHistory({ data: { id: selected.id } })
      .then((result) => {
        if (active)
          setDetailHistory({
            id: selected.id,
            snapshots: result.snapshots.map((s) => ({
              ...s,
              itemId: selected.id,
            })),
          })
      })
      .catch((error) => {
        if (active) setError(error.message)
      })
    return () => {
      active = false
    }
  }, [dialog?.kind, selected?.id, selected?.version])
  const exportVideos = () =>
    download('rossiter-video-analytics.csv', [
      [
        'url',
        'title',
        'platform',
        'creator',
        'campaign',
        'publishedAt',
        'capturedAt',
        'views',
        'likes',
        'comments',
        'shares',
        'saves',
        'engagementRate',
        'source',
        'tags',
      ],
      ...videos.map((i) => [
        i.url,
        i.title,
        i.platform,
        creators.find((c) => c.id === i.creatorId)?.title,
        campaigns.find((c) => c.id === i.campaignId)?.title,
        i.publishedAt,
        i.lastFetched,
        i.metrics?.views,
        i.metrics?.likes,
        i.metrics?.comments,
        i.metrics?.shares,
        i.metrics?.saves,
        engagement(i),
        i.source,
        i.tags.join(';'),
      ]),
    ])
  const reset = () => {
    setPlatform('all')
    setCreator('all')
    setCampaign('all')
    setSearch('')
    setArchived(false)
    setPage(0)
  }
  useEffect(() => setPage(0), [platform, creator, campaign, search, archived, sort])
  return (
    <AdminWorkspace name={userName} current="analytics">
      <div className="analytics-shell">
        <div className="studio-main">
          <div className="studio-page-heading with-action analytics-heading">
            <div>
              <span className="studio-eyebrow">STEVE ROSSITER / VIDEO ANALYTICS</span>
              <h1>
                Every post.
                <br />
                <em>A clearer picture.</em>
              </h1>
              <p>Track your videos, compare platforms, and see what’s worth making next.</p>
            </div>
            <div className="analytics-heading-actions">
              {!readOnly && (
                <>
                  <button
                    className="studio-button"
                    disabled={busy}
                    onClick={() => setDialog({ kind: 'add', itemKind: 'video' })}
                  >
                    <Plus size={16} />
                    Track a video
                  </button>
                  <button
                    className="studio-button secondary"
                    disabled={busy}
                    onClick={() => void run({ action: 'refresh-all' })}
                  >
                    <RefreshCw size={15} />
                    {busy ? 'Working…' : 'Refresh metrics'}
                  </button>
                </>
              )}
            </div>
          </div>
          {error && (
            <div className="studio-notice is-error" role="alert">
              <span>{error}</span>
              <button
                className="text-link"
                onClick={() => {
                  void load()
                    .then(() => setError(''))
                    .catch((e) => setError(e.message))
                }}
              >
                Reload
              </button>
            </div>
          )}
          {notice && (
            <div className="studio-notice" role="status">
              <Check size={15} />
              <span>{notice}</span>
              <button className="text-link" onClick={() => setNotice('')}>
                Dismiss
              </button>
            </div>
          )}
          {!data ? (
            <section className="analytics-panel analytics-loading">
              <Activity size={24} />
              <h2>{error ? 'Analytics could not be loaded.' : 'Opening your analytics…'}</h2>
              <button
                className="studio-button secondary"
                onClick={() =>
                  void load()
                    .then(() => setError(''))
                    .catch((e) => setError(e.message))
                }
              >
                Try again
              </button>
            </section>
          ) : (
            <>
              <div className="analytics-tabs" role="tablist" aria-label="Analytics sections">
                {(
                  ['overview', 'videos', 'creators', 'campaigns', 'formats', 'settings'] as Tab[]
                ).map((t) => (
                  <button
                    key={t}
                    role="tab"
                    aria-selected={tab === t}
                    tabIndex={tab === t ? 0 : -1}
                    onKeyDown={(event) => {
                      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
                      event.preventDefault()
                      const buttons = Array.from(
                        event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>(
                          'button',
                        ),
                      )
                      const current = buttons.indexOf(event.currentTarget)
                      const next =
                        event.key === 'Home'
                          ? 0
                          : event.key === 'End'
                            ? buttons.length - 1
                            : (current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) %
                              buttons.length
                      buttons[next].focus()
                      buttons[next].click()
                    }}
                    className={tab === t ? 'active' : ''}
                    onClick={() => {
                      setTab(t)
                      setPage(0)
                    }}
                  >
                    {t === 'settings' ? 'Daily scraping' : t[0].toUpperCase() + t.slice(1)}
                    {t === 'videos' && (
                      <span>{items.filter((i) => i.kind === 'video' && !i.archived).length}</span>
                    )}
                  </button>
                ))}
              </div>
              {tab !== 'settings' && (
                <>
                  <div className="analytics-filters">
                    <label className="analytics-search">
                      <Search size={16} />
                      <span className="sr-only">Search analytics</span>
                      <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search videos, handles, or tags"
                      />
                    </label>
                    <label>
                      <span className="sr-only">Filter by creator</span>
                      <select value={creator} onChange={(e) => setCreator(e.target.value)}>
                        <option value="all">All creators</option>
                        {creators.map((i) => (
                          <option value={i.id} key={i.id}>
                            {i.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="sr-only">Filter by campaign</span>
                      <select value={campaign} onChange={(e) => setCampaign(e.target.value)}>
                        <option value="all">All campaigns</option>
                        {campaigns.map((i) => (
                          <option value={i.id} key={i.id}>
                            {i.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="sr-only">History date range</span>
                      <select
                        value={range}
                        onChange={(e) => {
                          setRange(e.target.value)
                          if (e.target.value !== 'custom') {
                            setTo(today)
                            setFrom(
                              new Date(Date.now() - (Number(e.target.value) - 1) * 86400000)
                                .toISOString()
                                .slice(0, 10),
                            )
                          }
                        }}
                      >
                        <option value="7">Last 7 days</option>
                        <option value="30">Last 30 days</option>
                        <option value="90">Last 90 days</option>
                        <option value="custom">Custom dates</option>
                      </select>
                    </label>
                    {range === 'custom' && (
                      <div className="analytics-dates">
                        <label>
                          From
                          <input
                            aria-label="History from"
                            type="date"
                            value={from}
                            max={to}
                            onChange={(e) => setFrom(e.target.value)}
                          />
                        </label>
                        <label>
                          To
                          <input
                            aria-label="History to"
                            type="date"
                            value={to}
                            min={from}
                            max={today}
                            onChange={(e) => setTo(e.target.value)}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                  <div className="analytics-platform-filters" aria-label="Filter by platform">
                    <button
                      aria-pressed={platform === 'all'}
                      className={platform === 'all' ? 'selected' : ''}
                      onClick={() => setPlatform('all')}
                    >
                      All platforms
                    </button>
                    {analyticsPlatforms.map((p) => (
                      <button
                        key={p}
                        aria-pressed={platform === p}
                        className={platform === p ? 'selected' : ''}
                        onClick={() => setPlatform(p)}
                      >
                        <i style={{ background: platformColors[p] }} />
                        {platformNames[p]}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {tab === 'overview' && (
                <>
                  <div className="analytics-stat-grid">
                    {[
                      {
                        label: 'Tracked views',
                        value: compact(views),
                        hint: `${videos.filter((i) => i.metrics?.views != null).length} videos with measured views`,
                        icon: Eye,
                      },
                      {
                        label: 'Engagement rate',
                        value: rate == null ? '—' : `${rate.toFixed(2)}%`,
                        hint: '(likes + comments + available shares) ÷ views',
                        icon: Heart,
                      },
                      {
                        label: 'Videos tracked',
                        value: String(videos.length),
                        hint: `Across ${new Set(videos.map((i) => i.platform)).size} ${new Set(videos.map((i) => i.platform)).size === 1 ? 'platform' : 'platforms'}`,
                        icon: Film,
                      },
                      {
                        label: 'Profile followers',
                        value: compact(totals(filteredAccounts, 'followers')),
                        hint: `${filteredAccounts.length} tracked profiles · not unique people`,
                        icon: Users,
                      },
                    ].map((s, i) => (
                      <section
                        key={s.label}
                        className={`analytics-stat ${i === 0 ? 'is-primary' : ''}`}
                      >
                        <div>
                          <span>{s.label}</span>
                          <s.icon size={17} strokeWidth={1.5} />
                        </div>
                        <strong>{s.value}</strong>
                        <p>{s.hint}</p>
                      </section>
                    ))}
                  </div>

                  <div className="analytics-overview-grid">
                    <Trend items={chartItems} snapshots={snapshots} from={from} to={to} />
                    <section className="analytics-panel analytics-breakdown">
                      <span className="studio-eyebrow">WHERE IT’S LANDING</span>
                      <h2>By platform</h2>
                      <p>Latest lifetime views from your tracked posts.</p>
                      <div>
                        {analyticsPlatforms.map((p) => {
                          const list = videos.filter((i) => i.platform === p)
                          const value = totals(list, 'views')
                          const fraction = views && value ? value / views : 0
                          return (
                            <button
                              key={p}
                              className="analytics-platform-row"
                              onClick={() => {
                                setPlatform(p)
                                setTab('videos')
                              }}
                            >
                              <div>
                                <Badge platform={p} />
                                <strong>{compact(value)}</strong>
                              </div>
                              <span className="analytics-bar">
                                <i
                                  style={{
                                    width: `${fraction * 100}%`,
                                    background: platformColors[p],
                                  }}
                                />
                              </span>
                              <small>
                                {list.length} {list.length === 1 ? 'video' : 'videos'}
                                {fraction
                                  ? ` · ${(fraction * 100).toFixed(0)}% of measured views`
                                  : ''}
                              </small>
                            </button>
                          )
                        })}
                      </div>
                    </section>
                  </div>
                  <section className="analytics-panel">
                    <div className="analytics-panel-heading">
                      <div>
                        <span className="studio-eyebrow">MAKE MORE OF WHAT WORKS</span>
                        <h2>Your leading videos</h2>
                      </div>
                      <button className="text-link" onClick={() => setTab('videos')}>
                        View all videos
                        <ArrowUpRight size={14} />
                      </button>
                    </div>
                    {videos.length ? (
                      <VideoTable
                        videos={videos.slice(0, 5)}
                        creators={creators}
                        onSelect={(id) => setDialog({ kind: 'detail', id })}
                      />
                    ) : (
                      <Empty
                        kind="videos"
                        onAdd={
                          !readOnly
                            ? () => setDialog({ kind: 'add', itemKind: 'video' })
                            : undefined
                        }
                      />
                    )}
                  </section>
                  {!readOnly && (
                    <div className="analytics-collection-note">
                      <span>
                        <Activity size={16} />
                        Custom public tracking ·{' '}
                        {data.settings.automatic
                          ? `automatic refresh every ${data.settings.intervalHours}h`
                          : 'automatic refresh paused'}
                      </span>
                      <button className="text-link" onClick={() => setTab('settings')}>
                        Daily scraping
                        <ArrowUpRight size={14} />
                      </button>
                    </div>
                  )}
                </>
              )}
              {tab === 'videos' && (
                <section className="analytics-panel">
                  <div className="analytics-panel-heading">
                    <div>
                      <span className="studio-eyebrow">YOUR PUBLISHED WORK</span>
                      <h2>
                        {archived ? 'Archived videos' : 'Tracked videos'}{' '}
                        <span className="analytics-count">{videos.length}</span>
                      </h2>
                    </div>
                    <div className="analytics-toolbar">
                      <label>
                        <span className="sr-only">Sort videos</span>
                        <select value={sort} onChange={(e) => setSort(e.target.value)}>
                          <option value="views">Most views</option>
                          <option value="likes">Most likes</option>
                          <option value="comments">Most comments</option>
                          <option value="engagement">Engagement rate</option>
                          <option value="latest">Latest published</option>
                        </select>
                      </label>
                      <button
                        className="studio-button secondary small"
                        onClick={exportVideos}
                        disabled={!videos.length}
                      >
                        <ArrowDownToLine size={14} />
                        Export CSV
                      </button>
                      {!readOnly && (
                        <button
                          className="studio-button secondary small"
                          onClick={() => setDialog({ kind: 'import' })}
                        >
                          Import
                        </button>
                      )}
                      <button className="text-link" onClick={() => setArchived(!archived)}>
                        {archived ? 'Active' : 'Archived'}
                      </button>
                    </div>
                  </div>
                  {videos.length ? (
                    <>
                      <VideoTable
                        videos={videos.slice(page * 25, (page + 1) * 25)}
                        creators={creators}
                        onSelect={(id) => setDialog({ kind: 'detail', id })}
                      />
                      <div className="analytics-pagination">
                        <span>
                          {page * 25 + 1}–{Math.min((page + 1) * 25, videos.length)} of{' '}
                          {videos.length}
                        </span>
                        <button
                          className="icon-button"
                          aria-label="Previous page"
                          disabled={page === 0}
                          onClick={() => setPage(page - 1)}
                        >
                          <ChevronLeft size={17} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label="Next page"
                          disabled={(page + 1) * 25 >= videos.length}
                          onClick={() => setPage(page + 1)}
                        >
                          <ChevronRight size={17} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <Empty
                      kind="videos"
                      onAdd={
                        !readOnly ? () => setDialog({ kind: 'add', itemKind: 'video' }) : undefined
                      }
                      onReset={
                        platform !== 'all' || creator !== 'all' || campaign !== 'all' || !!search
                          ? reset
                          : undefined
                      }
                    />
                  )}
                  <p className="analytics-fineprint">
                    — means the platform hasn’t exposed that metric. Views are platform-defined and
                    can include repeat plays.
                  </p>
                </section>
              )}
              {tab === 'creators' && (
                <>
                  <div className="analytics-section-heading">
                    <div>
                      <h2>Creators & profiles</h2>
                      <p>Keep your own accounts and collaborators in one place.</p>
                    </div>
                    {!readOnly && (
                      <div className="analytics-toolbar">
                        <button
                          className="studio-button secondary small"
                          onClick={() => setDialog({ kind: 'add', itemKind: 'creator' })}
                        >
                          <Plus size={14} />
                          Add creator
                        </button>
                        <button
                          className="studio-button small"
                          onClick={() => setDialog({ kind: 'add', itemKind: 'account' })}
                        >
                          <Plus size={14} />
                          Track profile
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="analytics-creator-grid">
                    {creators
                      .filter(
                        (i) => !search || i.title.toLowerCase().includes(search.toLowerCase()),
                      )
                      .map((c) => {
                        const list = items.filter(
                          (i) => i.kind === 'video' && i.creatorId === c.id && !i.archived,
                        )
                        return (
                          <section key={c.id} className="analytics-panel analytics-creator">
                            <div className="analytics-creator-top">
                              <span className="analytics-monogram">
                                {c.title
                                  .split(' ')
                                  .map((v) => v[0])
                                  .slice(0, 2)
                                  .join('')}
                              </span>
                              <div>
                                <h3>{c.title}</h3>
                                <p>
                                  {
                                    items.filter(
                                      (i) =>
                                        i.kind === 'account' && i.creatorId === c.id && !i.archived,
                                    ).length
                                  }{' '}
                                  profiles · {list.length} videos
                                </p>
                              </div>
                              {!readOnly && (
                                <button
                                  className="icon-button"
                                  aria-label={`Edit ${c.title}`}
                                  onClick={() => setDialog({ kind: 'edit', id: c.id })}
                                >
                                  <Settings2 size={16} />
                                </button>
                              )}
                            </div>
                            <strong>
                              {compact(totals(list, 'views'))}
                              <small> tracked views</small>
                            </strong>
                            {!readOnly && (
                              <p>
                                Estimated creator earnings:{' '}
                                {totals(list, 'views') != null && c.cpm
                                  ? money((totals(list, 'views')! * c.cpm) / 1000)
                                  : '—'}
                                {c.cpm ? ` · ${money(c.cpm)} CPM` : ' · no CPM set'}
                              </p>
                            )}
                            <button
                              className="text-link"
                              onClick={() => {
                                setCreator(c.id)
                                setTab('videos')
                              }}
                            >
                              View videos
                              <ArrowUpRight size={14} />
                            </button>
                          </section>
                        )
                      })}
                  </div>
                  <section className="analytics-panel">
                    <div className="analytics-panel-heading">
                      <h2>Tracked profiles</h2>
                      {!readOnly && (
                        <button className="text-link" onClick={() => setDialog({ kind: 'links' })}>
                          Add links in bulk
                          <Plus size={14} />
                        </button>
                      )}
                    </div>
                    {filteredAccounts.length ? (
                      <div className="analytics-profile-list">
                        {filteredAccounts.map((a) => (
                          <div key={a.id} className="analytics-profile-row">
                            <Badge platform={a.platform} />
                            <div>
                              <a href={a.url} target="_blank" rel="noopener noreferrer">
                                {a.title}
                                <ArrowUpRight size={12} />
                              </a>
                              <small>
                                {a.handle ? `@${a.handle}` : ''} ·{' '}
                                {a.lastFetched
                                  ? `Updated ${when(a.lastFetched)}`
                                  : 'No metrics yet'}
                              </small>
                              {(a.error || a.discoveryError) && (
                                <span className="analytics-item-error">
                                  {a.error || a.discoveryError}
                                </span>
                              )}
                            </div>
                            <strong>
                              {compact(a.metrics?.followers)}
                              <small> followers</small>
                            </strong>
                            {!readOnly && (
                              <div className="analytics-toolbar">
                                <button
                                  className="icon-button"
                                  disabled={busy}
                                  aria-label={`Refresh ${a.title}`}
                                  onClick={() => void run({ action: 'refresh', id: a.id })}
                                >
                                  <RefreshCw size={15} />
                                </button>
                                <button
                                  className="studio-button secondary small"
                                  disabled={busy}
                                  onClick={() => void run({ action: 'discover', id: a.id })}
                                >
                                  Import posts
                                </button>
                                <button
                                  className="icon-button"
                                  aria-label={`View history for ${a.title}`}
                                  onClick={() => setDialog({ kind: 'detail', id: a.id })}
                                >
                                  <ChartNoAxesCombined size={15} />
                                </button>
                                <button
                                  className="icon-button"
                                  aria-label={`Edit ${a.title}`}
                                  onClick={() => setDialog({ kind: 'edit', id: a.id })}
                                >
                                  <Settings2 size={15} />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Empty
                        kind="profiles"
                        onAdd={
                          !readOnly
                            ? () => setDialog({ kind: 'add', itemKind: 'account' })
                            : undefined
                        }
                        onReset={
                          platform !== 'all' || creator !== 'all' || campaign !== 'all' || !!search
                            ? reset
                            : undefined
                        }
                      />
                    )}
                  </section>
                </>
              )}
              {tab === 'campaigns' && (
                <>
                  <div className="analytics-section-heading">
                    <div>
                      <h2>Campaigns</h2>
                      <p>Compare launches, themes, and creator partnerships.</p>
                    </div>
                    {!readOnly && (
                      <button
                        className="studio-button small"
                        onClick={() => setDialog({ kind: 'add', itemKind: 'campaign' })}
                      >
                        <Plus size={14} />
                        New campaign
                      </button>
                    )}
                  </div>
                  {campaigns.length ? (
                    <div className="analytics-creator-grid">
                      {campaigns.map((c) => {
                        const list = items.filter(
                          (i) => i.kind === 'video' && i.campaignId === c.id && !i.archived,
                        )
                        const v = totals(list, 'views')
                        return (
                          <section className="analytics-panel analytics-campaign" key={c.id}>
                            <span className="studio-eyebrow">{list.length} TRACKED VIDEOS</span>
                            <h3>{c.title}</h3>
                            <strong>
                              {compact(v)}
                              <small> views</small>
                            </strong>
                            {!readOnly && (
                              <p>
                                Budget {money(c.budget ?? 0)} ·{' '}
                                {v ? money(((c.budget ?? 0) / v) * 1000) : '—'} effective CPM
                              </p>
                            )}
                            <p>{c.notes}</p>
                            <div className="analytics-toolbar">
                              <button
                                className="text-link"
                                onClick={() => {
                                  setCampaign(c.id)
                                  setTab('videos')
                                }}
                              >
                                Explore campaign
                                <ArrowUpRight size={14} />
                              </button>
                              {!readOnly && (
                                <button
                                  className="icon-button"
                                  aria-label={`Edit ${c.title}`}
                                  onClick={() => setDialog({ kind: 'edit', id: c.id })}
                                >
                                  <Settings2 size={16} />
                                </button>
                              )}
                            </div>
                          </section>
                        )
                      })}
                    </div>
                  ) : (
                    <section className="analytics-panel">
                      <Empty
                        kind="campaigns"
                        onAdd={
                          !readOnly
                            ? () => setDialog({ kind: 'add', itemKind: 'campaign' })
                            : undefined
                        }
                      />
                    </section>
                  )}
                </>
              )}
              {tab === 'formats' && (
                <section className="analytics-panel">
                  <div className="analytics-panel-heading">
                    <div>
                      <span className="studio-eyebrow">YOUR OWN CREATIVE PLAYBOOK</span>
                      <h2>What’s working?</h2>
                      <p>Tag videos by hook, format, or topic to compare your actual results.</p>
                    </div>
                    {!readOnly && (
                      <a className="text-link" href="/admin/library">
                        Open content library
                        <ArrowUpRight size={14} />
                      </a>
                    )}
                  </div>
                  {Array.from(new Set(videos.flatMap((v) => v.tags))).length ? (
                    <div className="analytics-format-list">
                      {Array.from(new Set(videos.flatMap((v) => v.tags)))
                        .map((tag) => {
                          const list = videos.filter((v) => v.tags.includes(tag))
                          const value = totals(list, 'views')
                          return { tag, list, value }
                        })
                        .sort((a, b) => (b.value ?? -1) - (a.value ?? -1))
                        .map(({ tag, list, value }) => (
                          <button
                            key={tag}
                            onClick={() => {
                              setSearch(tag)
                              setTab('videos')
                            }}
                          >
                            <span>
                              {tag}
                              <small>{list.length} videos</small>
                            </span>
                            <strong>
                              {compact(value)}
                              <small> views</small>
                            </strong>
                            <span>
                              {compact(
                                value == null
                                  ? null
                                  : Math.round(
                                      value / list.filter((i) => i.metrics?.views != null).length,
                                    ),
                              )}
                              <small> avg. per measured video</small>
                            </span>
                            <ArrowUpRight size={16} />
                          </button>
                        ))}
                    </div>
                  ) : (
                    <Empty kind="formats" onAdd={!readOnly ? () => setTab('videos') : undefined} />
                  )}
                  <p className="analytics-fineprint">
                    Compare the formats and tags you use in your own posts.
                  </p>
                </section>
              )}
              {tab === 'settings' && <ScrapeSettings data={data} busy={busy} run={run} />}
            </>
          )}
        </div>
        {dialog && data && (
          <Modal
            title={
              dialog.kind === 'add'
                ? dialog.itemKind === 'account'
                  ? 'Track a profile'
                  : dialog.itemKind === 'creator'
                    ? 'Add a creator'
                    : dialog.itemKind === 'campaign'
                      ? 'New campaign'
                      : 'Track a video'
                : dialog.kind === 'edit'
                  ? 'Edit details'
                  : dialog.kind === 'detail'
                    ? (selected?.title ?? 'Video details')
                    : dialog.kind === 'snapshot'
                      ? 'Record a snapshot'
                      : dialog.kind === 'import'
                        ? 'Import video metrics'
                        : dialog.kind === 'links'
                          ? 'Track links in bulk'
                          : 'Create access'
            }
            label="STEVE ROSSITER / VIDEO ANALYTICS"
            busy={busy}
            onClose={() => {
              setDialog(null)
              setError('')
            }}
          >
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {(dialog.kind === 'add' || dialog.kind === 'edit') && (
              <ItemForm
                item={dialog.kind === 'edit' ? (selected ?? undefined) : undefined}
                kind={dialog.kind === 'add' ? dialog.itemKind : (selected?.kind ?? 'video')}
                creators={creators}
                campaigns={campaigns}
                accounts={accounts}
                board={board}
                busy={busy}
                onSave={async (a) => {
                  if (await run(a)) setDialog(null)
                }}
              />
            )}
            {dialog.kind === 'detail' && selected && (
              <VideoDetail
                item={selected}
                snapshots={
                  detailHistory?.id === selected.id
                    ? detailHistory.snapshots
                    : snapshots.filter((s) => s.itemId === selected.id)
                }
                creators={creators}
                campaigns={campaigns}
                readOnly={readOnly}
                busy={busy}
                onEdit={() => setDialog({ kind: 'edit', id: selected.id })}
                onSnapshot={() => setDialog({ kind: 'snapshot', id: selected.id })}
                onRefresh={() => void run({ action: 'refresh', id: selected.id })}
                onArchive={() =>
                  void run({
                    action: 'archive',
                    id: selected.id,
                    version: selected.version,
                    archived: !selected.archived,
                  })
                }
              />
            )}
            {dialog.kind === 'snapshot' && selected && (
              <SnapshotForm
                item={selected}
                busy={busy}
                onSave={async (action) => {
                  if (await run(action)) setDialog({ kind: 'detail', id: selected.id })
                }}
              />
            )}
            {dialog.kind === 'import' && (
              <ImportForm
                busy={busy}
                creators={creators}
                campaigns={campaigns}
                onSave={async (action) => {
                  if (await run(action)) setDialog(null)
                }}
              />
            )}
            {dialog.kind === 'links' && (
              <BulkLinks
                busy={busy}
                creators={creators}
                campaigns={campaigns}
                onSave={async (action) => {
                  if (await run(action)) setDialog(null)
                }}
              />
            )}
          </Modal>
        )}
      </div>
    </AdminWorkspace>
  )
}

function Empty({
  kind,
  onAdd,
  onReset,
}: {
  kind: string
  onAdd?: () => void
  onReset?: () => void
}) {
  return (
    <div className="analytics-empty">
      <span className="analytics-empty-icon">
        <ChartNoAxesCombined size={26} strokeWidth={1.3} />
      </span>
      <h3>
        {onReset
          ? 'Nothing matches these filters.'
          : kind === 'formats'
            ? 'A playbook built from your own posts.'
            : `A little room for your ${kind}.`}
      </h3>
      <p>
        {onReset
          ? 'Try a different platform, creator, or search.'
          : kind === 'videos'
            ? 'Paste a published post URL to start building your history.'
            : kind === 'profiles'
              ? 'Track a profile to see follower history and organize its posts.'
              : kind === 'formats'
                ? 'Add format tags to your videos, then compare their performance here.'
                : 'Group your posts and see which ideas are finding their audience.'}
      </p>
      {onReset ? (
        <button className="studio-button secondary small" onClick={onReset}>
          Clear filters
        </button>
      ) : (
        onAdd && (
          <button className="studio-button secondary small" onClick={onAdd}>
            {kind === 'formats'
              ? 'Open videos'
              : `Add ${kind === 'profiles' ? 'a profile' : kind === 'videos' ? 'a video' : 'a campaign'}`}
            <Plus size={14} />
          </button>
        )
      )}
    </div>
  )
}
function VideoTable({
  videos,
  creators,
  onSelect,
}: {
  videos: AnalyticsItem[]
  creators: AnalyticsItem[]
  onSelect: (id: string) => void
}) {
  return (
    <div className="analytics-table-scroll">
      <table className="analytics-table">
        <caption className="sr-only">Tracked video performance</caption>
        <thead>
          <tr>
            <th>Video</th>
            <th>Platform</th>
            <th>Views</th>
            <th>Likes</th>
            <th>Comments</th>
            <th>Engagement</th>
            <th>Last recorded</th>
          </tr>
        </thead>
        <tbody>
          {videos.map((v) => (
            <tr key={v.id}>
              <td>
                <button className="analytics-video-link" onClick={() => onSelect(v.id)}>
                  <span className="analytics-thumbnail">
                    {v.thumbnail ? (
                      <img
                        src={v.thumbnail}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <Film size={18} strokeWidth={1.2} />
                    )}
                  </span>
                  <span>
                    <strong>{v.title}</strong>
                    <small>
                      {creators.find((c) => c.id === v.creatorId)?.title ??
                        (v.handle ? `@${v.handle}` : 'Unassigned creator')}
                      {v.tags.length ? ` · ${v.tags.slice(0, 2).join(', ')}` : ''}
                    </small>
                    {v.error && <em className="analytics-item-error">Refresh needs attention</em>}
                  </span>
                </button>
              </td>
              <td>
                <Badge platform={v.platform} />
              </td>
              <td>{compact(v.metrics?.views)}</td>
              <td>{compact(v.metrics?.likes)}</td>
              <td>{compact(v.metrics?.comments)}</td>
              <td>{engagement(v) == null ? '—' : `${engagement(v)!.toFixed(2)}%`}</td>
              <td className="analytics-muted">
                {v.lastFetched ? when(v.lastFetched) : 'Awaiting data'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
function Choices({
  creators,
  campaigns,
  accounts,
  defaultItem,
}: {
  creators: AnalyticsItem[]
  campaigns: AnalyticsItem[]
  accounts?: AnalyticsItem[]
  defaultItem?: AnalyticsItem
}) {
  return (
    <>
      <div className="field-row">
        <label>
          Creator
          <select name="creatorId" defaultValue={defaultItem?.creatorId ?? ''}>
            <option value="">Unassigned</option>
            {creators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Campaign
          <select name="campaignId" defaultValue={defaultItem?.campaignId ?? ''}>
            <option value="">No campaign</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      {accounts && (
        <label>
          Tracked profile
          <select name="accountId" defaultValue={defaultItem?.accountId ?? ''}>
            <option value="">No linked profile</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title} · {platformNames[a.platform!]}
              </option>
            ))}
          </select>
        </label>
      )}
    </>
  )
}
function ItemForm({
  item,
  kind,
  creators,
  campaigns,
  accounts,
  board,
  busy,
  onSave,
}: {
  item?: AnalyticsItem
  kind: AnalyticsItem['kind']
  creators: AnalyticsItem[]
  campaigns: AnalyticsItem[]
  accounts: AnalyticsItem[]
  board: Workspace['ideas']
  busy: boolean
  onSave: (a: AnalyticsAction) => Promise<void>
}) {
  const [localError, setLocalError] = useState('')
  return (
    <form
      className="analytics-form"
      onSubmit={async (e) => {
        e.preventDefault()
        const f = new FormData(e.currentTarget)
        setLocalError('')
        try {
          if (!item && ['account', 'video'].includes(kind)) {
            const parsed = parseAnalyticsUrl(String(f.get('url')))
            if (parsed.kind !== kind)
              throw new Error(
                `This is a ${parsed.kind === 'account' ? 'profile' : 'post'} URL. Choose the matching tracking type.`,
              )
          }
          const fields = {
            autoRefresh: item?.autoRefresh ?? true,
            title: String(f.get('title')).trim(),
            tags: String(f.get('tags') ?? '')
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean),
            notes: String(f.get('notes') ?? ''),
            ...(kind === 'video' || kind === 'account'
              ? {
                  creatorId: String(f.get('creatorId') || '') || null,
                  campaignId: String(f.get('campaignId') || '') || null,
                  autoRefresh: f.get('autoRefresh') === 'on',
                }
              : {}),
            ...(kind === 'video'
              ? {
                  accountId: String(f.get('accountId') || '') || null,
                  boardId: String(f.get('boardId') || '') || null,
                  publishedAt: f.get('publishedAt')
                    ? new Date(String(f.get('publishedAt'))).toISOString()
                    : null,
                }
              : {}),
            ...(kind === 'creator' ? { cpm: Number(f.get('cpm') || 0) } : {}),
            ...(kind === 'campaign' ? { budget: Number(f.get('budget') || 0) } : {}),
          }
          await onSave(
            item
              ? {
                  action: 'edit',
                  id: item.id,
                  version: item.version,
                  ...fields,
                }
              : {
                  action: 'add',
                  kind: kind as 'account' | 'video' | 'creator' | 'campaign',
                  ...fields,
                  ...(['account', 'video'].includes(kind) ? { url: String(f.get('url')) } : {}),
                },
          )
        } catch (e) {
          setLocalError((e as Error).message)
        }
      }}
    >
      <fieldset disabled={busy}>
        {!item && ['account', 'video'].includes(kind) && (
          <label>
            {kind === 'account' ? 'Public profile URL' : 'Published post URL'}
            <input
              name="url"
              type="url"
              required
              placeholder={
                kind === 'account'
                  ? 'https://www.instagram.com/steverossiter_/'
                  : 'https://www.instagram.com/reel/…'
              }
            />
          </label>
        )}
        {item?.url && (
          <a
            className="analytics-original-link"
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open original post or profile
            <ArrowUpRight size={13} />
          </a>
        )}
        <label>
          {kind === 'creator' ? 'Creator name' : kind === 'campaign' ? 'Campaign name' : 'Title'}
          <input
            name="title"
            required
            maxLength={240}
            defaultValue={item?.title}
            placeholder={
              kind === 'creator'
                ? 'Steve Rossiter'
                : kind === 'campaign'
                  ? 'Fall launch'
                  : 'Give it a name you’ll recognize'
            }
          />
        </label>
        {['account', 'video'].includes(kind) && (
          <Choices
            creators={creators}
            campaigns={campaigns}
            accounts={kind === 'video' ? accounts : undefined}
            defaultItem={item}
          />
        )}
        <div className="field-row">
          <label>
            Tags
            <input
              name="tags"
              defaultValue={item?.tags.join(', ')}
              placeholder="Strength tips, nutrition, training"
            />
          </label>
          {kind === 'creator' && (
            <label>
              Estimated earnings per 1,000 views (USD)
              <input
                name="cpm"
                type="number"
                min="0"
                max="100000"
                step="0.01"
                defaultValue={item?.cpm ?? 0}
              />
            </label>
          )}
          {kind === 'campaign' && (
            <label>
              Campaign budget (USD)
              <input
                name="budget"
                type="number"
                min="0"
                max="100000000"
                step="0.01"
                defaultValue={item?.budget ?? 0}
              />
            </label>
          )}
          {kind === 'video' && (
            <label>
              Published date
              <input
                name="publishedAt"
                type="date"
                defaultValue={item?.publishedAt?.slice(0, 10)}
              />
            </label>
          )}
        </div>
        {kind === 'video' && (
          <label>
            Production board card
            <select name="boardId" defaultValue={item?.boardId ?? ''}>
              <option value="">No linked card</option>
              {board.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Notes
          <textarea
            name="notes"
            rows={3}
            maxLength={10000}
            defaultValue={item?.notes}
            placeholder="What did you try? What would you make again?"
          />
        </label>
        {['account', 'video'].includes(kind) && (
          <label className="analytics-checkbox">
            <input name="autoRefresh" type="checkbox" defaultChecked={item?.autoRefresh ?? true} />
            Include in automatic refreshes when enabled
          </label>
        )}
        {localError && (
          <p className="form-error" role="alert">
            {localError}
          </p>
        )}
        <button className="studio-button" type="submit">
          {busy ? 'Saving…' : item ? 'Save changes' : 'Start tracking'}
          <ArrowUpRight size={15} />
        </button>
      </fieldset>
    </form>
  )
}
function VideoDetail({
  item,
  snapshots,
  creators,
  campaigns,
  readOnly,
  busy,
  onEdit,
  onSnapshot,
  onRefresh,
  onArchive,
}: {
  item: AnalyticsItem
  snapshots: Snapshot[]
  creators: AnalyticsItem[]
  campaigns: AnalyticsItem[]
  readOnly: boolean
  busy: boolean
  onEdit: () => void
  onSnapshot: () => void
  onRefresh: () => void
  onArchive: () => void
}) {
  return (
    <div className="analytics-detail">
      <div className="analytics-detail-meta">
        <Badge platform={item.platform} />
        <a href={item.url} target="_blank" rel="noopener noreferrer">
          {item.kind === 'account' ? 'Open profile' : 'Open post'}
          <ArrowUpRight size={14} />
        </a>
        <span>
          {item.kind === 'account'
            ? 'Profile history'
            : item.publishedAt
              ? when(item.publishedAt)
              : 'Published date unavailable'}
        </span>
      </div>
      <div className="analytics-detail-stats">
        {metricNames
          .filter((k) => (item.kind === 'account' ? k === 'followers' : k !== 'followers'))
          .map((k) => (
            <div key={k}>
              <span>{k}</span>
              <strong>{compact(item.metrics?.[k])}</strong>
            </div>
          ))}
      </div>
      <p className="analytics-fineprint">
        Source:{' '}
        {sourceNames[item.source ?? ''] ??
          [...snapshots].reverse().find(() => true)?.source ??
          'Awaiting data'}{' '}
        · Last recorded {when(item.lastFetched)}
      </p>
      {item.error && (
        <p className="form-error" role="alert">
          {item.error}
        </p>
      )}
      {item.discoveryError && (
        <p className="form-error" role="alert">
          Post discovery: {item.discoveryError}
        </p>
      )}
      <p>{item.notes}</p>
      <div className="analytics-detail-labels">
        {item.tags.map((t) => (
          <span key={t}>{t}</span>
        ))}
        {item.creatorId && <span>{creators.find((c) => c.id === item.creatorId)?.title}</span>}
        {item.campaignId && <span>{campaigns.find((c) => c.id === item.campaignId)?.title}</span>}
        {item.boardId && (
          <a href="/admin/content">
            Linked production card
            <ArrowUpRight size={12} />
          </a>
        )}
      </div>
      {!readOnly && (
        <div className="analytics-toolbar">
          <button
            className="studio-button small"
            disabled={busy || item.archived}
            onClick={onRefresh}
          >
            <RefreshCw size={14} />
            Refresh metrics
          </button>
          <button className="studio-button secondary small" disabled={busy} onClick={onSnapshot}>
            Record snapshot
          </button>
          <button className="text-link" onClick={onEdit}>
            Edit details
          </button>
          <button
            className="text-link"
            disabled={busy}
            hidden={item.kind === 'account'}
            onClick={onArchive}
          >
            {item.archived ? 'Restore' : 'Archive'}
          </button>
        </div>
      )}
      <div className="analytics-panel-heading">
        <h3>Recorded history</h3>
        <button
          className="text-link"
          disabled={!snapshots.length}
          onClick={() =>
            download(
              item.kind === 'account'
                ? 'rossiter-profile-history.csv'
                : 'rossiter-video-history.csv',
              [
                [
                  'capturedAt',
                  ...metricNames.filter((k) =>
                    item.kind === 'account' ? k === 'followers' : k !== 'followers',
                  ),
                  'source',
                ],
                ...snapshots.map((s) => [
                  s.capturedAt,
                  ...metricNames
                    .filter((k) =>
                      item.kind === 'account' ? k === 'followers' : k !== 'followers',
                    )
                    .map((k) => s.metrics[k]),
                  s.source,
                ]),
              ],
            )
          }
        >
          Export history
          <ArrowDownToLine size={14} />
        </button>
      </div>
      {snapshots.length ? (
        <div className="analytics-history">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Recorded</th>
                {(item.kind === 'account' ? ['followers'] : ['views', 'likes', 'comments']).map(
                  (key) => (
                    <th key={key}>{key[0].toUpperCase() + key.slice(1)}</th>
                  ),
                )}
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {[...snapshots].reverse().map((s) => (
                <tr key={s.capturedAt}>
                  <td>{new Date(s.capturedAt).toLocaleString()}</td>
                  {(item.kind === 'account'
                    ? (['followers'] as const)
                    : (['views', 'likes', 'comments'] as const)
                  ).map((key) => (
                    <td key={key}>{compact(s.metrics[key])}</td>
                  ))}
                  <td>{sourceNames[s.source] ?? s.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="analytics-fineprint">
          No history yet. The first successful refresh or import will start it.
        </p>
      )}
    </div>
  )
}
function SnapshotForm({
  item,
  busy,
  onSave,
}: {
  item: AnalyticsItem
  busy: boolean
  onSave: (a: AnalyticsAction) => Promise<void>
}) {
  return (
    <form
      className="analytics-form"
      onSubmit={async (e) => {
        e.preventDefault()
        const f = new FormData(e.currentTarget)
        const metrics: Metrics = {}
        for (const key of metricNames)
          if (f.get(key) !== null && f.get(key) !== '') metrics[key] = Number(f.get(key))
        await onSave({
          action: 'snapshot',
          id: item.id,
          capturedAt: new Date(String(f.get('capturedAt'))).toISOString(),
          metrics,
        })
      }}
    >
      <fieldset disabled={busy}>
        <p>Record the numbers shown by the platform. Leave unavailable metrics blank.</p>
        <label>
          Recorded at
          <input
            name="capturedAt"
            type="datetime-local"
            required
            max={new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
              .toISOString()
              .slice(0, 16)}
            defaultValue={new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
              .toISOString()
              .slice(0, 16)}
          />
        </label>
        <div className="analytics-snapshot-fields">
          {metricNames
            .filter((k) => (item.kind === 'account' ? k === 'followers' : k !== 'followers'))
            .map((k) => (
              <label key={k}>
                {k[0].toUpperCase() + k.slice(1)}
                <input
                  name={k}
                  type="number"
                  min="0"
                  max={Number.MAX_SAFE_INTEGER}
                  step="1"
                  placeholder="Unavailable"
                />
              </label>
            ))}
        </div>
        <button className="studio-button">
          Save snapshot
          <Check size={15} />
        </button>
      </fieldset>
    </form>
  )
}
function ImportForm({
  busy,
  creators,
  campaigns,
  onSave,
}: {
  busy: boolean
  creators: AnalyticsItem[]
  campaigns: AnalyticsItem[]
  onSave: (a: AnalyticsAction) => Promise<void>
}) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  return (
    <form
      className="analytics-form"
      onSubmit={async (e) => {
        e.preventDefault()
        setError('')
        try {
          const f = new FormData(e.currentTarget)
          const rows = parseCSV(text)
          const headers = rows.shift()!.map((v) =>
            v
              .replace(/^\uFEFF/, '')
              .trim()
              .toLowerCase(),
          )
          const urlIndex = headers.findIndex((v) =>
            ['url', 'video url', 'post url', 'permalink'].includes(v),
          )
          if (urlIndex < 0)
            throw new Error('Include a url column. Download the template for the supported format.')
          const field = (row: string[], name: string) => row[headers.indexOf(name)]
          const parsed = rows.map((row) => {
            const metrics: Metrics = {}
            for (const key of metricNames.filter((k) => k !== 'followers')) {
              const raw = field(row, key)
              if (raw != null && raw.trim() !== '') {
                const value = Number(raw.replaceAll(',', ''))
                if (!Number.isSafeInteger(value) || value < 0)
                  throw new Error(`Invalid ${key} value. Use whole numbers or leave it blank.`)
                metrics[key] = value
              }
            }
            if (!Object.values(metrics).some((v) => v != null))
              throw new Error(
                'Each row needs at least one metric. Use bulk links to add URLs without metrics.',
              )
            const date = field(row, 'capturedat') || new Date().toISOString()
            if (!Number.isFinite(new Date(date).getTime()))
              throw new Error('Use an ISO date in capturedAt.')
            return {
              url: row[urlIndex],
              title: field(row, 'title') || undefined,
              capturedAt: new Date(date).toISOString(),
              metrics,
              creatorId: String(f.get('creatorId') || '') || null,
              campaignId: String(f.get('campaignId') || '') || null,
            }
          })
          await onSave({ action: 'import', rows: parsed })
        } catch (e) {
          setError((e as Error).message)
        }
      }}
    >
      <fieldset disabled={busy}>
        <p>
          Import up to 200 snapshots at a time. URLs are deduplicated, so repeated imports build
          history.
        </p>
        <button
          type="button"
          className="text-link"
          onClick={() =>
            download('rossiter-analytics-template.csv', [
              ['url', 'title', 'capturedAt', 'views', 'likes', 'comments', 'shares', 'saves'],
              [
                'https://www.youtube.com/watch?v=abcdefghijk',
                'Example video',
                new Date().toISOString(),
                100,
                10,
                2,
                '',
                '',
              ],
            ])
          }
        >
          Download CSV template
          <ArrowDownToLine size={14} />
        </button>
        <label>
          Choose CSV file
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              if (file.size > 1024 * 1024) {
                setError('Use a CSV file smaller than 1 MB.')
                return
              }
              setText(await file.text())
            }}
          />
        </label>
        <label>
          CSV contents
          <textarea
            rows={7}
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
            placeholder="url,title,capturedAt,views,likes,comments,shares,saves"
          />
        </label>
        <Choices creators={creators} campaigns={campaigns} />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="studio-button">
          Import snapshots
          <ArrowUpRight size={15} />
        </button>
      </fieldset>
    </form>
  )
}
function BulkLinks({
  busy,
  creators,
  campaigns,
  onSave,
}: {
  busy: boolean
  creators: AnalyticsItem[]
  campaigns: AnalyticsItem[]
  onSave: (a: AnalyticsAction) => Promise<void>
}) {
  return (
    <form
      className="analytics-form"
      onSubmit={async (e) => {
        e.preventDefault()
        const f = new FormData(e.currentTarget)
        await onSave({
          action: 'add-links',
          urls: String(f.get('urls'))
            .split('\n')
            .map((v) => v.trim())
            .filter(Boolean),
          creatorId: String(f.get('creatorId') || '') || null,
          campaignId: String(f.get('campaignId') || '') || null,
        })
      }}
    >
      <fieldset disabled={busy}>
        <label>
          Profile and video URLs
          <textarea
            name="urls"
            rows={8}
            required
            placeholder="One public URL per line · up to 200 links"
          />
        </label>
        <Choices creators={creators} campaigns={campaigns} />
        <button className="studio-button">
          Track these links
          <Plus size={15} />
        </button>
      </fieldset>
    </form>
  )
}

function ScrapeSettings({
  data,
  busy,
  run,
}: {
  data: AnalyticsWorkspace
  busy: boolean
  run: (a: AnalyticsAction) => Promise<boolean>
}) {
  return (
    <div className="analytics-settings-grid">
      <section className="analytics-panel">
        <span className="studio-eyebrow">PUBLIC PAGES · DAILY HISTORY</span>
        <h2>Daily scraping</h2>
        <p>
          Instagram profiles and posts are read from their public pages. TikTok video counts come
          from public embeds. No account connection is needed.
        </p>
        <div className="analytics-connection-list">
          {analyticsPlatforms.map((platform) => (
            <div key={platform}>
              <Badge platform={platform} />
              <span>
                {platform === 'instagram'
                  ? 'Public followers, posts and exposed engagement counts'
                  : platform === 'tiktok'
                    ? 'Public profile and video embeds'
                    : platform === 'youtube'
                      ? 'Public subscribers, uploaded videos and Shorts'
                      : platform === 'facebook'
                        ? 'Public profile followers and visible posts'
                        : 'Public counts where available; manual snapshots and CSV'}
              </span>
            </div>
          ))}
        </div>
        <p className="analytics-fineprint">
          Public feeds may contain only recent posts. If a platform requires login or hides a count,
          add individual URLs or record a snapshot. Hidden counts stay unavailable; failed scrapes
          keep your last saved values.
        </p>
      </section>
      <section className="analytics-panel">
        <span className="studio-eyebrow">KEEP THE NUMBERS MOVING</span>
        <h2>Refresh preferences</h2>
        <p>
          Enabled profiles and posts are scraped once every 24 hours. New posts found on tracked
          profiles are added automatically.
        </p>
        <form
          className="analytics-form"
          key={`${data.settings.automatic}-${data.settings.dailyLimit}`}
          onSubmit={async (e) => {
            e.preventDefault()
            const fields = new FormData(e.currentTarget)
            await run({
              action: 'settings',
              automatic: fields.get('automatic') === 'on',
              intervalHours: 24,
              dailyLimit: Number(fields.get('limit')),
            })
          }}
        >
          <fieldset disabled={busy}>
            <label className="analytics-checkbox">
              <input type="checkbox" name="automatic" defaultChecked={data.settings.automatic} />{' '}
              Automatically scrape daily
            </label>
            <label>
              Maximum public requests per day
              <input
                name="limit"
                type="number"
                min="1"
                max="5000"
                required
                defaultValue={data.settings.dailyLimit}
              />
            </label>
            <div className="analytics-usage">
              <strong>
                {data.settings.requestsToday}
                <span> / {data.settings.dailyLimit}</span>
              </strong>
              <p>Requests today · resets at midnight UTC</p>
            </div>
            <p className="analytics-fineprint">
              Due items are checked every 15 minutes. Individual profiles and videos refresh daily.
              Redirects and TikTok embed fallbacks count toward the daily limit.
            </p>
            <button className="studio-button">
              Save preferences
              <Check size={15} />
            </button>
          </fieldset>
        </form>
        <h3>Steve’s accounts</h3>
        <div className="analytics-connection-list">
          {coachingAnalyticsAccounts.map((account) => (
            <div key={account.platform}>
              <Badge platform={account.platform} />
              <a href={account.url} target="_blank" rel="noopener noreferrer">
                {account.title}
                <ArrowUpRight size={13} />
              </a>
            </div>
          ))}
        </div>
        <button
          className="studio-button secondary"
          disabled={busy}
          onClick={() =>
            void run({
              action: 'add-links',
              urls: coachingAnalyticsAccounts.map((account) => account.url),
            })
          }
        >
          <Plus size={15} /> Track Steve’s four profiles
        </button>
      </section>
    </div>
  )
}
