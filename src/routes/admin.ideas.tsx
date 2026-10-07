import { createFileRoute, useBlocker } from '@tanstack/react-router'
import { useState } from 'react'
import { Check, Copy, LoaderCircle, Pencil, RefreshCw, Users } from 'lucide-react'
import { AdminWorkspace } from '../components/admin-workspace'
import { ScratchEditor } from '../components/scratch-editor'
import { useStudio, useStudioState } from '../components/use-studio'
import { getScratchWorkspace } from '../lib/scratch'
import { scratchPadLimit } from '../lib/scratch-validation'
import { richTextPlainText } from '../lib/rich-text'
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
  const provider = useStudio('pad')
  const live = useStudioState(provider)
  const [draft, setDraft] = useState('')
  const [copied, setCopied] = useState(false)
  const dirty = () => provider?.getSnapshot().dirty ?? false
  useBlocker({
    shouldBlockFn: async () => {
      await provider?.flush()
      return (
        dirty() &&
        !window.confirm(
          'Your latest scratch pad changes haven’t synced yet. Leave this page anyway?',
        )
      )
    },
    enableBeforeUnload: dirty,
  })
  const names = [...new Set(live.peers)]
  return (
    <AdminWorkspace name={data.user.name} current="ideas">
      <div className="admin-page-heading">
        <span className="eyebrow">Room for a little inspiration</span>
        <h1>Ideas, before the plan.</h1>
        <p>
          One shared scratch pad for the team. Write together, shape a thought, and pick it up
          later.
        </p>
      </div>
      <section className="ideas-composer" aria-labelledby="scratch-heading">
        <div className="ideas-composer-heading">
          <span className="ideas-icon">
            <Pencil size={20} />
          </span>
          <h2 id="scratch-heading">The scratch pad</h2>
          <span className="eyebrow">Shared with all admins</span>
        </div>
        <div className="studio-presence" aria-label="Admins online">
          <Users size={15} aria-hidden="true" />
          <span>
            {names.length ? `${names.join(', ')} online` : 'Connecting to the shared workspace…'}
          </span>
        </div>
        {provider && live.synced ? (
          <ScratchEditor
            provider={provider}
            name={data.user.name}
            editable={live.phase !== 'denied'}
            onChange={(document) => {
              setDraft(richTextPlainText(JSON.parse(document)))
              setCopied(false)
            }}
            onSave={() => {
              void provider.flush()
            }}
          />
        ) : (
          <div className="scratch-editor scratch-editor-loading">
            Loading the shared scratch pad…
          </div>
        )}
        <div className="ideas-composer-foot">
          <span className="scratch-save-status" role="status">
            {live.phase === 'saved' ? (
              <Check size={14} />
            ) : ['connecting', 'saving'].includes(live.phase) ? (
              <LoaderCircle size={14} className="spin" />
            ) : null}
            {live.phase === 'saved'
              ? 'All changes saved'
              : live.phase === 'saving'
                ? 'Saving…'
                : live.phase === 'connecting'
                  ? 'Connecting…'
                  : live.phase === 'offline'
                    ? live.dirty
                      ? 'Offline — changes waiting to sync'
                      : 'Reconnecting…'
                    : 'Changes not saved'}
          </span>
          <span>
            {draft.length.toLocaleString()} / {scratchPadLimit.toLocaleString()}
          </span>
        </div>
        {(live.error || live.phase === 'offline') && (
          <div className="scratch-save-error">
            <p role="alert">
              {live.error ||
                'Connection interrupted. You can keep writing here; changes will merge with the shared pad when you reconnect. Keep this page open until they sync.'}
            </p>
            <div className="button-row">
              {live.dirty && (
                <button
                  className="button button-outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(draft)
                    setCopied(true)
                  }}
                >
                  <Copy size={15} />
                  {copied ? 'Copied' : 'Copy my writing'}
                </button>
              )}
              {live.phase === 'denied' ? (
                <a href="/admin/login" className="button">
                  Sign in
                </a>
              ) : (
                <button className="button" onClick={() => provider?.retry()}>
                  <RefreshCw size={15} /> Reconnect
                </button>
              )}
            </div>
          </div>
        )}
      </section>
    </AdminWorkspace>
  )
}
