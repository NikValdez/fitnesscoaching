import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Check,
  Lightbulb,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import { AdminWorkspace } from '../components/admin-workspace'
import { Notice, WorkspaceModal } from '../components/workspace'
import {
  getScratchWorkspace,
  saveScratch,
  editScratch,
  deleteScratch,
  convertScratch,
} from '../lib/scratch'
import { scratchTitle } from '../lib/scratch-validation'
import { contentFormats, contentStages, type ContentFormat } from '../lib/content-validation'
import adminStylesheet from '../admin.css?url'

export const Route = createFileRoute('/admin/ideas')({
  head: () => ({
    meta: [
      { title: 'Ideas — Steve Rossiter' },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
    links: [{ rel: 'stylesheet', href: adminStylesheet }],
  }),
  headers: () => ({ 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, noarchive' }),
  staleTime: 0,
  gcTime: 0,
  loader: () => getScratchWorkspace(),
  component: IdeasPage,
})

type Scratch = Awaited<ReturnType<typeof getScratchWorkspace>>['ideas'][number]
type Action = { kind: 'edit' | 'convert' | 'delete'; idea: Scratch }

function IdeasPage() {
  const data = Route.useLoaderData()
  const [ideas, setIdeas] = useState(data.ideas)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [action, setAction] = useState<Action | null>(null)
  useEffect(() => setIdeas(data.ideas), [data.ideas])

  async function mutate(change: () => Promise<void>, message: string) {
    if (pending.current) return false
    pending.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await change()
      setNotice(message)
      return true
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not save your idea. Please try again.',
      )
      return false
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  function replace(idea: Scratch) {
    setIdeas((current) => current.map((item) => (item.id === idea.id ? idea : item)))
  }

  async function refresh() {
    await mutate(async () => {
      const latest = await getScratchWorkspace()
      setIdeas(latest.ideas)
      setAction((current) => {
        if (!current) return null
        const idea = latest.ideas.find((item) => item.id === current.idea.id)
        return idea ? { ...current, idea } : null
      })
    }, 'Ideas refreshed. Your unsaved writing is still here.')
  }

  const filtered = ideas.filter((idea) => idea.body.toLowerCase().includes(search.toLowerCase()))
  return (
    <AdminWorkspace name={data.user.name} current="ideas">
      <div className="admin-page-heading">
        <span className="eyebrow">Room for a little inspiration</span>
        <h1>Ideas, before the plan.</h1>
        <p>
          A thought, a hook, a half-formed something. Get it down here. Give it a card when you’re
          ready.
        </p>
      </div>
      {error && !action && <Notice error message={error} onClose={() => setError('')} />}
      {notice && <Notice message={notice} onClose={() => setNotice('')} />}
      <div className="ideas-layout">
        <section className="ideas-composer" aria-labelledby="scratch-heading">
          <div className="ideas-composer-heading">
            <span className="ideas-icon">
              <Pencil size={20} />
            </span>
            <span className="eyebrow">The scratch pad</span>
          </div>
          <h2 id="scratch-heading">Start with a thought.</h2>
          <p>No brief needed. Just make a little room for what’s on your mind.</p>
          <form
            onSubmit={async (event) => {
              event.preventDefault()
              await mutate(async () => {
                const idea = await saveScratch({ data: { body: draft } })
                setIdeas((current) => [idea, ...current])
                setDraft('')
              }, 'Idea saved to your scratch pad.')
            }}
          >
            <label htmlFor="scratch-draft" className="sr-only">
              Your idea
            </label>
            <textarea
              id="scratch-draft"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={busy}
              required
              maxLength={10000}
              placeholder={
                'An idea for a reel…\nA question clients keep asking…\nSomething worth coming back to…'
              }
            />
            <div className="ideas-composer-foot">
              <span>{draft.trim() ? 'Unsaved idea' : 'Only admins can see this.'}</span>
              <span>{draft.length.toLocaleString()} / 10,000</span>
            </div>
            <button className="button" disabled={busy || !draft.trim()}>
              {busy ? <LoaderCircle size={17} className="spin" /> : <Plus size={17} />}{' '}
              {busy ? 'Saving…' : 'Save idea'}
            </button>
          </form>
          <span className="ideas-scribble">Good things start somewhere.</span>
        </section>
        <section className="ideas-library" aria-labelledby="saved-ideas-heading">
          <div className="ideas-library-heading">
            <div>
              <span className="eyebrow">Keep the spark</span>
              <h2 id="saved-ideas-heading">
                Saved ideas <span>{ideas.length}</span>
              </h2>
            </div>
            <button
              className="icon-button"
              aria-label="Refresh ideas"
              disabled={busy}
              onClick={() => void refresh()}
            >
              <RefreshCw size={18} />
            </button>
          </div>
          {ideas.length > 0 && (
            <label className="ideas-search">
              <Search size={17} />
              <span className="sr-only">Search ideas</span>
              <input
                type="search"
                placeholder="Find a thought…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          )}
          <div className="ideas-list" aria-busy={busy}>
            {filtered.map((idea) => (
              <article className="scratch-note" key={idea.id} data-scratch-id={idea.id}>
                <div className="scratch-note-meta">
                  <span className="eyebrow">{idea.card ? 'On the board' : 'A little spark'}</span>
                  <div>
                    <button
                      className="icon-button"
                      aria-label={`Edit ${scratchTitle(idea.body)}`}
                      disabled={busy}
                      onClick={() => {
                        setError('')
                        setAction({ kind: 'edit', idea })
                      }}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Delete ${scratchTitle(idea.body)}`}
                      disabled={busy}
                      onClick={() => {
                        setError('')
                        setAction({ kind: 'delete', idea })
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <h3>{scratchTitle(idea.body)}</h3>
                <p className="scratch-note-body">
                  {idea.body.split('\n').slice(1).join('\n').trim()}
                </p>
                <div className="scratch-note-foot">
                  <time dateTime={new Date(idea.createdAt).toISOString()}>
                    {new Date(idea.createdAt).toLocaleDateString('en-CA', {
                      month: 'short',
                      day: 'numeric',
                      timeZone: 'UTC',
                    })}
                  </time>
                  {idea.card ? (
                    <Link className="scratch-card-link" to="/admin/content">
                      <Check size={14} />{' '}
                      {contentStages.find((stage) => stage.id === idea.card?.stage)?.label}{' '}
                      <ArrowRight size={15} />
                    </Link>
                  ) : (
                    <button
                      className="scratch-convert"
                      disabled={busy}
                      onClick={() => {
                        setError('')
                        setAction({ kind: 'convert', idea })
                      }}
                    >
                      Create card <ArrowRight size={15} />
                    </button>
                  )}
                </div>
              </article>
            ))}
            {!filtered.length && (
              <div className="ideas-empty">
                <Lightbulb size={28} />
                <h3>
                  {ideas.length
                    ? 'Nothing here just yet.'
                    : 'Every good thing starts with an idea.'}
                </h3>
                <p>
                  {ideas.length
                    ? 'Try a different word or clear your search.'
                    : 'Save your first thought in the scratch pad. It will be here when you’re ready to take it further.'}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
      {action && (
        <ScratchDialog
          key={`${action.kind}-${action.idea.id}`}
          action={action}
          busy={busy}
          error={error}
          onRefresh={refresh}
          onClose={() => {
            setAction(null)
            setError('')
          }}
          onSave={async (values) => {
            const success = await mutate(
              async () => {
                const reference = { id: action.idea.id, revision: action.idea.revision }
                if (action.kind === 'delete') {
                  await deleteScratch({ data: reference })
                  setIdeas((current) => current.filter((item) => item.id !== action.idea.id))
                } else if (action.kind === 'edit') {
                  replace(await editScratch({ data: { ...reference, body: values.body } }))
                } else {
                  replace(
                    await convertScratch({
                      data: { ...reference, title: values.title, format: values.format },
                    }),
                  )
                }
              },
              action.kind === 'delete'
                ? 'Idea deleted.'
                : action.kind === 'convert'
                  ? 'Card created in Concepts. Your original idea is still here.'
                  : 'Idea updated.',
            )
            if (success) setAction(null)
          }}
        />
      )}
    </AdminWorkspace>
  )
}

function ScratchDialog({
  action,
  busy,
  error,
  onRefresh,
  onClose,
  onSave,
}: {
  action: Action
  busy: boolean
  error: string
  onRefresh: () => Promise<void>
  onClose: () => void
  onSave: (values: { body: string; title: string; format: ContentFormat }) => Promise<void>
}) {
  const [body, setBody] = useState(action.idea.body)
  const [title, setTitle] = useState(scratchTitle(action.idea.body))
  const [format, setFormat] = useState<ContentFormat>('VIDEO')
  return (
    <WorkspaceModal
      title={
        action.kind === 'edit'
          ? 'A little more to the idea.'
          : action.kind === 'convert'
            ? 'Give this idea a card.'
            : 'Delete this idea?'
      }
      label="Content Studio / Ideas"
      onClose={onClose}
      busy={busy}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void onSave({ body, title, format })
        }}
      >
        {action.kind === 'edit' && (
          <>
            <div className="scratch-edit-field">
              <label htmlFor="scratch-edit-body">Idea</label>
              <textarea
                id="scratch-edit-body"
                autoFocus
                value={body}
                onChange={(event) => setBody(event.target.value)}
                required
                maxLength={10000}
                rows={10}
                disabled={busy}
              />
            </div>
            {action.idea.card && (
              <p className="form-note">Your existing board card keeps its own notes.</p>
            )}
          </>
        )}
        {action.kind === 'convert' && (
          <>
            <p className="scratch-dialog-copy">
              Create a card in Concepts with this idea as its notes. The original stays in your
              scratch pad.
            </p>
            <label>
              Card title
              <input
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                maxLength={160}
                disabled={busy}
              />
            </label>
            <label>
              Format
              <select
                value={format}
                onChange={(event) => setFormat(event.target.value as ContentFormat)}
                disabled={busy}
              >
                {contentFormats.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <blockquote className="scratch-preview">{action.idea.body}</blockquote>
          </>
        )}
        {action.kind === 'delete' && (
          <p className="scratch-dialog-copy">
            “{scratchTitle(action.idea.body)}” will be removed from Ideas.
            {action.idea.card ? ' Its board card will stay.' : ''}
          </p>
        )}
        {error && (
          <>
            <p className="form-error" role="alert">
              {error}
            </p>
            <button
              type="button"
              className="text-link"
              disabled={busy}
              onClick={() => void onRefresh()}
            >
              Refresh ideas, keep my draft <RefreshCw size={14} />
            </button>
          </>
        )}
        <div className="button-row">
          <button
            className={`button${action.kind === 'delete' ? ' button-danger' : ''}`}
            disabled={
              busy ||
              (action.kind === 'edit' && !body.trim()) ||
              (action.kind === 'convert' && !title.trim())
            }
          >
            {busy
              ? 'Saving…'
              : action.kind === 'edit'
                ? 'Save changes'
                : action.kind === 'convert'
                  ? 'Create card'
                  : 'Delete idea'}
          </button>
          <button type="button" className="button button-outline" disabled={busy} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </WorkspaceModal>
  )
}
