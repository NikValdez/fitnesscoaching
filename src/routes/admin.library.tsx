import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowUpRight,
  Library,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import { SiInstagram, SiTiktok } from 'react-icons/si'
import { AdminWorkspace } from '../components/admin-workspace'
import { Notice, WorkspaceModal } from '../components/workspace'
import { useStudio, useStudioState } from '../components/use-studio'
import { getLibraryWorkspace, saveLibraryEntry, deleteLibraryEntry } from '../lib/library'
import { libraryPlatforms, parseVideoLink, type LibraryPlatform } from '../lib/library-validation'
import adminStylesheet from '../admin.css?url'
import libraryStylesheet from '../content-library.css?url'

export const Route = createFileRoute('/admin/library')({
  head: () => ({
    meta: [
      { title: 'Content library — Steve Rossiter' },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
    links: [
      { rel: 'stylesheet', href: adminStylesheet },
      { rel: 'stylesheet', href: libraryStylesheet },
    ],
  }),
  headers: () => ({ 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, noarchive' }),
  staleTime: 0,
  gcTime: 0,
  loader: () => getLibraryWorkspace(),
  component: ContentLibrary,
})

type SavedLibrary = Awaited<ReturnType<typeof getLibraryWorkspace>>['library']
type Entry = SavedLibrary['entries'][number]
type Draft = { url: string; title: string; notes: string }
const platformIcons = { INSTAGRAM: SiInstagram, TIKTOK: SiTiktok }
const dateLabel = (date: Date) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)

function ContentLibrary() {
  const data = Route.useLoaderData()
  const [library, setLibrary] = useState(data.library)
  const [search, setSearch] = useState('')
  const [platform, setPlatform] = useState<LibraryPlatform | 'ALL'>('ALL')
  const [editor, setEditor] = useState<{ entry?: Entry } | null>(null)
  const [removing, setRemoving] = useState<Entry | null>(null)
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const provider = useStudio('library')
  const live = useStudioState(provider)
  useEffect(() => setLibrary(data.library), [data.library])
  useEffect(() => {
    if (!provider || busy) return
    let disposed = false
    const refresh = async () => {
      try {
        const next = (await getLibraryWorkspace()).library
        if (!disposed && !pending.current)
          setLibrary((current) => (next.revision > current.revision ? next : current))
      } catch {
        /* Reconnect/focus polling retries while preserving open drafts. */
      }
    }
    const stop = provider.onRefresh(() => void refresh())
    const timer = setInterval(() => void refresh(), 15000)
    window.addEventListener('focus', refresh)
    void refresh()
    return () => {
      disposed = true
      stop()
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [provider, busy])

  function open(entry?: Entry) {
    setError('')
    setNotice('')
    setEditor({ entry })
  }

  async function mutate(action: (revision: number) => Promise<SavedLibrary>, message: string) {
    if (pending.current) return false
    pending.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      let next: SavedLibrary
      try {
        next = await action(library.revision)
      } catch (cause) {
        if (!(cause instanceof Error) || !cause.message.includes('library changed')) throw cause
        const latest = (await getLibraryWorkspace()).library
        setLibrary(latest)
        next = await action(latest.revision)
      }
      setLibrary(next)
      setNotice(message)
      return true
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not save this change. Please try again.',
      )
      return false
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  const query = search.trim().toLowerCase()
  const entries = library.entries.filter(
    (entry) =>
      (platform === 'ALL' || entry.platform === platform) &&
      (!query || `${entry.title} ${entry.notes} ${entry.url}`.toLowerCase().includes(query)),
  )

  return (
    <AdminWorkspace name={data.user.name} current="library">
      <div className="library-heading">
        <div className="admin-page-heading">
          <span className="eyebrow">Keep what sparks an idea</span>
          <h1>Content library.</h1>
          <p>
            A shared collection of Instagram and TikTok videos. Save a good hook, a fresh angle, or
            something worth coming back to.
          </p>
        </div>
        <button className="button" disabled={busy} onClick={() => open()}>
          <Plus size={17} /> Save link
        </button>
      </div>

      {notice && <Notice message={notice} onClose={() => setNotice('')} />}
      {error && !editor && !removing && (
        <Notice error message={error} onClose={() => setError('')} />
      )}
      <div className="library-tools">
        <label className="library-search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search library</span>
          <input
            type="search"
            placeholder="Search titles, notes, or links…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div className="library-filters" role="group" aria-label="Filter by platform">
          <button aria-pressed={platform === 'ALL'} onClick={() => setPlatform('ALL')}>
            All
          </button>
          {libraryPlatforms.map((item) => {
            const Icon = platformIcons[item.id]
            return (
              <button
                key={item.id}
                aria-pressed={platform === item.id}
                onClick={() => setPlatform(item.id)}
              >
                <Icon size={15} aria-hidden="true" />
                {item.label}
              </button>
            )
          })}
        </div>
      </div>
      <div className="library-summary">
        <span>
          {entries.length} {entries.length === 1 ? 'saved link' : 'saved links'}
          {query || platform !== 'ALL' ? ` of ${library.entries.length}` : ''}
        </span>
        <div>
          <span className="library-live" role="status">
            {busy
              ? 'Saving…'
              : live.phase === 'saved'
                ? 'Live shared library'
                : live.phase === 'denied'
                  ? 'Admin session ended'
                  : 'Connecting to shared library…'}
          </span>
          <button
            className="icon-button"
            aria-label="Refresh library"
            disabled={busy}
            onClick={() =>
              void mutate(async () => (await getLibraryWorkspace()).library, 'Library refreshed.')
            }
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {entries.length ? (
        <div className="library-grid" aria-label="Saved inspiration">
          {entries.map((entry) => {
            const isInstagram = entry.platform === 'INSTAGRAM'
            const Icon = isInstagram ? SiInstagram : SiTiktok
            const label = isInstagram ? 'Instagram' : 'TikTok'
            return (
              <article key={entry.id} className="library-entry" data-library-id={entry.id}>
                <div className="library-entry-top">
                  <span className={`library-platform platform-${entry.platform.toLowerCase()}`}>
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <span>{label}</span>
                  <time dateTime={entry.createdAt.toISOString()}>{dateLabel(entry.createdAt)}</time>
                </div>
                <h2>{entry.title}</h2>
                {entry.notes && <p className="library-entry-notes">{entry.notes}</p>}
                <p className="library-entry-url" title={entry.url}>
                  {entry.url.replace('https://', '')}
                </p>
                <a
                  className="library-watch"
                  href={entry.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open on {label}
                  <ArrowUpRight size={16} aria-hidden="true" />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
                <div className="library-entry-actions">
                  <button
                    disabled={busy}
                    aria-label={`Edit ${entry.title}`}
                    aria-haspopup="dialog"
                    onClick={() => open(entry)}
                  >
                    <Pencil size={14} aria-hidden="true" />
                    Edit
                  </button>
                  <button
                    disabled={busy}
                    className="library-delete"
                    aria-label={`Delete ${entry.title}`}
                    aria-haspopup="dialog"
                    onClick={() => {
                      setError('')
                      setNotice('')
                      setRemoving(entry)
                    }}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    Delete
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="library-empty">
          <span>
            <Library size={28} strokeWidth={1.5} />
          </span>
          <h2>
            {library.entries.length
              ? 'Nothing in this view, yet.'
              : 'A little inspiration starts here.'}
          </h2>
          <p>
            {library.entries.length
              ? 'Try another platform or search for a different word.'
              : 'Save an Instagram or TikTok video for the whole team to revisit.'}
          </p>
          {library.entries.length ? (
            <button
              className="button button-outline"
              onClick={() => {
                setSearch('')
                setPlatform('ALL')
              }}
            >
              Clear filters
            </button>
          ) : (
            <button className="button" onClick={() => open()}>
              <Plus size={16} />
              Save your first link
            </button>
          )}
        </div>
      )}

      {editor && (
        <LibraryEditor
          initial={editor.entry}
          busy={busy}
          error={error}
          onClose={() => {
            setEditor(null)
            setError('')
          }}
          onSave={async (draft) => {
            const saved = await mutate(
              (revision) =>
                saveLibraryEntry({
                  data: {
                    ...draft,
                    revision,
                    id: editor.entry?.id,
                    expectedUpdatedAt: editor.entry?.updatedAt.toISOString(),
                  },
                }),
              editor.entry ? 'Link updated for the team.' : 'Link saved to the shared library.',
            )
            if (saved) setEditor(null)
          }}
        />
      )}
      {removing && (
        <WorkspaceModal
          title="Delete this link?"
          label="Content library"
          busy={busy}
          onClose={() => {
            setRemoving(null)
            setError('')
          }}
        >
          <p>“{removing.title}” and its notes will be removed from the shared library.</p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="button-row">
            <button
              className="button button-danger"
              disabled={busy}
              onClick={async () => {
                const removed = await mutate(
                  (revision) =>
                    deleteLibraryEntry({
                      data: {
                        id: removing.id,
                        expectedUpdatedAt: removing.updatedAt.toISOString(),
                        revision,
                      },
                    }),
                  'Link removed from the shared library.',
                )
                if (removed) setRemoving(null)
              }}
            >
              {busy ? 'Deleting…' : 'Delete link'}
            </button>
            <button
              className="button button-outline"
              disabled={busy}
              onClick={() => {
                setRemoving(null)
                setError('')
              }}
            >
              Keep link
            </button>
          </div>
        </WorkspaceModal>
      )}
    </AdminWorkspace>
  )
}

function LibraryEditor({
  initial,
  busy,
  error,
  onClose,
  onSave,
}: {
  initial?: Entry
  busy: boolean
  error: string
  onClose: () => void
  onSave: (draft: Draft) => Promise<void>
}) {
  const [draft, setDraft] = useState<Draft>({
    url: initial?.url ?? '',
    title: initial?.title ?? '',
    notes: initial?.notes ?? '',
  })
  const [validation, setValidation] = useState('')
  const link = parseVideoLink(draft.url)
  const Icon = link ? platformIcons[link.platform] : null
  return (
    <WorkspaceModal
      title={initial ? 'Keep the inspiration clear.' : 'Found something good?'}
      label={initial ? 'Edit saved link' : 'Save a video'}
      busy={busy}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!link) {
            setValidation('Paste an Instagram Reel, video post, or TikTok video link.')
            return
          }
          setValidation('')
          void onSave(draft)
        }}
      >
        <fieldset disabled={busy} className="library-editor-fields">
          <label>
            Video link
            <input
              type="url"
              autoFocus
              required
              maxLength={2048}
              value={draft.url}
              placeholder="https://www.instagram.com/reel/…"
              onChange={(event) => {
                setDraft({ ...draft, url: event.target.value })
                setValidation('')
              }}
            />
          </label>
          {link && Icon ? (
            <span className="library-link-platform">
              <Icon size={15} aria-hidden="true" />
              {link.platform === 'INSTAGRAM' ? 'Instagram' : 'TikTok'} video
            </span>
          ) : (
            <p className="form-note">
              Instagram Reels and video posts, TikTok videos, and TikTok share links.
            </p>
          )}
          <label>
            Title (optional)
            <input
              maxLength={160}
              value={draft.title}
              placeholder="A strong opening hook…"
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          </label>
          <div className="library-field">
            <label htmlFor="library-notes">Notes (optional)</label>
            <textarea
              id="library-notes"
              rows={5}
              maxLength={4000}
              value={draft.notes}
              placeholder="What caught your eye? A hook, filming style, or an idea to try…"
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
            />
          </div>
        </fieldset>
        {(validation || error) && (
          <p className="form-error" role="alert">
            {validation || error}
          </p>
        )}
        <div className="button-row library-editor-actions">
          <button type="button" className="button button-outline" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="button" disabled={busy || !draft.url.trim()}>
            {busy ? (
              <>
                <LoaderCircle size={15} className="spin" />
                Saving…
              </>
            ) : initial ? (
              'Save changes'
            ) : (
              'Save link'
            )}
          </button>
        </div>
      </form>
    </WorkspaceModal>
  )
}
