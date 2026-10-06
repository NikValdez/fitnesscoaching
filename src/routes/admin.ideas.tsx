import { createFileRoute, useBlocker } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Check, Copy, LoaderCircle, Pencil, RefreshCw } from 'lucide-react'
import { AdminWorkspace } from '../components/admin-workspace'
import { getScratchWorkspace, saveScratchPad } from '../lib/scratch'
import { scratchPadLimit } from '../lib/scratch-validation'
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

function IdeasPage() {
  const data = Route.useLoaderData()
  const [draft, setDraft] = useState(data.pad.body)
  const [phase, setPhase] = useState<'saved' | 'unsaved' | 'saving' | 'error' | 'conflict'>('saved')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const saved = useRef(data.pad)
  const writing = useRef(data.pad.body)
  const pending = useRef<Promise<void> | null>(null)
  const blocked = useRef(false)
  const mounted = useRef(true)
  const dirty = () => writing.current !== saved.current.body

  // Drain saves in order. Responses update the revision, never newer local text.
  function save() {
    if (pending.current) return pending.current
    if (!dirty() || blocked.current) return Promise.resolve()
    const work = async () => {
      try {
        if (mounted.current) {
          setPhase('saving')
          setError('')
        }
        while (dirty() && !blocked.current) {
          const result = await saveScratchPad({
            data: { body: writing.current, revision: saved.current.revision },
          })
          if (result.status === 'conflict') {
            blocked.current = true
            if (mounted.current) {
              setPhase('conflict')
              setError(
                'Another admin changed the scratch pad. Your writing is still here. Copy anything you want to keep before loading the saved version.',
              )
            }
            return
          }
          saved.current = result.pad
        }
        if (mounted.current) setPhase('saved')
      } catch {
        if (mounted.current) {
          setPhase('error')
          setError(
            'Your latest changes haven’t saved yet. Keep this page open and retry when you’re connected.',
          )
        }
      }
    }
    pending.current = work().finally(() => {
      pending.current = null
    })
    return pending.current
  }
  const saveRef = useRef(save)
  saveRef.current = save

  useEffect(() => {
    mounted.current = true
    const reconnect = () => void saveRef.current()
    const hide = () => {
      if (document.visibilityState === 'hidden') void saveRef.current()
    }
    window.addEventListener('online', reconnect)
    document.addEventListener('visibilitychange', hide)
    return () => {
      mounted.current = false
      window.removeEventListener('online', reconnect)
      document.removeEventListener('visibilitychange', hide)
    }
  }, [])

  useEffect(() => {
    if (!dirty() && !pending.current && data.pad.revision > saved.current.revision) {
      saved.current = data.pad
      writing.current = data.pad.body
      setDraft(data.pad.body)
      setPhase('saved')
    }
  }, [data.pad])

  useEffect(() => {
    if (!dirty() || blocked.current) return
    const timer = setTimeout(() => void saveRef.current(), 700)
    return () => clearTimeout(timer)
  }, [draft])

  useBlocker({
    shouldBlockFn: async () => {
      await saveRef.current()
      return (
        dirty() &&
        !window.confirm('Your latest scratch pad changes haven’t saved. Leave this page anyway?')
      )
    },
    enableBeforeUnload: dirty,
  })

  async function reloadSaved() {
    try {
      const latest = await getScratchWorkspace()
      saved.current = latest.pad
      writing.current = latest.pad.body
      blocked.current = false
      setDraft(latest.pad.body)
      setPhase('saved')
      setError('')
      setCopied(false)
    } catch {
      setError('Could not load the saved scratch pad. Please try again.')
    }
  }

  return (
    <AdminWorkspace name={data.user.name} current="ideas">
      <div className="admin-page-heading">
        <span className="eyebrow">Room for a little inspiration</span>
        <h1>Ideas, before the plan.</h1>
        <p>A thought, a hook, a half-formed something. Write it here and pick it up later.</p>
      </div>
      <section className="ideas-composer" aria-labelledby="scratch-heading">
        <div className="ideas-composer-heading">
          <span className="ideas-icon">
            <Pencil size={20} />
          </span>
          <h2 id="scratch-heading">The scratch pad</h2>
          <span className="eyebrow">Room to think out loud</span>
        </div>
        <label htmlFor="scratch-draft" className="sr-only">
          Your idea
        </label>
        <textarea
          id="scratch-draft"
          value={draft}
          maxLength={scratchPadLimit}
          placeholder={
            'An idea for a reel…\nA question clients keep asking…\nSomething worth coming back to…'
          }
          onChange={(event) => {
            writing.current = event.target.value
            setDraft(event.target.value)
            setCopied(false)
            if (!blocked.current) {
              setPhase(pending.current ? 'saving' : dirty() ? 'unsaved' : 'saved')
              setError('')
            }
          }}
          onBlur={() => void save()}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
              event.preventDefault()
              void save()
            }
          }}
        />
        <div className="ideas-composer-foot">
          <span className="scratch-save-status" role="status">
            {phase === 'saving' ? (
              <LoaderCircle size={14} className="spin" />
            ) : phase === 'saved' ? (
              <Check size={14} />
            ) : null}
            {phase === 'saved'
              ? 'All changes saved'
              : phase === 'saving'
                ? 'Saving…'
                : phase === 'unsaved'
                  ? 'Unsaved changes'
                  : 'Changes not saved'}
          </span>
          <span>
            {draft.length.toLocaleString()} / {scratchPadLimit.toLocaleString()}
          </span>
        </div>
        {error && (
          <div className="scratch-save-error">
            <p role="alert">{error}</p>
            <div className="button-row">
              {phase === 'conflict' ? (
                <>
                  <button
                    className="button button-outline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(writing.current)
                        setCopied(true)
                      } catch {
                        setError('Select and copy your writing above, then load the saved version.')
                      }
                    }}
                  >
                    <Copy size={15} /> {copied ? 'Copied' : 'Copy my writing'}
                  </button>
                  <button className="button" onClick={() => void reloadSaved()}>
                    <RefreshCw size={15} /> Load saved version
                  </button>
                </>
              ) : (
                <button className="button" onClick={() => void save()}>
                  <RefreshCw size={15} /> Retry saving
                </button>
              )}
            </div>
          </div>
        )}
      </section>
    </AdminWorkspace>
  )
}
