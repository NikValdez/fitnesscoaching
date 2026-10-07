import { createFileRoute, useBlocker } from '@tanstack/react-router'
import { useState } from 'react'
import { Check, Copy, ListTodo, LoaderCircle, Pencil, RefreshCw, Users } from 'lucide-react'
import { AdminWorkspace } from '../components/admin-workspace'
import { ScratchEditor } from '../components/scratch-editor'
import { TodoEditor } from '../components/todo-editor'
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
  const [activeTab, setActiveTab] = useState<'scratch' | 'todo'>('scratch')
  const [drafts, setDrafts] = useState({ scratch: '', todo: '' })
  const [copied, setCopied] = useState(false)
  const draft = drafts[activeTab]
  const dirty = () => provider?.getSnapshot().dirty ?? false
  useBlocker({
    shouldBlockFn: async () => {
      await provider?.flush()
      return (
        dirty() &&
        !window.confirm('Your latest workspace changes haven’t synced yet. Leave this page anyway?')
      )
    },
    enableBeforeUnload: dirty,
  })
  function changeDraft(tab: 'scratch' | 'todo', document: string) {
    const text = richTextPlainText(JSON.parse(document))
    setDrafts((current) => ({ ...current, [tab]: text }))
    setCopied(false)
  }
  function selectTab(tab: 'scratch' | 'todo') {
    void provider?.flush()
    setActiveTab(tab)
    setCopied(false)
  }
  const names = [...new Set(live.peers)]
  return (
    <AdminWorkspace name={data.user.name} current="ideas">
      <div className="admin-page-heading">
        <span className="eyebrow">Room for a little inspiration</span>
        <h1>Ideas, before the plan.</h1>
        <p>
          A shared scratch pad and to-do list for the team. Write together, shape a thought, and
          check things off.
        </p>
      </div>
      <section className="ideas-composer" aria-labelledby="scratch-heading">
        <div className="ideas-tabs" role="tablist" aria-label="Ideas workspace">
          {(['scratch', 'todo'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              id={`ideas-tab-${tab}`}
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`ideas-panel-${tab}`}
              tabIndex={activeTab === tab ? 0 : -1}
              onClick={() => selectTab(tab)}
              onKeyDown={(event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
                event.preventDefault()
                const next =
                  event.key === 'Home'
                    ? 'scratch'
                    : event.key === 'End'
                      ? 'todo'
                      : tab === 'scratch'
                        ? 'todo'
                        : 'scratch'
                selectTab(next)
                document.getElementById(`ideas-tab-${next}`)?.focus()
              }}
            >
              {tab === 'scratch' ? (
                <Pencil size={16} aria-hidden="true" />
              ) : (
                <ListTodo size={16} aria-hidden="true" />
              )}
              {tab === 'scratch' ? 'Scratch pad' : 'To-do list'}
            </button>
          ))}
        </div>
        <div className="ideas-composer-heading">
          <span className="ideas-icon">
            {activeTab === 'scratch' ? <Pencil size={20} /> : <ListTodo size={20} />}
          </span>
          <h2 id="scratch-heading">
            {activeTab === 'scratch' ? 'The scratch pad' : 'The to-do list'}
          </h2>
          <span className="eyebrow">Shared with all admins</span>
        </div>
        <div className="studio-presence" aria-label="Admins online">
          <Users size={15} aria-hidden="true" />
          <span>
            {names.length ? `${names.join(', ')} online` : 'Connecting to the shared workspace…'}
          </span>
        </div>
        {(['scratch', 'todo'] as const).map((tab) => (
          <div
            key={tab}
            role="tabpanel"
            id={`ideas-panel-${tab}`}
            aria-labelledby={`ideas-tab-${tab}`}
            hidden={activeTab !== tab}
          >
            {provider && live.synced ? (
              tab === 'scratch' ? (
                <ScratchEditor
                  provider={provider}
                  name={data.user.name}
                  editable={live.phase !== 'denied'}
                  onChange={(document) => changeDraft('scratch', document)}
                  onSave={() => void provider.flush()}
                />
              ) : (
                <TodoEditor
                  provider={provider}
                  name={data.user.name}
                  editable={live.phase !== 'denied'}
                  onChange={(document) => changeDraft('todo', document)}
                  onSave={() => void provider.flush()}
                />
              )
            ) : (
              <div className="scratch-editor scratch-editor-loading">
                {tab === 'scratch'
                  ? 'Loading the shared scratch pad…'
                  : 'Loading the shared to-do list…'}
              </div>
            )}
          </div>
        ))}
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
                'Connection interrupted. You can keep writing here; changes will merge with the shared workspace when you reconnect. Keep this page open until they sync.'}
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
