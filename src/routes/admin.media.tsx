import { createFileRoute, Link, useBlocker } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Check,
  Clapperboard,
  Download,
  Film,
  FolderOpen,
  LoaderCircle,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { AdminWorkspace } from '../components/admin-workspace'
import { MediaThumbnail } from '../components/media-thumbnail'
import { Notice, WorkspaceModal } from '../components/workspace'
import { useStudio, useStudioState } from '../components/use-studio'
import { getMediaWorkspace, type MediaAsset, type MediaWorkspace } from '../lib/media'
import {
  mediaAccept,
  mediaCategories,
  mediaContentType,
  MEDIA_MAX_SIZE,
  formatBytes,
  partLength,
} from '../lib/media-validation'
import { mediaAction, sendMediaPart, uploadMissingMediaParts } from '../lib/media-upload'
import adminStylesheet from '../admin.css?url'
import mediaStylesheet from '../shared-media.css?url'

export const Route = createFileRoute('/admin/media')({
  head: () => ({
    meta: [
      { title: 'Shared media — Steve Rossiter' },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
    links: [
      { rel: 'stylesheet', href: adminStylesheet },
      { rel: 'stylesheet', href: mediaStylesheet },
    ],
  }),
  headers: () => ({ 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, noarchive' }),
  staleTime: 0,
  gcTime: 0,
  loader: () => getMediaWorkspace(),
  component: SharedMedia,
  validateSearch: (search: Record<string, unknown>): { card?: string } => ({
    card: typeof search.card === 'string' ? search.card : undefined,
  }),
})
type Job = {
  id: string
  filename: string
  size: number
  progress: number
  state: 'queued' | 'uploading' | 'paused' | 'error' | 'done'
  error?: string
}
type UploadSettings = { category: 'RAW' | 'DEMOS' | 'BROLL' | 'FINISHED'; cardId: string | null }
const categoryLabel = (category: string) =>
  mediaCategories.find((item) => item.id === category)?.label || category
const fileUrl = (id: string) => `/api/admin/media/${encodeURIComponent(id)}`

function SharedMedia() {
  const data = Route.useLoaderData()
  const routeSearch = Route.useSearch()
  const [media, setMedia] = useState(data.media)
  const mediaRef = useRef(media)
  mediaRef.current = media
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('ALL')
  const [cardFilter, setCardFilter] = useState(routeSearch.card || 'ALL')
  const [uploadCategory, setUploadCategory] = useState<'RAW' | 'DEMOS' | 'BROLL' | 'FINISHED'>(
    'RAW',
  )
  const [dragging, setDragging] = useState(false)
  const [jobs, setJobs] = useState<Job[]>([])
  const controllers = useRef(new Map<string, AbortController>())
  const uploadQueue = useRef<{ file: File; id: string; settings: UploadSettings }[]>([])
  const runningUploads = useRef(0)
  const mounted = useRef(true)
  const files = useRef(new Map<string, File>())
  const input = useRef<HTMLInputElement>(null)
  const resumeInput = useRef<HTMLInputElement>(null)
  const resumeId = useRef<string | null>(null)
  const [editor, setEditor] = useState<MediaAsset | null>(null)
  const [removing, setRemoving] = useState<MediaAsset | null>(null)
  const [preview, setPreview] = useState<MediaAsset | null>(null)
  const [previewError, setPreviewError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const provider = useStudio('media')
  const live = useStudioState(provider)
  const active = jobs.some((job) => job.state === 'uploading' || job.state === 'queued')
  useBlocker({
    shouldBlockFn: () =>
      active &&
      !window.confirm(
        'Active uploads will pause. Queued clips will need to be selected again if you leave. Continue?',
      ),
    enableBeforeUnload: active,
  })

  const refresh = useCallback(async () => {
    const next = (await getMediaWorkspace()).media
    setMedia((current) => (next.revision >= current.revision ? next : current))
  }, [])
  useEffect(() => setMedia(data.media), [data.media])
  useEffect(() => setCardFilter(routeSearch.card || 'ALL'), [routeSearch.card])
  useEffect(() => {
    let disposed = false
    const update = () => {
      if (!disposed) void refresh().catch(() => {})
    }
    const stop = provider?.onRefresh(update)
    const timer = setInterval(update, 15000)
    window.addEventListener('focus', update)
    update()
    return () => {
      disposed = true
      stop?.()
      clearInterval(timer)
      window.removeEventListener('focus', update)
    }
  }, [provider, refresh])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      uploadQueue.current = []
      controllers.current.forEach((controller) => controller.abort())
    }
  }, [])
  function updateJob(id: string, values: Partial<Job>) {
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, ...values } : job)))
  }
  async function upload(file: File, id: string, settings: UploadSettings) {
    if (controllers.current.has(id)) return
    const controller = new AbortController()
    controllers.current.set(id, controller)
    files.current.set(id, file)
    setJobs((current) => {
      const job: Job = { id, filename: file.name, size: file.size, progress: 0, state: 'uploading' }
      return current.some((item) => item.id === id)
        ? current.map((item) => (item.id === id ? job : item))
        : [...current, job]
    })
    try {
      // Start is idempotent and returns the current saved part list. A lost
      // response or a resume by another admin never requires resending those parts.
      const asset = await mediaAction({
        action: 'start',
        id,
        filename: file.name,
        size: file.size,
        lastModified: file.lastModified,
        title: file.name.replace(/\.[^.]+$/, '').slice(0, 160) || 'Untitled clip',
        category: settings.category,
        notes: '',
        tags: [],
        cardId: settings.cardId,
      })
      if (asset.status !== 'READY') {
        await uploadMissingMediaParts({
          file,
          received: asset.parts,
          signal: controller.signal,
          onProgress: (uploaded) =>
            updateJob(id, { progress: Math.min(0.99, uploaded / file.size) }),
          send: (part, chunk, signal, progress) => sendMediaPart(id, part, chunk, signal, progress),
        })
        if (controller.signal.aborted) throw new DOMException('Upload paused.', 'AbortError')
        await mediaAction({ action: 'complete', id })
      }
      updateJob(id, { state: 'done', progress: 1 })
      files.current.delete(id)
      await refresh()
    } catch (cause) {
      updateJob(id, {
        state: controller.signal.aborted ? 'paused' : 'error',
        error: cause instanceof Error ? cause.message : 'Upload interrupted. Please resume.',
      })
    } finally {
      controllers.current.delete(id)
    }
  }
  function drainUploads() {
    while (mounted.current && runningUploads.current < 2 && uploadQueue.current.length) {
      const next = uploadQueue.current.shift()!
      if (!files.current.has(next.id)) continue
      runningUploads.current++
      void upload(next.file, next.id, next.settings).finally(() => {
        runningUploads.current--
        drainUploads()
      })
    }
  }
  function queueUpload(
    file: File,
    existing?: MediaAsset,
    id = existing?.id || crypto.randomUUID(),
  ) {
    if (controllers.current.has(id) || uploadQueue.current.some((item) => item.id === id)) return
    files.current.set(id, file)
    setJobs((current) => {
      const job: Job = { id, filename: file.name, size: file.size, progress: 0, state: 'queued' }
      return current.some((item) => item.id === id)
        ? current.map((item) => (item.id === id ? job : item))
        : [...current, job]
    })
    uploadQueue.current.push({
      file,
      id,
      settings: { category: uploadCategory, cardId: cardFilter !== 'ALL' ? cardFilter : null },
    })
    drainUploads()
  }
  function selectFiles(selected: File[], targetId?: string | null) {
    setError('')
    if (targetId) {
      const asset = mediaRef.current.assets.find((item) => item.id === targetId)
      const file = selected[0]
      if (!asset || !file) return
      if (
        file.name !== asset.filename ||
        file.size !== asset.size ||
        file.lastModified !== asset.lastModified
      ) {
        setError(
          'Choose the same original file to resume this upload. Its name, size, and modification date must match.',
        )
        return
      }
      queueUpload(file, asset)
      return
    }
    const valid: File[] = []
    const rejected: string[] = []
    for (const file of selected) {
      if (!mediaContentType(file.name) || !file.size || file.size > MEDIA_MAX_SIZE)
        rejected.push(file.name)
      else valid.push(file)
    }
    if (rejected.length)
      setError(`Could not upload ${rejected.join(', ')}. Choose a supported video up to 10 GB.`)
    // Share one two-file limit across drops, selections, and resumed clips.
    for (const file of valid) {
      const existing = mediaRef.current.assets.find(
        (item) =>
          item.status === 'UPLOADING' &&
          item.filename === file.name &&
          item.size === file.size &&
          item.lastModified === file.lastModified,
      )
      queueUpload(file, existing)
    }
  }

  async function mutate(action: () => Promise<unknown>, message: string) {
    if (busy) return false
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
      await refresh()
      setNotice(message)
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this change. Please retry.')
      return false
    } finally {
      setBusy(false)
    }
  }
  const saved = media.assets.filter(
    (asset) => asset.status === 'READY' || asset.status === 'DELETING',
  )
  const query = search.trim().toLowerCase()
  const entries = saved.filter(
    (asset) =>
      (category === 'ALL' || asset.category === category) &&
      (cardFilter === 'ALL' || asset.cardId === cardFilter) &&
      (!query ||
        `${asset.title} ${asset.filename} ${asset.notes} ${asset.tags.join(' ')} ${asset.card?.title || ''}`
          .toLowerCase()
          .includes(query)),
  )
  const pending = media.assets.filter((asset) => asset.status === 'UPLOADING')
  const visibleJobs: Job[] = [
    ...jobs,
    ...pending
      .filter((asset) => !jobs.some((job) => job.id === asset.id))
      .map((asset): Job => ({
        id: asset.id,
        filename: asset.filename,
        size: asset.size,
        state: 'paused',
        progress:
          asset.parts.reduce((sum, part) => sum + partLength(asset.size, part), 0) / asset.size,
      })),
  ]
  return (
    <AdminWorkspace name={data.user.name} current="media">
      <div className="media-heading">
        <div className="admin-page-heading">
          <span className="eyebrow">Good footage. All in one place.</span>
          <h1>Shared media.</h1>
          <p>
            A shared home for the clips your team creates. Drop in footage, find what you need, and
            make something with it.
          </p>
        </div>
        <div className="media-total">
          <FolderOpen size={22} />
          <strong>{saved.filter((asset) => asset.status === 'READY').length} clips</strong>
          <span>{formatBytes(saved.reduce((sum, asset) => sum + asset.size, 0))} stored</span>
        </div>
      </div>
      {notice && <Notice message={notice} onClose={() => setNotice('')} />}
      {error && !editor && !removing && (
        <Notice error message={error} onClose={() => setError('')} />
      )}
      {!media.configured && (
        <p className="notice notice-error" role="alert">
          Shared media storage is not connected yet. Uploads will be available once storage is
          configured.
        </p>
      )}
      <div
        className={`media-dropzone ${dragging ? 'is-dragging' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          if (media.configured) selectFiles(Array.from(event.dataTransfer.files))
        }}
      >
        <span className="media-upload-icon">
          <Upload size={25} strokeWidth={1.5} />
        </span>
        <div>
          <h2>Drop your video clips here.</h2>
          <p>Original quality. Shared with every admin. Up to 10 GB per clip.</p>
          <span className="media-formats">MP4 · MOV · M4V · WebM · MKV · AVI</span>
        </div>
        <div className="media-upload-controls">
          <label>
            Upload to
            <select
              aria-label="Upload category"
              value={uploadCategory}
              onChange={(event) => setUploadCategory(event.target.value as typeof uploadCategory)}
            >
              {mediaCategories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button"
            disabled={!media.configured}
            onClick={() => input.current?.click()}
          >
            <Upload size={16} /> Choose clips
          </button>
        </div>
        <input
          ref={input}
          className="sr-only"
          type="file"
          aria-label="Upload video clips"
          accept={mediaAccept}
          multiple
          disabled={!media.configured}
          onChange={(event) => {
            selectFiles(Array.from(event.target.files || []))
            event.target.value = ''
          }}
        />
        <input
          ref={resumeInput}
          className="sr-only"
          type="file"
          aria-label="Reselect original clip"
          accept={mediaAccept}
          onChange={(event) => {
            selectFiles(Array.from(event.target.files || []), resumeId.current)
            event.target.value = ''
          }}
        />
      </div>
      {!!visibleJobs.length && (
        <section className="media-queue" aria-label="Upload queue">
          <div className="media-queue-heading">
            <h2>Uploads</h2>
            <span>Keep this page open while uploading. Paused clips can resume for 6 days.</span>
          </div>
          {visibleJobs.map((job) => (
            <div className="media-job" key={job.id}>
              <span className="media-job-icon">
                {job.state === 'done' ? <Check size={20} /> : <Film size={20} />}
              </span>
              <div className="media-job-info">
                <strong>{job.filename}</strong>
                <div className="media-job-meta">
                  <span>
                    {job.state === 'done'
                      ? 'Shared with all admins'
                      : job.state === 'uploading'
                        ? job.progress >= 0.99
                          ? 'Finishing…'
                          : `Uploading · ${Math.round(job.progress * 100)}%`
                        : job.state === 'queued'
                          ? 'Queued — waiting to upload'
                          : job.state === 'error'
                            ? job.error
                            : 'Paused — ready to resume'}
                  </span>
                  <span>{formatBytes(job.size)}</span>
                </div>
                <progress
                  max={1}
                  value={job.progress}
                  aria-label={`Upload progress for ${job.filename}`}
                />
              </div>
              {job.state === 'uploading' ? (
                <button
                  className="icon-button"
                  aria-label={`Pause ${job.filename}`}
                  onClick={() => controllers.current.get(job.id)?.abort()}
                >
                  <Pause size={18} />
                </button>
              ) : job.state === 'done' ? (
                <button
                  className="icon-button"
                  aria-label={`Dismiss ${job.filename}`}
                  onClick={() => setJobs((current) => current.filter((item) => item.id !== job.id))}
                >
                  <X size={18} />
                </button>
              ) : (
                <>
                  {job.state !== 'queued' && (
                    <button
                      className="media-text-button"
                      disabled={busy}
                      onClick={() => {
                        const file = files.current.get(job.id),
                          asset = media.assets.find((item) => item.id === job.id)
                        if (file) queueUpload(file, asset, job.id)
                        else {
                          resumeId.current = job.id
                          resumeInput.current?.click()
                        }
                      }}
                    >
                      <Play size={14} /> Resume
                    </button>
                  )}
                  <button
                    className="icon-button"
                    aria-label={`Cancel ${job.filename}`}
                    disabled={busy}
                    onClick={async () => {
                      if (
                        job.state === 'queued' ||
                        (await mutate(
                          () => mediaAction({ action: 'abort', id: job.id }),
                          'Upload cancelled.',
                        ))
                      ) {
                        setJobs((current) => current.filter((item) => item.id !== job.id))
                        files.current.delete(job.id)
                      }
                    }}
                  >
                    <X size={17} />
                  </button>
                </>
              )}
            </div>
          ))}
        </section>
      )}
      <div className="media-toolbar">
        <label className="media-search">
          <Search size={18} />
          <span className="sr-only">Search shared media</span>
          <input
            type="search"
            placeholder="Search clips, tags, or notes…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="media-card-filter">
          <span className="sr-only">Filter by production card</span>
          <select
            aria-label="Filter by production card"
            value={cardFilter}
            onChange={(event) => setCardFilter(event.target.value)}
          >
            <option value="ALL">All production cards</option>
            {media.cards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="media-tabs" role="group" aria-label="Media categories">
        {[{ id: 'ALL', label: 'All clips' }, ...mediaCategories].map((item) => (
          <button
            key={item.id}
            aria-pressed={category === item.id}
            onClick={() => setCategory(item.id)}
          >
            {item.label}
            <span>
              {saved.filter((asset) => item.id === 'ALL' || asset.category === item.id).length}
            </span>
          </button>
        ))}
      </div>
      <div className="media-summary">
        <span>
          {entries.length} {entries.length === 1 ? 'clip' : 'clips'}
          {query || category !== 'ALL' || cardFilter !== 'ALL' ? ` of ${saved.length}` : ''}
        </span>
        <div>
          <span className="media-live" role="status">
            {live.phase === 'saved'
              ? 'Live shared media'
              : live.phase === 'denied'
                ? 'Admin session ended'
                : 'Connecting to shared media…'}
          </span>
          <button
            className="icon-button"
            aria-label="Refresh shared media"
            onClick={() =>
              void refresh().catch(() => setError('Could not refresh shared media. Please retry.'))
            }
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>
      {entries.length ? (
        <div className="media-grid">
          {entries.map((asset) => (
            <article className="media-card" key={asset.id} data-media-id={asset.id}>
              <button
                className="media-cover"
                disabled={asset.status !== 'READY'}
                aria-label={`Preview ${asset.title}`}
                onClick={() => {
                  setPreviewError(false)
                  setPreview(asset)
                }}
              >
                {asset.status === 'READY' && <MediaThumbnail id={asset.id} />}
                <span className="media-cover-format">
                  {asset.filename.split('.').pop()?.toUpperCase()}
                </span>
                <span className="media-play">
                  <Play size={26} fill="currentColor" strokeWidth={1} />
                </span>
                <span className="media-cover-size">{formatBytes(asset.size)}</span>
              </button>
              <div className="media-card-body">
                <span className="eyebrow">{categoryLabel(asset.category)}</span>
                <h2>{asset.title}</h2>
                <p className="media-filename" title={asset.filename}>
                  {asset.filename}
                </p>
                {asset.notes && <p className="media-notes">{asset.notes}</p>}
                {asset.tags.length > 0 && (
                  <div className="media-tags">
                    {asset.tags.map((tag) => (
                      <button key={tag} onClick={() => setSearch(tag)}>
                        #{tag}
                      </button>
                    ))}
                  </div>
                )}
                {asset.card && (
                  <Link className="media-card-link" to="/admin/content">
                    <Clapperboard size={14} />
                    {asset.card.title}
                  </Link>
                )}
                {asset.status === 'DELETING' ? (
                  <div className="media-deleting">
                    <p>Deletion pending. Retry to remove the original file.</p>
                    <button
                      className="media-text-button"
                      disabled={busy}
                      onClick={() =>
                        void mutate(
                          () =>
                            mediaAction({
                              action: 'delete',
                              id: asset.id,
                              expectedUpdatedAt: asset.updatedAt.toISOString(),
                            }),
                          'Clip deleted.',
                        )
                      }
                    >
                      Retry deletion
                    </button>
                  </div>
                ) : (
                  <div className="media-card-actions">
                    <a href={`${fileUrl(asset.id)}?download`} className="media-text-button">
                      <Download size={15} /> Download
                    </a>
                    <button
                      className="icon-button"
                      aria-label={`Edit ${asset.title}`}
                      disabled={busy}
                      onClick={() => {
                        setError('')
                        setEditor(asset)
                      }}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Delete ${asset.title}`}
                      disabled={busy}
                      onClick={() => {
                        setError('')
                        setRemoving(asset)
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="media-empty">
          <span>
            <Film size={32} strokeWidth={1.2} />
          </span>
          <h2>
            {saved.length ? 'No clips match your search.' : 'Your next great post starts here.'}
          </h2>
          <p>
            {saved.length
              ? 'Try another category, production card, or search term.'
              : 'Upload your first clips and give the whole team something to work with.'}
          </p>
          {saved.length > 0 && (
            <button
              className="media-text-button"
              onClick={() => {
                setSearch('')
                setCategory('ALL')
                setCardFilter('ALL')
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}
      {editor && (
        <MediaEditor
          asset={editor}
          cards={media.cards}
          busy={busy}
          error={error}
          onClose={() => {
            setEditor(null)
            setError('')
          }}
          onSave={async (values) => {
            if (
              await mutate(
                () =>
                  mediaAction({
                    action: 'edit',
                    id: editor.id,
                    expectedUpdatedAt: editor.updatedAt.toISOString(),
                    ...values,
                  }),
                'Clip details updated.',
              )
            )
              setEditor(null)
          }}
        />
      )}
      {removing && (
        <WorkspaceModal
          title="Delete this clip?"
          label="Shared media"
          busy={busy}
          onClose={() => {
            setRemoving(null)
            setError('')
          }}
        >
          <p>
            “{removing.title}” and its original file will be permanently removed for every admin.
          </p>
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
                if (
                  await mutate(
                    () =>
                      mediaAction({
                        action: 'delete',
                        id: removing.id,
                        expectedUpdatedAt: removing.updatedAt.toISOString(),
                      }),
                    'Clip deleted.',
                  )
                )
                  setRemoving(null)
              }}
            >
              {busy ? 'Deleting…' : 'Delete clip'}
            </button>
            <button
              className="button button-outline"
              disabled={busy}
              onClick={() => setRemoving(null)}
            >
              Keep clip
            </button>
          </div>
        </WorkspaceModal>
      )}
      {preview && (
        <WorkspaceModal
          title={preview.title}
          label="Shared media / Preview"
          className="media-preview-modal"
          onClose={() => setPreview(null)}
        >
          <video
            key={preview.id}
            src={fileUrl(preview.id)}
            controls
            autoPlay
            playsInline
            preload="metadata"
            onError={() => setPreviewError(true)}
          />
          {previewError && (
            <p className="form-error" role="alert">
              This browser could not play the clip. Download the original to open it in your video
              editor.
            </p>
          )}
          <div className="media-preview-foot">
            <span>
              {preview.filename} · {formatBytes(preview.size)}
            </span>
            <a className="button button-outline" href={`${fileUrl(preview.id)}?download`}>
              <Download size={16} /> Download original
            </a>
          </div>
        </WorkspaceModal>
      )}
    </AdminWorkspace>
  )
}

type EditValues = {
  title: string
  notes: string
  category: 'RAW' | 'DEMOS' | 'BROLL' | 'FINISHED'
  tags: string[]
  cardId: string | null
}
function MediaEditor({
  asset,
  cards,
  busy,
  error,
  onClose,
  onSave,
}: {
  asset: MediaAsset
  cards: MediaWorkspace['cards']
  busy: boolean
  error: string
  onClose: () => void
  onSave: (values: EditValues) => Promise<void>
}) {
  const [title, setTitle] = useState(asset.title),
    [notes, setNotes] = useState(asset.notes),
    [tags, setTags] = useState(asset.tags.join(', '))
  const [category, setCategory] = useState(asset.category as EditValues['category']),
    [cardId, setCardId] = useState(asset.cardId || '')
  return (
    <WorkspaceModal title="Clip details." label="Shared media" busy={busy} onClose={onClose}>
      <form
        className="media-editor"
        onSubmit={(event) => {
          event.preventDefault()
          void onSave({
            title,
            notes,
            category,
            tags: tags
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean),
            cardId: cardId || null,
          })
        }}
      >
        <label>
          Clip title
          <input
            aria-label="Clip title"
            required
            maxLength={160}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          Category
          <select
            aria-label="Category"
            value={category}
            onChange={(event) => setCategory(event.target.value as EditValues['category'])}
          >
            {mediaCategories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tags
          <input
            aria-label="Tags"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="strength, squat, outdoors"
          />
          <span className="form-note">
            Separate tags with commas. Up to 12 tags, 40 characters each.
          </span>
        </label>
        <label>
          Production card
          <select
            aria-label="Production card"
            value={cardId}
            onChange={(event) => setCardId(event.target.value)}
          >
            <option value="">No linked card</option>
            {cards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Notes
          <textarea
            rows={4}
            maxLength={4000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="What’s in the clip? Where could it be useful?"
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="button-row">
          <button className="button" disabled={busy}>
            {busy ? (
              <>
                <LoaderCircle size={16} /> Saving…
              </>
            ) : (
              'Save details'
            )}
          </button>
          <button className="button button-outline" type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </WorkspaceModal>
  )
}
