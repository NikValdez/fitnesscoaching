import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type CollisionDetection,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Check,
  Clapperboard,
  FileText,
  GripVertical,
  Lightbulb,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { WorkspaceModal, Notice } from '../components/workspace'
import { AdminWorkspace } from '../components/admin-workspace'
import { PlatformPicker, PlatformTags } from '../components/content-platforms'
import { useStudio, useStudioState } from '../components/use-studio'
import {
  getContentWorkspace,
  saveContentIdea,
  moveContentIdea,
  deleteContentIdea,
} from '../lib/content'
import {
  contentFormats,
  contentStages,
  type ContentStage,
  type ContentFormat,
  type ContentPlatform,
} from '../lib/content-validation'
import contentStylesheet from '../content-studio.css?url'
import adminStylesheet from '../admin.css?url'

export const Route = createFileRoute('/admin/content')({
  head: () => ({
    meta: [
      { title: 'Content Studio — Steve Rossiter' },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
    links: [
      { rel: 'stylesheet', href: contentStylesheet },
      { rel: 'stylesheet', href: adminStylesheet },
    ],
  }),
  headers: () => ({ 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, noarchive' }),
  staleTime: 0,
  gcTime: 0,
  loader: () => getContentWorkspace(),
  component: ContentStudio,
})

type Board = Awaited<ReturnType<typeof getContentWorkspace>>['board']
type Idea = Board['ideas'][number]
type IdeaDraft = {
  title: string
  notes: string
  format: ContentFormat
  stage: ContentStage
  platforms: ContentPlatform[]
}

const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  // A card and its column can overlap. Prefer the card to preserve drop order.
  const cards = hits.filter(
    (hit) =>
      args.droppableContainers.find((container) => container.id === hit.id)?.data.current?.type ===
      'idea',
  )
  return cards.length
    ? cards
    : hits.length
      ? hits
      : args.pointerCoordinates
        ? []
        : closestCorners(args)
}

function ContentStudio() {
  const data = Route.useLoaderData()
  const [board, setBoard] = useState(data.board)
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editor, setEditor] = useState<{ idea?: Idea; stage: ContentStage } | null>(null)
  const [removing, setRemoving] = useState<Idea | null>(null)
  const provider = useStudio('board')
  const live = useStudioState(provider)
  useEffect(() => setBoard(data.board), [data.board])
  useEffect(() => {
    if (!provider || busy || activeId) return
    let disposed = false
    const refresh = async () => {
      try {
        const next = (await getContentWorkspace()).board
        if (!disposed && !pending.current)
          setBoard((current) => (next.revision > current.revision ? next : current))
      } catch {
        /* A reconnect or the next focus will retry without discarding an open card. */
      }
    }
    const stop = provider.onBoard(() => void refresh())
    const timer = setInterval(() => void refresh(), 15000)
    window.addEventListener('focus', refresh)
    void refresh()
    return () => {
      disposed = true
      stop()
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [provider, busy, activeId])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function mutate(
    action: (revision: number) => Promise<Board>,
    message: string,
    optimistic?: Board,
  ) {
    if (pending.current) return false
    const previous = board
    pending.current = true
    setBusy(true)
    setError('')
    setNotice('')
    if (optimistic) setBoard(optimistic)
    try {
      let next: Board
      try {
        next = await action(board.revision)
      } catch (cause) {
        if (!(cause instanceof Error) || !cause.message.includes('board changed')) throw cause
        const latest = (await getContentWorkspace()).board
        setBoard(latest)
        next = await action(latest.revision)
      }
      setBoard(next)
      setNotice(message)
      return true
    } catch (cause) {
      if (optimistic) setBoard(previous)
      setError(
        cause instanceof Error ? cause.message : 'Could not save your change. Please try again.',
      )
      return false
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  async function move(idea: Idea, stage: ContentStage, beforeId: string | null) {
    const target = board.ideas.filter((item) => item.stage === stage && item.id !== idea.id)
    const index =
      beforeId === null ? target.length : target.findIndex((item) => item.id === beforeId)
    if (index < 0) return
    target.splice(index, 0, { ...idea, stage })
    const optimistic = {
      ...board,
      ideas: [
        ...board.ideas.filter((item) => item.stage !== stage && item.id !== idea.id),
        ...target.map((item, position) => ({ ...item, position })),
      ].sort((a, b) => a.position - b.position),
    }
    await mutate(
      (revision) => moveContentIdea({ data: { id: idea.id, revision, stage, beforeId } }),
      `${idea.title} moved to ${contentStages.find((item) => item.id === stage)?.label}.`,
      optimistic,
    )
  }

  function onDragEnd({ active, over, activatorEvent }: DragEndEvent) {
    setActiveId(null)
    if (!over || active.id === over.id || pending.current) return
    const idea = board.ideas.find((item) => item.id === active.id)
    if (!idea) return
    const targetIdea = board.ideas.find((item) => item.id === over.id)
    const stage = targetIdea?.stage ?? contentStages.find((item) => item.id === over.id)?.id
    if (!stage) return
    let beforeId = targetIdea?.id ?? null
    if (targetIdea) {
      const rect = active.rect.current.translated
      // Keyboard sorting follows the direction of travel. Comparing card centers
      // can reverse an upward move when the dragged card is taller than its target.
      const isAfter =
        activatorEvent.type === 'keydown'
          ? rect && rect.top > (active.rect.current.initial?.top ?? rect.top)
          : rect && rect.top + rect.height / 2 > over.rect.top + over.rect.height / 2
      if (isAfter) {
        const column = board.ideas.filter((item) => item.stage === stage && item.id !== idea.id)
        beforeId = column[column.findIndex((item) => item.id === targetIdea.id) + 1]?.id ?? null
      }
    }
    void move(idea, stage, beforeId)
  }

  const activeIdea = board.ideas.find((item) => item.id === activeId)
  const inProgress = board.ideas.filter(
    (item) => item.stage === 'PRE_PRODUCTION' || item.stage === 'FILMING',
  ).length
  const done = board.ideas.filter((item) => item.stage === 'DONE').length
  const dragLabel = (id: string | number) =>
    board.ideas.find((idea) => idea.id === id)?.title ??
    contentStages.find((stage) => stage.id === id)?.label ??
    'the board'

  return (
    <AdminWorkspace name={data.user.name} current="content">
      <div className="content-studio">
        <div className="workspace-page-heading content-heading">
          <div>
            <span className="eyebrow">A space to create</span>
            <h1>Content &amp; ideas.</h1>
            <p>From the first spark to the final take. Keep your next good thing moving.</p>
          </div>
          <button
            className="button"
            disabled={busy}
            onClick={() => setEditor({ stage: 'CONCEPTS' })}
          >
            <Plus size={17} />
            New idea
          </button>
        </div>

        <div className="content-overview">
          <div>
            <Lightbulb size={17} />
            <strong>{board.ideas.length}</strong>
            <span>Total ideas</span>
          </div>
          <div>
            <Clapperboard size={17} />
            <strong>{inProgress}</strong>
            <span>In production</span>
          </div>
          <div>
            <Check size={17} />
            <strong>{done}</strong>
            <span>Done</span>
          </div>
          <span className="content-private">
            <ShieldCheck size={15} />
            Admins only
          </span>
        </div>

        {error && <Notice error message={error} onClose={() => setError('')} />}
        {notice && <Notice message={notice} onClose={() => setNotice('')} />}

        <div className="content-toolbar">
          <h2>
            <span className="content-board-icon">
              <Clapperboard size={15} />
            </span>
            Production board
          </h2>
          <div>
            <span className="content-save-status" role="status">
              {busy ? (
                <>
                  <LoaderCircle size={13} className="spin" />
                  Saving…
                </>
              ) : (
                <>
                  <span />
                  {live.phase === 'saved' ? 'Live shared board' : 'Connecting to shared board…'}
                </>
              )}
            </span>
            <button
              className="icon-button"
              aria-label="Refresh board"
              disabled={busy || !!activeId}
              onClick={() =>
                void mutate(async () => (await getContentWorkspace()).board, 'Board refreshed.')
              }
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        <p className="content-drag-hint" id="content-board-help">
          Drag the grip to move or reorder ideas. You can also change the stage on any card.
        </p>
        <DndContext
          id="content-board"
          accessibility={{
            screenReaderInstructions: {
              draggable:
                'Press Space to pick up an idea. Use arrow keys to move, Space to drop, or Escape to cancel. You can also use the stage selector on each card.',
            },
            announcements: {
              onDragStart: ({ active }) => `Picked up ${dragLabel(active.id)}.`,
              onDragOver: ({ active, over }) =>
                over
                  ? `${dragLabel(active.id)} is over ${dragLabel(over.id)}.`
                  : `${dragLabel(active.id)} is outside the board.`,
              onDragEnd: ({ active, over }) =>
                over
                  ? `Dropped ${dragLabel(active.id)} at ${dragLabel(over.id)}.`
                  : `${dragLabel(active.id)} was not moved.`,
              onDragCancel: ({ active }) => `Cancelled moving ${dragLabel(active.id)}.`,
            },
          }}
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={({ active }) => {
            setActiveId(String(active.id))
            setNotice('')
          }}
          onDragCancel={() => setActiveId(null)}
          onDragEnd={onDragEnd}
        >
          <div
            className="content-board"
            aria-label="Content production board"
            aria-describedby="content-board-help"
            aria-busy={busy}
          >
            {contentStages.map((stage, index) => {
              const ideas = board.ideas.filter((idea) => idea.stage === stage.id)
              return (
                <BoardColumn
                  key={stage.id}
                  stage={stage}
                  index={index}
                  count={ideas.length}
                  dragging={!!activeId}
                >
                  <SortableContext
                    id={stage.id}
                    items={ideas.map((idea) => idea.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {ideas.map((idea) => (
                      <IdeaCard
                        key={idea.id}
                        idea={idea}
                        busy={busy}
                        onEdit={() => {
                          setError('')
                          setNotice('')
                          setEditor({ idea, stage: idea.stage })
                        }}
                        onDelete={() => {
                          setError('')
                          setNotice('')
                          setRemoving(idea)
                        }}
                        onMove={(next) => void move(idea, next, null)}
                      />
                    ))}
                  </SortableContext>
                  {!ideas.length && (
                    <div className="content-column-empty">
                      <span>{stage.id === 'DONE' ? <Check size={21} /> : <Plus size={21} />}</span>
                      <p>{stage.empty}</p>
                      <span>Drop an idea here or add one below.</span>
                    </div>
                  )}
                  <button
                    className="content-add-idea"
                    disabled={busy}
                    onClick={() => setEditor({ stage: stage.id })}
                  >
                    <Plus size={14} />
                    Add idea
                  </button>
                </BoardColumn>
              )
            })}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeIdea && (
              <div className="content-card content-card-overlay">
                <div className="content-card-meta">
                  {contentFormats.find((format) => format.id === activeIdea.format)?.label}
                </div>
                <h3>{activeIdea.title}</h3>
                <p>{activeIdea.notes || 'A good idea in the making.'}</p>
                <PlatformTags platforms={activeIdea.platforms} />
              </div>
            )}
          </DragOverlay>
        </DndContext>

        <div className="content-footer">
          <span className="eyebrow">Steve Rossiter / Content Studio</span>
          <p>One idea. A little progress. Something worth sharing.</p>
        </div>

        {editor && (
          <IdeaEditor
            initial={editor.idea}
            stage={editor.stage}
            busy={busy}
            error={error}
            onClose={() => setEditor(null)}
            onDelete={
              editor.idea
                ? () => {
                    setRemoving(editor.idea!)
                    setEditor(null)
                  }
                : undefined
            }
            onSave={async (draft) => {
              const success = await mutate(
                (revision) =>
                  saveContentIdea({
                    data: {
                      ...draft,
                      id: editor.idea?.id,
                      expectedUpdatedAt: editor.idea?.updatedAt.toISOString(),
                      revision,
                    },
                  }),
                editor.idea ? 'Idea updated.' : 'New idea added to your board.',
              )
              if (success) setEditor(null)
            }}
            onRefresh={() =>
              void mutate(
                async () => (await getContentWorkspace()).board,
                'Board refreshed. Your draft is ready to save.',
              )
            }
          />
        )}
        {removing && (
          <WorkspaceModal
            title="Delete this idea?"
            label="Content studio"
            busy={busy}
            onClose={() => setRemoving(null)}
          >
            <p>“{removing.title}” and its notes will be removed from the board.</p>
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
                  const success = await mutate(
                    (revision) => deleteContentIdea({ data: { id: removing.id, revision } }),
                    'Idea deleted.',
                  )
                  if (success) setRemoving(null)
                }}
              >
                {busy ? 'Deleting…' : 'Delete idea'}
              </button>
              <button
                className="button button-outline"
                disabled={busy}
                onClick={() => setRemoving(null)}
              >
                Keep idea
              </button>
            </div>
          </WorkspaceModal>
        )}
      </div>
    </AdminWorkspace>
  )
}

function BoardColumn({
  stage,
  index,
  count,
  dragging,
  children,
}: {
  stage: (typeof contentStages)[number]
  index: number
  count: number
  dragging: boolean
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
    data: { type: 'container', stage: stage.id },
  })
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={`stage-${stage.id}`}
      data-stage={stage.id}
      className={`content-column stage-${stage.id.toLowerCase()} ${isOver ? 'is-over' : ''} ${dragging ? 'is-dragging' : ''}`}
    >
      <div className="content-column-heading">
        <span className="content-stage-number">0{index + 1}</span>
        <h3 id={`stage-${stage.id}`}>{stage.label}</h3>
        <span className="content-column-count" aria-label={`${count} ideas`}>
          {count}
        </span>
      </div>
      <p className="content-column-description">{stage.description}</p>
      <div className="content-column-items">{children}</div>
    </section>
  )
}

function IdeaCard({
  idea,
  busy,
  onEdit,
  onDelete,
  onMove,
}: {
  idea: Idea
  busy: boolean
  onEdit: () => void
  onDelete: () => void
  onMove: (stage: ContentStage) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: idea.id,
    disabled: busy,
    data: { type: 'idea', stage: idea.stage },
  })
  return (
    <article
      ref={setNodeRef}
      data-idea-id={idea.id}
      className={`content-card ${isDragging ? 'is-dragging' : ''} ${isOver ? 'is-over' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className="content-card-top">
        <span className="content-card-meta">
          {idea.format === 'VIDEO' ? <Clapperboard size={11} /> : <FileText size={11} />}
          {contentFormats.find((format) => format.id === idea.format)?.label}
        </span>
        <button
          ref={setActivatorNodeRef}
          className="content-drag-handle icon-button"
          disabled={busy}
          {...attributes}
          {...listeners}
          aria-label={`Drag ${idea.title}`}
        >
          <GripVertical size={17} />
        </button>
      </div>
      <button
        className="content-card-open"
        disabled={busy}
        onClick={onEdit}
        aria-label={`Open ${idea.title}`}
        aria-haspopup="dialog"
      >
        <h3>{idea.title}</h3>
        {idea.notes ? (
          <p>{idea.notes}</p>
        ) : (
          <span className="content-card-no-notes">Add notes, a hook, or a little direction.</span>
        )}
      </button>
      <PlatformTags platforms={idea.platforms} />
      <label className="content-card-stage">
        <span>Stage</span>
        <select
          aria-label={`Stage for ${idea.title}`}
          value={idea.stage}
          disabled={busy}
          onChange={(event) => onMove(event.target.value as ContentStage)}
        >
          {contentStages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.label}
            </option>
          ))}
        </select>
      </label>
      <div className="content-card-actions" role="group" aria-label={`Actions for ${idea.title}`}>
        <button
          type="button"
          disabled={busy}
          onClick={onEdit}
          aria-label={`Edit ${idea.title}`}
          aria-haspopup="dialog"
        >
          <Pencil size={14} aria-hidden="true" />
          Edit
        </button>
        <button
          type="button"
          className="content-card-delete"
          disabled={busy}
          onClick={onDelete}
          aria-label={`Delete ${idea.title}`}
          aria-haspopup="dialog"
        >
          <Trash2 size={14} aria-hidden="true" />
          Delete
        </button>
      </div>
    </article>
  )
}

function IdeaEditor({
  initial,
  stage,
  busy,
  error,
  onSave,
  onDelete,
  onClose,
  onRefresh,
}: {
  initial?: Idea
  stage: ContentStage
  busy: boolean
  error: string
  onSave: (draft: IdeaDraft) => Promise<void>
  onDelete?: () => void
  onClose: () => void
  onRefresh: () => void
}) {
  const [draft, setDraft] = useState<IdeaDraft>({
    title: initial?.title ?? '',
    notes: initial?.notes ?? '',
    format: (initial?.format as ContentFormat) ?? 'VIDEO',
    stage,
    platforms: (initial?.platforms as ContentPlatform[]) ?? [],
  })
  return (
    <WorkspaceModal
      title={initial ? 'Shape your idea.' : 'Start with a spark.'}
      label={initial ? 'Edit idea' : 'New idea'}
      busy={busy}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void onSave(draft)
        }}
      >
        <fieldset disabled={busy} className="content-editor-fields">
          <label>
            Idea title
            <input
              autoFocus
              required
              maxLength={160}
              value={draft.title}
              placeholder="What would you love to share?"
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          </label>
          <div className="field-row">
            <label>
              Format
              <select
                value={draft.format}
                onChange={(event) =>
                  setDraft({ ...draft, format: event.target.value as ContentFormat })
                }
              >
                {contentFormats.map((format) => (
                  <option key={format.id} value={format.id}>
                    {format.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Stage
              <select
                value={draft.stage}
                onChange={(event) =>
                  setDraft({ ...draft, stage: event.target.value as ContentStage })
                }
              >
                {contentStages.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <PlatformPicker
            value={draft.platforms}
            onChange={(platforms) => setDraft({ ...draft, platforms })}
          />
          <label>
            Notes &amp; direction
            <textarea
              rows={7}
              maxLength={10000}
              value={draft.notes}
              placeholder="The hook, talking points, a shot list, or a link for inspiration…"
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
            />
          </label>
        </fieldset>
        {error && (
          <div>
            <p className="form-error" role="alert">
              {error}
            </p>
            <button type="button" className="text-link" disabled={busy} onClick={onRefresh}>
              Refresh board, keep draft
            </button>
          </div>
        )}
        <div className="content-editor-actions">
          {onDelete && (
            <button
              type="button"
              className="content-delete-button"
              disabled={busy}
              onClick={onDelete}
            >
              <Trash2 size={15} />
              Delete idea
            </button>
          )}
          <button type="button" className="button button-outline" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="button" disabled={busy || !draft.title.trim()}>
            {busy ? (
              <>
                <LoaderCircle className="spin" size={15} />
                Saving…
              </>
            ) : initial ? (
              'Save changes'
            ) : (
              'Add idea'
            )}
          </button>
        </div>
      </form>
    </WorkspaceModal>
  )
}
