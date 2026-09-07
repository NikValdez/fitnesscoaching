import {
  createFileRoute,
  useNavigate,
  useRouter,
  type SearchSchemaInput,
} from '@tanstack/react-router'
import { useState } from 'react'
import {
  Plus,
  Users,
  CalendarDays,
  ClipboardCheck,
  ArrowUpRight,
  Search,
  Check,
  Pencil,
  Trash2,
} from 'lucide-react'
import {
  getCoachWorkspace,
  setEventDone,
  reviewCheckIn,
  archiveProgram,
  deleteEvent,
} from '../lib/coaching'
import { localDate } from '../lib/coaching-validation'
import {
  Workspace,
  Calendar,
  WorkspaceModal,
  Notice,
  Empty,
  displayDate,
  kindLabels,
} from '../components/workspace'
import { PlanCard, PlanDetails, type PlanData } from '../components/plan-card'
import { EventForm, ProgramForm, type EventData } from '../components/coaching-forms'
import { IntakeSummary } from '../components/intake-summary'

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'clients', label: 'Clients' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'programs', label: 'Programs' },
  { id: 'checkins', label: 'Check-ins' },
]
export const Route = createFileRoute('/coach')({
  head: () => ({
    meta: [
      { title: 'Coach workspace — Steve Rossiter Coaching' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  validateSearch: (
    search: { month?: unknown; tab?: unknown; clientId?: unknown } & SearchSchemaInput,
  ) => ({
    month:
      typeof search.month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(search.month)
        ? search.month
        : localDate().slice(0, 7),
    tab: tabs.some((tab) => tab.id === search.tab) ? String(search.tab) : 'overview',
    clientId: typeof search.clientId === 'string' ? search.clientId : '',
  }),
  loaderDeps: ({ search }) => ({ month: search.month, clientId: search.clientId }),
  loader: ({ deps }) => getCoachWorkspace({ data: deps }),
  component: CoachWorkspace,
})

function CoachWorkspace() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/coach' })
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [programForm, setProgramForm] = useState<{
    kind: 'FITNESS' | 'NUTRITION'
    initial?: PlanData
  } | null>(null)
  const [eventForm, setEventForm] = useState<EventData | 'new' | null>(null)
  const [event, setEvent] = useState<(typeof data.events)[number] | null>(null)
  const [review, setReview] = useState<(typeof data.checkIns)[number] | null>(null)
  const [confirm, setConfirm] = useState<{
    type: 'archive' | 'delete'
    id: string
    title: string
  } | null>(null)
  const client = data.clients.find((client) => client.id === search.clientId)
  const pending = data.clients
    .filter((client) => !search.clientId || client.id === search.clientId)
    .reduce((sum, client) => sum + client._count.checkIns, 0)
  const filteredClients = data.clients.filter((client) =>
    `${client.name} ${client.email}`.toLowerCase().includes(query.toLowerCase()),
  )
  const changeTab = (tab: string) => navigate({ search: { ...search, tab } })
  async function refresh(message: string) {
    await router.invalidate({ sync: true })
    setProgramForm(null)
    setEventForm(null)
    setEvent(null)
    setPlan(null)
    setReview(null)
    setConfirm(null)
    setNotice(message)
  }
  const reviewList = (items: typeof data.checkIns) =>
    items.length ? (
      <div className="review-list">
        {items.map((item) => (
          <button
            key={item.id}
            className="review-row"
            onClick={() => {
              setError('')
              setReview(item)
            }}
          >
            <span className="workspace-avatar">{item.user.name.slice(0, 1)}</span>
            <div>
              <strong>{item.user.name}</strong>
              <span>
                Week of {displayDate(item.weekOf)} · Energy {item.energy}/5 · Sleep{' '}
                {item.sleepHours}h
              </span>
              <p>{item.notes}</p>
            </div>
            <span className={`event-status ${item.reviewedAt ? 'done' : ''}`}>
              {item.reviewedAt ? 'Reviewed' : 'Needs review'}
            </span>
            <ArrowUpRight size={15} />
          </button>
        ))}
      </div>
    ) : (
      <Empty
        title="All caught up."
        text="Client check-ins will appear here when they’re submitted."
      />
    )
  return (
    <Workspace coach name={data.user.name} tabs={tabs} tab={search.tab} onTab={changeTab}>
      <div className="workspace-page-heading">
        <div>
          <span className="eyebrow">Your clients. Your practice.</span>
          <h1>
            {client
              ? client.name
              : search.tab === 'overview'
                ? 'A clear view of the week.'
                : search.tab === 'clients'
                  ? 'People behind the progress.'
                  : search.tab === 'calendar'
                    ? 'Your coaching calendar.'
                    : search.tab === 'programs'
                      ? 'Purpose behind every plan.'
                      : 'Listen. Review. Adjust.'}
          </h1>
          <p>
            {client
              ? client.email
              : search.tab === 'overview'
                ? 'A little structure for the work that makes a difference.'
                : search.tab === 'clients'
                  ? 'Open a client to see their plans, schedule, and recent tracking.'
                  : search.tab === 'calendar'
                    ? 'Every client, session, check-in, and preparation task.'
                    : search.tab === 'programs'
                      ? 'Individual fitness and nutrition programs, built by you.'
                      : 'Weekly reflections, ready for your feedback.'}
          </p>
        </div>
        <button
          className="button"
          disabled={!data.clients.length}
          onClick={() => setEventForm('new')}
        >
          <Plus size={17} />
          Schedule an item
        </button>
      </div>
      <div className="workspace-filter-bar">
        <label>
          Viewing
          <select
            aria-label="Filter by client"
            value={search.clientId}
            onChange={(e) => navigate({ search: { ...search, clientId: e.target.value } })}
          >
            <option value="">All clients</option>
            {data.clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
        <span className="form-note">
          <CalendarDays size={14} />
          All scheduled times are Los Angeles time
        </span>
        {client && (
          <button
            className="text-link"
            onClick={() => navigate({ search: { ...search, clientId: '' } })}
          >
            Clear client filter
          </button>
        )}
      </div>
      {notice && <Notice message={notice} onClose={() => setNotice('')} />}
      {client && <IntakeSummary intake={client.intake} email={client.email} />}
      {!data.clients.length && (
        <div className="workspace-panel coach-onboarding">
          <Users size={30} strokeWidth={1.4} />
          <h2>Your first client is the next step.</h2>
          <p>
            Clients create an account on your website. They’ll appear here automatically, ready for
            a program and a place on your calendar.
          </p>
          <a className="button button-outline" href="/signup" target="_blank" rel="noreferrer">
            Open client sign-up <ArrowUpRight size={16} />
          </a>
        </div>
      )}
      {search.tab === 'overview' && (
        <>
          <div className="portal-stats">
            <CoachMetric
              label={client ? 'Assigned programs' : 'Your clients'}
              value={String(client ? data.programs.length : data.clients.length)}
              note={client ? 'Fitness and nutrition' : 'Individual attention, every time'}
              icon={<Users size={20} />}
            />
            <CoachMetric
              label="On the calendar"
              value={String(data.events.length)}
              note={`${data.events.filter((event) => event.completedAt).length} complete this month`}
              icon={<CalendarDays size={20} />}
            />
            <CoachMetric
              label="Check-ins to review"
              value={String(pending)}
              note="A chance to make an adjustment"
              icon={<ClipboardCheck size={20} />}
            />
          </div>
          <div className="coach-actions">
            <button
              onClick={() => setProgramForm({ kind: 'FITNESS' })}
              disabled={!data.clients.length}
            >
              <Plus size={18} />
              <div>
                <strong>Create fitness plan</strong>
                <span>Exercises, progression, coaching cues</span>
              </div>
              <ArrowUpRight size={18} />
            </button>
            <button
              onClick={() => setProgramForm({ kind: 'NUTRITION' })}
              disabled={!data.clients.length}
            >
              <Plus size={18} />
              <div>
                <strong>Create nutrition plan</strong>
                <span>Daily targets and practical guidance</span>
              </div>
              <ArrowUpRight size={18} />
            </button>
          </div>
          <section className="workspace-panel workspace-spaced">
            <div className="workspace-section-heading">
              <div>
                <span className="eyebrow">Keep the conversation going</span>
                <h2>Ready for your review</h2>
              </div>
              <button className="text-link" onClick={() => changeTab('checkins')}>
                All check-ins <ArrowUpRight size={16} />
              </button>
            </div>
            {reviewList(data.checkIns.filter((item) => !item.reviewedAt).slice(0, 5))}
          </section>
          <div className="workspace-section-heading workspace-spaced">
            <h2>{client ? 'Client schedule' : 'The month ahead'}</h2>
          </div>
          <Calendar
            month={search.month}
            today={data.today}
            entries={data.events.map((event) => ({ ...event, clientName: event.client.name }))}
            onMonth={(month) => navigate({ search: { ...search, month } })}
            onEntry={(entry) => {
              setError('')
              setEvent(data.events.find((item) => item.id === entry.id) || null)
            }}
          />
          {client && (
            <ClientTracking workouts={data.recentWorkouts} nutrition={data.nutritionLogs} />
          )}
        </>
      )}
      {search.tab === 'clients' && (
        <section className="workspace-panel">
          <div className="workspace-section-heading">
            <h2>
              Client roster <span className="count-badge">{data.clients.length}</span>
            </h2>
            <label className="client-search">
              <Search size={15} />
              <input
                aria-label="Search clients"
                placeholder="Search name or email"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>
          <div className="client-table">
            <div className="client-table-head">
              <span>Client</span>
              <span>Programs</span>
              <span>Workouts logged</span>
              <span>Check-ins</span>
              <span />
            </div>
            {filteredClients.map((client) => (
              <button
                key={client.id}
                className="client-table-row"
                onClick={() =>
                  navigate({ search: { ...search, clientId: client.id, tab: 'overview' } })
                }
              >
                <div>
                  <span className="workspace-avatar">
                    {client.name
                      .split(' ')
                      .map((s) => s[0])
                      .slice(0, 2)
                      .join('')}
                  </span>
                  <span>
                    <strong>{client.name}</strong>
                    <small>{client.email}</small>
                  </span>
                </div>
                <span>
                  {client._count.programs}
                  <small className="mobile-column-label"> programs</small>
                </span>
                <span>
                  {client._count.workouts}
                  <small className="mobile-column-label"> sessions</small>
                </span>
                <span className={client._count.checkIns ? 'pending-text' : 'muted'}>
                  {client._count.checkIns ? `${client._count.checkIns} to review` : 'Up to date'}
                </span>
                <ArrowUpRight size={16} />
              </button>
            ))}
            {!filteredClients.length && (
              <Empty
                title={query ? 'No matches.' : 'Your roster starts here.'}
                text={
                  query ? 'Try another name or email.' : 'New client accounts will appear here.'
                }
              />
            )}
          </div>
        </section>
      )}
      {search.tab === 'calendar' && (
        <Calendar
          month={search.month}
          today={data.today}
          entries={data.events.map((event) => ({ ...event, clientName: event.client.name }))}
          onMonth={(month) => navigate({ search: { ...search, month } })}
          onEntry={(entry) => {
            setError('')
            setEvent(data.events.find((item) => item.id === entry.id) || null)
          }}
        />
      )}
      {search.tab === 'programs' && (
        <>
          <div className="workspace-section-heading">
            <h2>Assigned programs</h2>
            <div className="button-row">
              <button
                className="button button-outline"
                disabled={!data.clients.length}
                onClick={() => setProgramForm({ kind: 'NUTRITION' })}
              >
                <Plus size={15} />
                Nutrition plan
              </button>
              <button
                className="button"
                disabled={!data.clients.length}
                onClick={() => setProgramForm({ kind: 'FITNESS' })}
              >
                <Plus size={15} />
                Fitness plan
              </button>
            </div>
          </div>
          {data.programs.length ? (
            <div className="plan-grid">
              {data.programs.map((plan) => (
                <PlanCard key={plan.id} plan={plan} onOpen={() => setPlan(plan)} />
              ))}
            </div>
          ) : (
            <Empty
              title="A fresh page for progress."
              text="Create an individual fitness or nutrition plan, then add sessions to your calendar."
            />
          )}
        </>
      )}
      {search.tab === 'checkins' && (
        <section className="workspace-panel">
          <div className="workspace-section-heading">
            <h2>Weekly check-ins</h2>
            <span className="form-note">{pending} awaiting review · Latest 100 entries</span>
          </div>
          {reviewList(data.checkIns)}
        </section>
      )}
      {programForm && (
        <ProgramForm
          clients={data.clients}
          kind={programForm.kind}
          initial={programForm.initial}
          clientId={search.clientId}
          today={data.today}
          onClose={() => setProgramForm(null)}
          onSaved={() => refresh('Plan saved and assigned to the client.')}
        />
      )}
      {eventForm && (
        <EventForm
          clients={data.clients}
          plans={data.programs}
          initial={eventForm === 'new' ? undefined : eventForm}
          clientId={search.clientId}
          today={data.today}
          onClose={() => setEventForm(null)}
          onSaved={() => refresh('Schedule updated.')}
        />
      )}
      {plan && (
        <WorkspaceModal title={plan.title} label="Assigned program" onClose={() => setPlan(null)}>
          <PlanDetails plan={plan} />
          <div className="button-row workspace-spaced">
            <button
              className="button"
              onClick={() => {
                setProgramForm({ kind: plan.kind, initial: plan })
                setPlan(null)
              }}
            >
              <Pencil size={16} />
              Edit plan
            </button>
            <button
              className="button button-outline"
              onClick={() => {
                setError('')
                setConfirm({ type: 'archive', id: plan.id, title: plan.title })
                setPlan(null)
              }}
            >
              Archive plan
            </button>
          </div>
        </WorkspaceModal>
      )}
      {event && (
        <WorkspaceModal
          title={event.title}
          label={kindLabels[event.kind]}
          busy={busy}
          onClose={() => setEvent(null)}
        >
          <div className="event-details">
            <span className="badge">{event.client.name}</span>
            <p>
              {displayDate(event.date)} · {event.time || 'Any time'} · {event.durationMinutes} min
            </p>
            <span className="form-note">
              Los Angeles time{event.kind === 'COACH_TASK' ? ' · Visible only to coaches' : ''}
            </span>
            <p className="preserve-lines">{event.notes}</p>
            {event.program && <p className="form-note">Linked plan: {event.program.title}</p>}
            <div className="button-row workspace-spaced">
              <button
                className="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  setError('')
                  try {
                    await setEventDone({ data: { id: event.id, done: !event.completedAt } })
                    await refresh(
                      event.completedAt
                        ? 'Scheduled item reopened.'
                        : 'Scheduled item marked complete.',
                    )
                  } catch {
                    setError('Could not update this item.')
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                <Check size={16} />
                {busy ? 'Saving…' : event.completedAt ? 'Mark as not done' : 'Mark as done'}
              </button>
              <button
                className="button button-outline"
                disabled={busy}
                onClick={() => {
                  setEventForm(event)
                  setEvent(null)
                }}
              >
                <Pencil size={15} />
                Edit
              </button>
              <button
                className="icon-button"
                disabled={busy}
                aria-label="Delete scheduled item"
                onClick={() => {
                  setConfirm({ type: 'delete', id: event.id, title: event.title })
                  setEvent(null)
                }}
              >
                <Trash2 size={17} />
              </button>
            </div>
            {error && (
              <p role="alert" className="form-error workspace-spaced">
                {error}
              </p>
            )}
          </div>
        </WorkspaceModal>
      )}
      {review && (
        <WorkspaceModal
          title={`${review.user.name}’s check-in`}
          label={`Week of ${displayDate(review.weekOf)}`}
          onClose={() => setReview(null)}
          busy={busy}
        >
          <div className="review-metrics">
            <span>
              Energy <strong>{review.energy}/5</strong>
            </span>
            <span>
              Sleep <strong>{review.sleepHours} h</strong>
            </span>
            {review.weightKg != null && (
              <span>
                Weight <strong>{review.weightKg} kg</strong>
              </span>
            )}
          </div>
          <p className="preserve-lines checkin-quote">{review.notes}</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              const form = new FormData(e.currentTarget)
              setBusy(true)
              setError('')
              try {
                await reviewCheckIn({
                  data: { id: review.id, reviewed: true, coachNote: String(form.get('coachNote')) },
                })
                await refresh('Check-in reviewed. Feedback is visible to the client.')
              } catch {
                setError('Could not save this review. Please try again.')
              } finally {
                setBusy(false)
              }
            }}
          >
            <label>
              Your feedback
              <textarea
                name="coachNote"
                rows={4}
                maxLength={5000}
                defaultValue={review.coachNote || ''}
                placeholder="What went well, and one useful adjustment…"
              />
            </label>
            <p className="form-note">This note is shared with the client.</p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button" disabled={busy}>
              <Check size={16} />
              {busy
                ? 'Saving…'
                : review.reviewedAt
                  ? 'Update review'
                  : 'Mark reviewed & save feedback'}
            </button>
          </form>
        </WorkspaceModal>
      )}
      {confirm && (
        <WorkspaceModal
          title={confirm.type === 'archive' ? 'Archive this plan?' : 'Remove this scheduled item?'}
          label={confirm.title}
          busy={busy}
          onClose={() => setConfirm(null)}
        >
          <p>
            {confirm.type === 'archive'
              ? 'The plan will leave the client’s current programs. Past calendar items and tracking records stay in place.'
              : 'This removes the item from both calendars. Logged workouts and check-ins are kept.'}
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="button-row">
            <button
              className="button button-outline"
              disabled={busy}
              onClick={() => setConfirm(null)}
            >
              Cancel
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                setError('')
                try {
                  if (confirm.type === 'archive') await archiveProgram({ data: { id: confirm.id } })
                  else await deleteEvent({ data: { id: confirm.id } })
                  await refresh(
                    confirm.type === 'archive' ? 'Plan archived.' : 'Scheduled item removed.',
                  )
                } catch {
                  setError('Could not complete that action. Please try again.')
                } finally {
                  setBusy(false)
                }
              }}
            >
              {busy ? 'Saving…' : confirm.type === 'archive' ? 'Archive plan' : 'Remove item'}
            </button>
          </div>
        </WorkspaceModal>
      )}
    </Workspace>
  )
}
function CoachMetric({
  label,
  value,
  note,
  icon,
}: {
  label: string
  value: string
  note: string
  icon: React.ReactNode
}) {
  return (
    <article className="portal-metric">
      <div>
        <span className="eyebrow">{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  )
}
function ClientTracking({
  workouts,
  nutrition,
}: {
  workouts: {
    id: string
    title: string
    date: string
    durationMinutes: number
    notes: string | null
  }[]
  nutrition: {
    id: string
    date: string
    calories: number
    proteinGrams: number
    carbsGrams: number
    fatsGrams: number
    waterLitres: number
    notes: string | null
  }[]
}) {
  return (
    <div className="client-tracking-grid workspace-spaced">
      <section className="workspace-panel">
        <div className="workspace-section-heading">
          <h2>Recent workouts</h2>
          <span className="form-note">Latest 30</span>
        </div>
        {workouts.length ? (
          workouts.map((item) => (
            <article className="tracking-row" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <span>
                  {displayDate(item.date)} · {item.durationMinutes} min
                </span>
                <p>{item.notes}</p>
              </div>
            </article>
          ))
        ) : (
          <p className="muted">No workouts logged yet.</p>
        )}
      </section>
      <section className="workspace-panel">
        <div className="workspace-section-heading">
          <h2>Nutrition tracking</h2>
          <span className="form-note">Latest 30 days</span>
        </div>
        {nutrition.length ? (
          nutrition.map((item) => (
            <article className="tracking-row" key={item.id}>
              <div>
                <strong>
                  {displayDate(item.date)} · {item.calories} kcal
                </strong>
                <span>
                  P {item.proteinGrams}g · C {item.carbsGrams}g · F {item.fatsGrams}g ·{' '}
                  {item.waterLitres} L water
                </span>
                <p>{item.notes}</p>
              </div>
            </article>
          ))
        ) : (
          <p className="muted">No nutrition entries yet.</p>
        )}
      </section>
    </div>
  )
}
