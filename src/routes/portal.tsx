import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
  type SearchSchemaInput,
} from '@tanstack/react-router'
import { useState } from 'react'
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ClipboardCheck,
  Dumbbell,
  Plus,
  Utensils,
} from 'lucide-react'
import { getClientPortal, setEventDone } from '../lib/coaching'
import { localDate } from '../lib/coaching-validation'
import {
  Calendar,
  Empty,
  Notice,
  Workspace,
  WorkspaceModal,
  displayDate,
  kindLabels,
  type CalendarEntry,
} from '../components/workspace'
import { PlanCard, PlanDetails, type PlanData } from '../components/plan-card'
import { NutritionForm, type NutritionData } from '../components/coaching-forms'
import { IntakeSummary } from '../components/intake-summary'

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'calendar', label: 'My calendar' },
  { id: 'workouts', label: 'My workouts' },
  { id: 'nutrition', label: 'My nutrition' },
]
export const Route = createFileRoute('/portal')({
  head: () => ({
    meta: [
      { title: 'Client portal — Steve Rossiter Coaching' },
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
  }),
  loaderDeps: ({ search }) => ({ month: search.month }),
  loader: ({ deps }) => getClientPortal({ data: deps }),
  component: ClientPortal,
})

function ClientPortal() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/portal' })
  const router = useRouter()
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [event, setEvent] = useState<(typeof data.events)[number] | null>(null)
  const [record, setRecord] = useState<CalendarEntry | null>(null)
  const [nutrition, setNutrition] = useState<NutritionData | 'new' | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const changeTab = (tab: string) => navigate({ search: { ...search, tab } })
  const fitness = data.programs.filter((plan) => plan.kind === 'FITNESS')
  const nutritionPlans = data.programs.filter((plan) => plan.kind === 'NUTRITION')
  const target = nutritionPlans.find(
    (plan) => plan.startDate <= data.today && (!plan.endDate || plan.endDate >= data.today),
  )
  const todayLog = data.nutritionLogs.find((log) => log.date === data.today)
  const latestFeedback = data.checkIns.find((item) => item.reviewedAt && item.coachNote)
  const entries: CalendarEntry[] = [
    ...data.events,
    ...data.workouts.map((item) => ({
      id: `log-${item.id}`,
      title: item.title,
      date: item.date,
      kind: 'LOG',
      readOnly: true,
      completedAt: item.createdAt,
    })),
    ...data.nutritionLogs.map((item) => ({
      id: `food-${item.id}`,
      title: 'Nutrition recorded',
      date: item.date,
      kind: 'FOOD',
      readOnly: true,
      completedAt: item.createdAt,
    })),
    ...data.checkIns
      .filter((item) => item.weekOf.startsWith(search.month))
      .map((item) => ({
        id: `reflection-${item.id}`,
        title: 'Weekly reflection',
        date: item.weekOf,
        kind: 'REFLECTION',
        readOnly: true,
        completedAt: item.createdAt,
      })),
  ]
  async function saved(message: string) {
    await router.invalidate({ sync: true })
    setNutrition(null)
    setEvent(null)
    setNotice(message)
  }
  const onEntry = (entry: CalendarEntry) => {
    setError('')
    if (entry.readOnly) setRecord(entry)
    else setEvent(data.events.find((event) => event.id === entry.id) || null)
  }
  return (
    <Workspace name={data.user.name} tab={search.tab} tabs={tabs} onTab={changeTab}>
      <div className="workspace-page-heading">
        <div>
          <span className="eyebrow">Your plan. Your pace.</span>
          <h1>
            {search.tab === 'overview'
              ? `Good to see you, ${data.user.name.split(' ')[0]}.`
              : search.tab === 'calendar'
                ? 'Your month, mapped out.'
                : search.tab === 'workouts'
                  ? 'Built for your next rep.'
                  : 'Fuel for the work you do.'}
          </h1>
          <p>
            {search.tab === 'overview'
              ? 'Your coaching, schedule, and progress—all in one place.'
              : search.tab === 'calendar'
                ? 'Training, nutrition, check-ins, and the work you’ve logged.'
                : search.tab === 'workouts'
                  ? 'Individual programs from your coach, ready when you are.'
                  : 'Practical guidance, personal targets, and your daily record.'}
          </p>
        </div>
        <span className="workspace-date">
          <CalendarDays size={16} />
          {displayDate(data.today)}
        </span>
      </div>
      {notice && <Notice message={notice} onClose={() => setNotice('')} />}
      {search.tab === 'overview' && (
        <>
          <IntakeSummary intake={data.intake} editable email={data.user.email} />
          <div className="portal-stats">
            <Metric
              label="Assigned programs"
              value={String(data.programs.length)}
              note="Made for you"
              icon={<Dumbbell size={20} />}
            />
            <Metric
              label="Sessions logged"
              value={String(data.workouts.length)}
              note={`In ${new Date(`${search.month}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })}`}
              icon={<CalendarDays size={20} />}
            />
            <Metric
              label="Nutrition tracked"
              value={`${data.nutritionLogs.length} days`}
              note="This calendar month"
              icon={<Utensils size={20} />}
            />
          </div>
          <div className="portal-overview-grid">
            <section className="workspace-panel">
              <div className="workspace-section-heading">
                <div>
                  <span className="eyebrow">One session at a time</span>
                  <h2>On your schedule</h2>
                </div>
                <button className="text-link" onClick={() => changeTab('calendar')}>
                  View calendar <ArrowUpRight size={16} />
                </button>
              </div>
              {data.events.length ? (
                <div className="schedule-list">
                  {data.events.slice(0, 5).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setError('')
                        setEvent(item)
                      }}
                      className="schedule-row"
                    >
                      <span className={`schedule-kind kind-${item.kind.toLowerCase()}`}>
                        <CalendarDays size={18} />
                      </span>
                      <div>
                        <strong>{item.title}</strong>
                        <span>
                          {displayDate(item.date)} · {item.time || 'Any time'} ·{' '}
                          {kindLabels[item.kind]}
                        </span>
                      </div>
                      <span className={`event-status ${item.completedAt ? 'done' : ''}`}>
                        {item.completedAt ? 'Done' : 'Scheduled'}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <Empty
                  title="Your next chapter starts here."
                  text="Your coach’s scheduled workouts and check-ins will appear here."
                />
              )}
            </section>
            <aside className="portal-checkin">
              <span className="eyebrow">A moment to reflect</span>
              <ClipboardCheck size={34} strokeWidth={1.4} />
              <h2>How’s your week feeling?</h2>
              <p>
                Share the wins, the challenges, and how you’re recovering. Your coach can review
                your check-in and leave feedback.
              </p>
              <Link to="/dashboard" className="button">
                Training &amp; check-ins <ArrowUpRight size={16} />
              </Link>
            </aside>
          </div>
          {latestFeedback && (
            <section className="coach-feedback portal-feedback">
              <span className="eyebrow">
                A note from your coach · Week of {displayDate(latestFeedback.weekOf)}
              </span>
              <p>{latestFeedback.coachNote}</p>
            </section>
          )}
          <div className="workspace-section-heading">
            <h2>Your programs</h2>
            <span className="form-note">Written by your coach</span>
          </div>
          {data.programs.length ? (
            <div className="plan-grid">
              {data.programs.slice(0, 4).map((plan) => (
                <PlanCard key={plan.id} plan={plan} onOpen={() => setPlan(plan)} />
              ))}
            </div>
          ) : (
            <Empty
              title="A plan with your name on it."
              text="When your coach assigns a fitness or nutrition plan, you’ll find it here."
            />
          )}
        </>
      )}
      {search.tab === 'calendar' && (
        <Calendar
          month={search.month}
          today={data.today}
          entries={entries}
          onMonth={(month) => navigate({ search: { ...search, month } })}
          onEntry={onEntry}
        />
      )}
      {search.tab === 'workouts' && (
        <>
          <div className="workspace-section-heading">
            <h2>Assigned fitness programs</h2>
            <Link to="/dashboard" className="button button-outline">
              <Plus size={16} />
              Log a workout
            </Link>
          </div>
          {fitness.length ? (
            <div className="plan-grid">
              {fitness.map((plan) => (
                <PlanCard key={plan.id} plan={plan} onOpen={() => setPlan(plan)} />
              ))}
            </div>
          ) : (
            <Empty
              title="Your program is on its way."
              text="Your coach can build a program with exercises, sets, reps, and guidance just for you."
            />
          )}
          <section className="workspace-panel workspace-spaced">
            <div className="workspace-section-heading">
              <h2>Your logged training</h2>
              <Link to="/dashboard" className="text-link">
                Full training history <ArrowUpRight size={16} />
              </Link>
            </div>
            {data.workouts.length ? (
              data.workouts.map((item) => (
                <article key={item.id} className="tracking-row">
                  <div>
                    <strong>{item.title}</strong>
                    <span>
                      {displayDate(item.date)} · {item.durationMinutes} min
                    </span>
                    {item.notes && <p>{item.notes}</p>}
                  </div>
                  <Check size={16} />
                </article>
              ))
            ) : (
              <p className="muted">No workouts logged in this month yet.</p>
            )}
          </section>
        </>
      )}
      {search.tab === 'nutrition' && (
        <>
          <div className="workspace-section-heading">
            <h2>Your daily targets</h2>
            <button className="button" onClick={() => setNutrition(todayLog || 'new')}>
              <Plus size={16} />
              {todayLog ? 'Update today’s log' : 'Log nutrition'}
            </button>
          </div>
          {target ? (
            <div className="nutrition-targets">
              {[
                ['Calories', target.calories, todayLog?.calories, 'kcal'],
                ['Protein', target.proteinGrams, todayLog?.proteinGrams, 'g'],
                ['Carbs', target.carbsGrams, todayLog?.carbsGrams, 'g'],
                ['Fats', target.fatsGrams, todayLog?.fatsGrams, 'g'],
              ].map(([label, goal, actual, unit]) => (
                <article key={String(label)}>
                  <span className="eyebrow">{label}</span>
                  <strong>
                    {goal ?? '—'} <small>{goal != null ? unit : ''}</small>
                  </strong>
                  <p>
                    {actual != null ? `${actual} ${unit} logged today` : 'No entry for today yet'}
                  </p>
                  {typeof goal === 'number' && goal > 0 && (
                    <progress
                      max={goal}
                      value={Number(actual || 0)}
                      aria-label={`${label} logged against target`}
                    />
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="workspace-panel nutrition-placeholder">
              <Utensils size={22} />
              <p>
                Your coach hasn’t assigned current daily targets yet. You can still keep a nutrition
                log.
              </p>
            </div>
          )}
          <div className="workspace-section-heading workspace-spaced">
            <h2>Your nutrition plans</h2>
          </div>
          {nutritionPlans.length ? (
            <div className="plan-grid">
              {nutritionPlans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} onOpen={() => setPlan(plan)} />
              ))}
            </div>
          ) : (
            <Empty
              title="Build habits that work for you."
              text="Your coach’s meal guidance and nutrition plans will be saved here."
            />
          )}
          <section className="workspace-panel workspace-spaced">
            <div className="workspace-section-heading">
              <h2>Your nutrition record</h2>
              <span className="form-note">Select a day to edit</span>
            </div>
            {data.nutritionLogs.length ? (
              data.nutritionLogs.map((log) => (
                <button
                  className="nutrition-log-row"
                  key={log.id}
                  onClick={() => setNutrition(log)}
                >
                  <strong>{displayDate(log.date)}</strong>
                  <span>{log.calories} kcal</span>
                  <span>
                    P {log.proteinGrams}g · C {log.carbsGrams}g · F {log.fatsGrams}g
                  </span>
                  <span>{log.waterLitres} L water</span>
                  <ArrowUpRight size={15} />
                </button>
              ))
            ) : (
              <p className="muted">No nutrition entries in this month yet.</p>
            )}
          </section>
        </>
      )}
      {plan && (
        <WorkspaceModal
          title={plan.title}
          label={plan.kind === 'FITNESS' ? 'Your fitness program' : 'Your nutrition plan'}
          onClose={() => setPlan(null)}
        >
          <PlanDetails plan={plan} />
          <button
            className="button button-outline workspace-spaced"
            onClick={() => {
              setPlan(null)
              changeTab('calendar')
            }}
          >
            See my calendar <ArrowUpRight size={16} />
          </button>
        </WorkspaceModal>
      )}
      {event && (
        <WorkspaceModal
          title={event.title}
          label={kindLabels[event.kind]}
          onClose={() => setEvent(null)}
          busy={busy}
        >
          <div className="event-details">
            <p>
              {displayDate(event.date)} · {event.time || 'Any time'} · {event.durationMinutes} min
            </p>
            <span className="form-note">All scheduled times are Los Angeles time.</span>
            <p className="preserve-lines">{event.notes}</p>
            {event.program && (
              <button
                className="text-link"
                onClick={() => {
                  const linked = data.programs.find((plan) => plan.id === event.programId)
                  if (linked) {
                    setPlan(linked)
                    setEvent(null)
                  } else
                    setError(
                      'This plan has been archived. Please ask your coach for the current plan.',
                    )
                }}
              >
                View {event.program.title} <ArrowUpRight size={16} />
              </button>
            )}
            {event.kind === 'CHECK_IN' ? (
              <>
                <p className="form-note workspace-spaced">
                  Your coach marks this check-in complete after reviewing it.
                </p>
                <Link className="button workspace-spaced" to="/dashboard">
                  Write your weekly check-in <ArrowUpRight size={16} />
                </Link>
              </>
            ) : (
              <button
                className="button workspace-spaced"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  setError('')
                  try {
                    await setEventDone({ data: { id: event.id, done: !event.completedAt } })
                    await saved(
                      event.completedAt ? 'Item reopened.' : 'Progress recorded. Well done.',
                    )
                  } catch {
                    setError('Could not update this item. Please try again.')
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                <Check size={16} />
                {busy ? 'Saving…' : event.completedAt ? 'Mark as not done' : 'Mark as done'}
              </button>
            )}
            {error && (
              <p role="alert" className="form-error workspace-spaced">
                {error}
              </p>
            )}
          </div>
        </WorkspaceModal>
      )}
      {record && (
        <WorkspaceModal
          title={record.title}
          label={kindLabels[record.kind]}
          onClose={() => setRecord(null)}
        >
          {record.kind === 'LOG' &&
            data.workouts
              .filter((item) => `log-${item.id}` === record.id)
              .map((item) => (
                <div key={item.id}>
                  <p>
                    {displayDate(item.date)} · {item.durationMinutes} minutes
                  </p>
                  <p className="preserve-lines">{item.notes}</p>
                </div>
              ))}
          {record.kind === 'FOOD' &&
            data.nutritionLogs
              .filter((item) => `food-${item.id}` === record.id)
              .map((item) => (
                <div key={item.id}>
                  <p>
                    {item.calories} kcal · P {item.proteinGrams}g · C {item.carbsGrams}g · F{' '}
                    {item.fatsGrams}g
                  </p>
                  <p>{item.waterLitres} L water</p>
                  <p>{item.notes}</p>
                  <button
                    className="button button-outline"
                    onClick={() => {
                      setRecord(null)
                      setNutrition(item)
                    }}
                  >
                    Edit nutrition log
                  </button>
                </div>
              ))}
          {record.kind === 'REFLECTION' &&
            data.checkIns
              .filter((item) => `reflection-${item.id}` === record.id)
              .map((item) => (
                <div key={item.id}>
                  <p>
                    Week of {displayDate(item.weekOf)} · Energy {item.energy}/5 · Sleep{' '}
                    {item.sleepHours}h
                  </p>
                  <p className="preserve-lines">{item.notes}</p>
                  <div className="coach-feedback">
                    <span className="eyebrow">
                      {item.reviewedAt ? 'Reviewed by your coach' : 'Awaiting coach review'}
                    </span>
                    {item.coachNote && <p>{item.coachNote}</p>}
                  </div>
                </div>
              ))}
        </WorkspaceModal>
      )}
      {nutrition && (
        <NutritionForm
          initial={nutrition === 'new' ? undefined : nutrition}
          today={data.today}
          onClose={() => setNutrition(null)}
          onSaved={() => saved('Nutrition log saved.')}
        />
      )}
    </Workspace>
  )
}

export function Metric({
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
