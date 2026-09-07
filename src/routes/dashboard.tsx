import { createFileRoute, useRouter, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ArrowUpRight,
  Plus,
  Dumbbell,
  ClipboardCheck,
  Clock3,
  LogOut,
  X,
  Check,
  Trash2,
  ArrowRight,
  LoaderCircle,
} from 'lucide-react'
import { Brand } from '../components/brand'
import { authClient } from '../lib/auth-client'
import { getDashboard, saveWorkout, saveCheckIn, deleteWorkout } from '../lib/functions'
import { workoutSchema, checkInSchema } from '../lib/validation'

export const Route = createFileRoute('/dashboard')({
  head: () => ({
    meta: [
      { title: 'Your training record — Steve Rossiter Coaching' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  loader: () => getDashboard(),
  staleTime: 0,
  component: Dashboard,
})

function Dashboard() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'overview' | 'history' | 'account'>('overview')
  const [modal, setModal] = useState<'workout' | 'checkin' | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const checkIn = data.checkIns.find((item) => item.weekOf === data.currentWeek)
  const openModal = (value: 'workout' | 'checkin') => {
    setError('')
    setModal(value)
  }
  async function refresh(message: string) {
    await router.invalidate({ sync: true })
    setModal(null)
    setBusy(false)
    setNotice(message)
  }
  const today = new Date().toLocaleDateString('en-CA')

  return (
    <>
      <header className="site-header">
        <div className="container dashboard-header">
          <Brand />
          <Link to="/portal" className="text-link client-space">
            ← Client portal
          </Link>
          <Link to="/" hash="book" className="text-link">
            Explore coaching <ArrowUpRight size={16} />
          </Link>
          <button
            className="icon-button"
            title="Sign out"
            aria-label="Sign out"
            onClick={async () => {
              try {
                const result = await authClient.signOut()
                if (result.error) {
                  setNotice('Could not sign out. Please try again.')
                  return
                }
                await router.invalidate({ sync: true })
                await navigate({ to: '/login' })
              } catch {
                setNotice('Could not sign out. Please try again.')
              }
            }}
          >
            <LogOut size={19} />
          </button>
        </div>
      </header>
      <main id="main" className="container dashboard">
        <div className="dashboard-greeting">
          <div>
            <span className="eyebrow">Your effort, on record</span>
            <h1>Keep going, {data.user.name.split(' ')[0]}.</h1>
            <p>Small steps add up. Here’s where you are.</p>
          </div>
          <button className="button" onClick={() => openModal('workout')}>
            <Plus size={17} />
            Log a workout
          </button>
        </div>
        <div
          className="dashboard-tabs"
          role="tablist"
          aria-label="Client dashboard"
          onKeyDown={(event) => {
            const tabs = ['overview', 'history', 'account'] as const
            const index = tabs.indexOf(tab)
            const next =
              event.key === 'ArrowRight'
                ? (index + 1) % 3
                : event.key === 'ArrowLeft'
                  ? (index + 2) % 3
                  : event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? 2
                      : null
            if (next === null) return
            event.preventDefault()
            setTab(tabs[next])
            event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
          }}
        >
          {(['overview', 'history', 'account'] as const).map((item) => (
            <button
              key={item}
              role="tab"
              id={`tab-${item}`}
              aria-controls={`panel-${item}`}
              aria-selected={tab === item}
              tabIndex={tab === item ? 0 : -1}
              onClick={() => setTab(item)}
            >
              {item === 'overview'
                ? 'Overview'
                : item === 'history'
                  ? 'Training history'
                  : 'Your account'}
            </button>
          ))}
        </div>
        {notice && (
          <div className="notice" role="status">
            <Check size={16} />
            {notice}
            <button
              className="icon-button"
              onClick={() => setNotice('')}
              aria-label="Dismiss notification"
            >
              <X size={15} />
            </button>
          </div>
        )}
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === 'overview' && (
            <>
              <div className="dashboard-stats">
                <Stat
                  icon={<Dumbbell />}
                  value={String(data.weeklyWorkoutCount)}
                  label="Workouts this week"
                  detail={`${data.workoutCount} sessions logged overall`}
                />
                <Stat
                  icon={<Clock3 />}
                  value={`${data.totalMinutes}`}
                  label="Total minutes trained"
                  detail="Time you’ve made for yourself"
                />
                <Stat
                  icon={<ClipboardCheck />}
                  value={checkIn ? 'Done' : 'Your turn'}
                  label="This week’s check-in"
                  detail={checkIn ? 'A moment to reflect. Recorded.' : 'Take a minute to look back'}
                />
              </div>
              <div className="dashboard-grid">
                <section className="dashboard-card">
                  <div className="card-heading">
                    <div>
                      <span className="eyebrow">The work you put in</span>
                      <h2>Recent training</h2>
                    </div>
                    <button className="text-link" onClick={() => setTab('history')}>
                      View all <ArrowRight size={15} />
                    </button>
                  </div>
                  {data.workouts.length ? (
                    <WorkoutList
                      workouts={data.workouts.slice(0, 5)}
                      onDelete={(id) => {
                        setError('')
                        setDeleteId(id)
                      }}
                    />
                  ) : (
                    <EmptyState
                      icon={<Dumbbell size={27} />}
                      title="Your first session starts here."
                      text="A walk, a lift, a little movement. Log what you did and build your record."
                      action={
                        <button
                          className="button button-outline"
                          onClick={() => openModal('workout')}
                        >
                          <Plus size={16} />
                          Log your first workout
                        </button>
                      }
                    />
                  )}
                </section>
                <aside className="checkin-card">
                  <span className="eyebrow">Pause. Reflect. Move forward.</span>
                  <ClipboardCheck size={32} strokeWidth={1.4} />
                  <h2>{checkIn ? 'Your week, reflected.' : 'How’s your week feeling?'}</h2>
                  <p>
                    {checkIn
                      ? 'Your check-in is saved. You can update it any time this week.'
                      : 'Energy, sleep, and the little wins. Your weekly check-in puts your training in context.'}
                  </p>
                  {checkIn && (
                    <div className="checkin-values">
                      <span>
                        Energy <strong>{checkIn.energy}/5</strong>
                      </span>
                      <span>
                        Sleep <strong>{checkIn.sleepHours} h</strong>
                      </span>
                    </div>
                  )}
                  <button className="button" onClick={() => openModal('checkin')}>
                    {checkIn ? 'Update check-in' : 'Write your check-in'}
                    <ArrowUpRight size={16} />
                  </button>
                  <span className="form-note">
                    Week of {formatDate(data.currentWeek)} · Weeks start Monday (UTC)
                  </span>
                </aside>
              </div>
              <section className="coaching-dashboard-banner">
                <div>
                  <span className="eyebrow">You don’t have to do it alone</span>
                  <h2>A plan built around you.</h2>
                  <p>Get individual programming, nutrition guidance, and a coach in your corner.</p>
                </div>
                <Link to="/" hash="book" className="button button-outline">
                  Book a free intro call <ArrowUpRight size={16} />
                </Link>
              </section>
              {data.enquiries.length > 0 && (
                <section className="dashboard-card enquiries-card">
                  <div className="card-heading">
                    <h2>Your coaching requests</h2>
                  </div>
                  {data.enquiries.map((item) => (
                    <div className="enquiry-row" key={item.id}>
                      <div>
                        <strong>{item.interest}</strong>
                        <span>{formatDate(item.createdAt.toISOString().slice(0, 10))}</span>
                      </div>
                      <span className="badge">
                        {item.status === 'REQUESTED' ? 'Request received' : item.status}
                      </span>
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
          {tab === 'history' && (
            <div className="history-grid">
              <section className="dashboard-card">
                <div className="card-heading">
                  <h2>Your training log</h2>
                  <span className="eyebrow">{data.workoutCount} sessions</span>
                </div>
                {data.workouts.length ? (
                  <WorkoutList
                    workouts={data.workouts}
                    onDelete={(id) => {
                      setError('')
                      setDeleteId(id)
                    }}
                  />
                ) : (
                  <EmptyState
                    icon={<Dumbbell />}
                    title="A fresh page."
                    text="Your completed workouts will live here."
                    action={
                      <button className="text-link" onClick={() => openModal('workout')}>
                        Log a workout <Plus size={16} />
                      </button>
                    }
                  />
                )}
                {data.workoutCount > 50 && (
                  <p className="form-note">Showing your 50 most recent workouts.</p>
                )}
              </section>
              <section className="dashboard-card">
                <div className="card-heading">
                  <h2>Weekly reflections</h2>
                  <button
                    className="icon-button"
                    aria-label="Write check-in"
                    onClick={() => openModal('checkin')}
                  >
                    <Plus size={19} />
                  </button>
                </div>
                {data.checkIns.length ? (
                  data.checkIns.map((item) => (
                    <article className="reflection" key={item.id}>
                      <span className="eyebrow">Week of {formatDate(item.weekOf)}</span>
                      <p>{item.notes}</p>
                      <div>
                        <span>Energy {item.energy}/5</span>
                        <span>Sleep {item.sleepHours} h</span>
                        {item.weightKg && <span>{item.weightKg} kg</span>}
                      </div>
                      {item.reviewedAt && (
                        <section className="coach-feedback workspace-spaced">
                          <span className="eyebrow">Reviewed by your coach</span>
                          {item.coachNote && <p>{item.coachNote}</p>}
                        </section>
                      )}
                    </article>
                  ))
                ) : (
                  <EmptyState
                    icon={<ClipboardCheck />}
                    title="Make room to reflect."
                    text="Your weekly check-ins will appear here."
                  />
                )}
              </section>
            </div>
          )}
          {tab === 'account' && (
            <section className="dashboard-card account-card">
              <div className="card-heading">
                <h2>Your account</h2>
              </div>
              <dl className="account-details">
                <div>
                  <dt>Name</dt>
                  <dd>{data.user.name}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{data.user.email}</dd>
                </div>
              </dl>
              <h3>Change your password</h3>
              <p className="muted">For accounts created with email and password.</p>
              <form
                onSubmit={async (event) => {
                  event.preventDefault()
                  setBusy(true)
                  setError('')
                  const form = event.currentTarget
                  const fields = new FormData(form)
                  try {
                    const result = await authClient.changePassword({
                      currentPassword: String(fields.get('currentPassword')),
                      newPassword: String(fields.get('newPassword')),
                      revokeOtherSessions: true,
                    })
                    if (result.error) setError(result.error.message ?? 'Could not update password.')
                    else {
                      form.reset()
                      setNotice('Password updated. Other sessions have been signed out.')
                    }
                  } catch {
                    setError('Could not update your password. Please try again.')
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                <label>
                  Current password
                  <input
                    type="password"
                    name="currentPassword"
                    autoComplete="current-password"
                    required
                  />
                </label>
                <label>
                  New password
                  <input
                    type="password"
                    name="newPassword"
                    autoComplete="new-password"
                    minLength={10}
                    maxLength={128}
                    required
                    placeholder="At least 10 characters"
                  />
                </label>
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <button className="button" disabled={busy}>
                  {busy ? 'Updating…' : 'Update password'}
                </button>
              </form>
            </section>
          )}
        </div>
        <footer className="dashboard-footer">
          <Brand />
          <span className="eyebrow">Stronger, at your pace.</span>
        </footer>
      </main>
      {modal && (
        <Modal
          title={modal === 'workout' ? 'Put your work on record.' : 'A minute for your week.'}
          eyebrow={modal === 'workout' ? 'Your training log' : 'Weekly check-in'}
          onClose={() => !busy && setModal(null)}
        >
          <form
            onSubmit={async (event) => {
              event.preventDefault()
              setError('')
              const fields = Object.fromEntries(new FormData(event.currentTarget))
              setBusy(true)
              try {
                if (modal === 'workout') {
                  const parsed = workoutSchema.safeParse(fields)
                  if (!parsed.success) {
                    setError(parsed.error.issues[0].message)
                    setBusy(false)
                    return
                  }
                  await saveWorkout({ data: parsed.data })
                  await refresh('Workout saved. Another step forward.')
                } else {
                  const parsed = checkInSchema.safeParse(fields)
                  if (!parsed.success) {
                    setError(parsed.error.issues[0].message)
                    setBusy(false)
                    return
                  }
                  await saveCheckIn({ data: parsed.data })
                  await refresh('Your weekly check-in is saved.')
                }
              } catch {
                setError('We couldn’t save that. Please try again.')
                setBusy(false)
              }
            }}
          >
            {modal === 'workout' ? (
              <>
                <label>
                  Workout name
                  <input
                    name="title"
                    placeholder="e.g. Lower body strength"
                    autoFocus
                    required
                    minLength={2}
                    maxLength={100}
                  />
                </label>
                <div className="field-row">
                  <label>
                    Date
                    <input name="date" type="date" defaultValue={today} required />
                  </label>
                  <label>
                    Duration (minutes)
                    <input
                      name="durationMinutes"
                      type="number"
                      min={1}
                      max={600}
                      defaultValue={45}
                      required
                    />
                  </label>
                </div>
                <label>
                  Notes <span className="optional">Optional</span>
                  <textarea
                    name="notes"
                    rows={4}
                    maxLength={2000}
                    placeholder="Exercises, sets, weights, or how it felt…"
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  Energy this week
                  <select name="energy" defaultValue={checkIn?.energy ?? 3}>
                    {['Very low', 'A little low', 'Steady', 'Good', 'Full of energy'].map(
                      (value, index) => (
                        <option key={value} value={index + 1}>
                          {index + 1} — {value}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <div className="field-row">
                  <label>
                    Average sleep (hours)
                    <input
                      type="number"
                      name="sleepHours"
                      min={0}
                      max={24}
                      step={0.1}
                      defaultValue={checkIn?.sleepHours ?? 7}
                      required
                    />
                  </label>
                  <label>
                    Weight (kg) <span className="optional">Optional</span>
                    <input
                      type="number"
                      name="weightKg"
                      min={20}
                      max={500}
                      step={0.1}
                      defaultValue={checkIn?.weightKg ?? ''}
                      placeholder="Optional"
                    />
                  </label>
                </div>
                <label>
                  How did your week go?
                  <textarea
                    name="notes"
                    rows={4}
                    minLength={5}
                    maxLength={2000}
                    defaultValue={checkIn?.notes ?? ''}
                    placeholder="Wins, challenges, and what you want to focus on next…"
                    required
                  />
                </label>
                <p className="form-note">
                  One check-in per week. Saving again updates this week’s entry.
                </p>
              </>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button" disabled={busy}>
              {busy ? (
                <>
                  <LoaderCircle size={16} className="spin" />
                  Saving…
                </>
              ) : (
                <>
                  Save {modal === 'workout' ? 'workout' : 'check-in'}
                  <Check size={16} />
                </>
              )}
            </button>
          </form>
        </Modal>
      )}
      {deleteId && (
        <Modal
          title="Remove this workout?"
          eyebrow="Your training log"
          onClose={() => !busy && setDeleteId(null)}
        >
          <p>This removes the session from your record and your totals.</p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="button-row">
            <button
              className="button button-outline"
              disabled={busy}
              onClick={() => setDeleteId(null)}
            >
              Keep workout
            </button>
            <button
              className="button button-danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await deleteWorkout({ data: { id: deleteId } })
                  await router.invalidate({ sync: true })
                  setDeleteId(null)
                  setNotice('Workout removed.')
                } catch {
                  setError('Could not remove this workout. Please try again.')
                } finally {
                  setBusy(false)
                }
              }}
            >
              {busy ? 'Removing…' : 'Remove workout'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

function Stat({
  icon,
  value,
  label,
  detail,
}: {
  icon: ReactNode
  value: string
  label: string
  detail: string
}) {
  return (
    <article className="stat-card">
      <div>
        <span className="eyebrow">{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  )
}

function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode
  title: string
  text: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  )
}

function WorkoutList({
  workouts,
  onDelete,
}: {
  workouts: {
    id: string
    title: string
    date: string
    durationMinutes: number
    notes: string | null
  }[]
  onDelete: (id: string) => void
}) {
  return (
    <div className="workout-list">
      {workouts.map((workout) => (
        <article className="workout-row" key={workout.id}>
          <span className="workout-icon">
            <Dumbbell size={19} />
          </span>
          <div>
            <h3>{workout.title}</h3>
            <span>
              {formatDate(workout.date)} · {workout.durationMinutes} min
            </span>
            {workout.notes && <p>{workout.notes}</p>}
          </div>
          <button
            className="icon-button"
            aria-label={`Remove ${workout.title}`}
            onClick={() => onDelete(workout.id)}
          >
            <Trash2 size={16} />
          </button>
        </article>
      ))}
    </div>
  )
}

function Modal({
  title,
  eyebrow,
  onClose,
  children,
}: {
  title: string
  eyebrow: string
  onClose: () => void
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect()
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose()
        }
      }}
    >
      <button className="icon-button modal-close" aria-label="Close dialog" onClick={onClose}>
        <X size={20} />
      </button>
      <span className="eyebrow">{eyebrow}</span>
      <h2 id="modal-title">{title}</h2>
      {children}
    </dialog>
  )
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
