import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowUpRight,
  LogOut,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Dumbbell,
  Utensils,
  ClipboardCheck,
  LayoutDashboard,
  Users,
  ListChecks,
  Settings,
} from 'lucide-react'
import { Brand, BrandMark } from './brand'
import { authClient } from '../lib/auth-client'

export const kindLabels: Record<string, string> = {
  WORKOUT: 'Workout',
  CHECK_IN: 'Check-in',
  NUTRITION: 'Nutrition',
  COACH_TASK: 'Coach task',
  FITNESS: 'Fitness plan',
  LOG: 'Training logged',
  FOOD: 'Nutrition logged',
  REFLECTION: 'Check-in submitted',
}
export const tabIcons: Record<string, typeof CalendarDays> = {
  overview: LayoutDashboard,
  calendar: CalendarDays,
  workouts: Dumbbell,
  nutrition: Utensils,
  clients: Users,
  programs: Dumbbell,
  checkins: ClipboardCheck,
  tracking: ListChecks,
}

export function Workspace({
  coach = false,
  name,
  tab,
  tabs,
  onTab,
  children,
}: {
  coach?: boolean
  name: string
  tab: string
  tabs: { id: string; label: string }[]
  onTab: (value: string) => void
  children: ReactNode
}) {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  return (
    <div className="workspace">
      <header className="workspace-header">
        <Brand />
        <span className={`workspace-role ${coach ? 'is-coach' : ''}`}>
          {coach ? 'Coach workspace' : 'Client portal'}
        </span>
        <div className="workspace-header-right">
          <Link to="/" className="text-link">
            Website <ArrowUpRight size={14} />
          </Link>
          <span className="workspace-avatar" title={name}>
            {name
              .split(' ')
              .map((word) => word[0])
              .slice(0, 2)
              .join('')}
          </span>
          <button
            className="icon-button"
            aria-label="Sign out"
            onClick={async () => {
              try {
                const result = await authClient.signOut()
                if (result.error) throw new Error()
                await navigate({ to: '/login' })
              } catch {
                setError('Could not sign out. Please try again.')
              }
            }}
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>
      <div className="workspace-layout">
        <aside className="workspace-sidebar">
          <span className="eyebrow">{coach ? 'Your practice' : 'Your next chapter'}</span>
          <nav aria-label={coach ? 'Coach navigation' : 'Client navigation'}>
            {tabs.map((item) => {
              const Icon = tabIcons[item.id] || ListChecks
              return (
                <button
                  key={item.id}
                  className={tab === item.id ? 'active' : ''}
                  aria-current={tab === item.id ? 'page' : undefined}
                  onClick={() => onTab(item.id)}
                >
                  <Icon size={18} strokeWidth={1.6} />
                  {item.label}
                </button>
              )
            })}
            {!coach && (
              <Link to="/dashboard">
                <ListChecks size={18} strokeWidth={1.6} />
                Training &amp; check-ins
              </Link>
            )}
            <Link to="/account">
              <Settings size={18} strokeWidth={1.6} />
              Account
            </Link>
          </nav>
          <div className="workspace-sidebar-foot">
            <BrandMark />
            <p>
              Small steps.
              <br />
              Lasting progress.
            </p>
            <span className="eyebrow">Steve Rossiter Coaching</span>
          </div>
        </aside>
        <main id="main" className="workspace-main">
          {error && <Notice message={error} onClose={() => setError('')} error />}
          {children}
        </main>
      </div>
    </div>
  )
}

export function Notice({
  message,
  onClose,
  error = false,
}: {
  message: string
  onClose: () => void
  error?: boolean
}) {
  return (
    <div className={error ? 'notice notice-error' : 'notice'} role={error ? 'alert' : 'status'}>
      {!error && <Check size={16} />}
      {message}
      <button className="icon-button" aria-label="Dismiss notification" onClick={onClose}>
        <X size={15} />
      </button>
    </div>
  )
}

export function WorkspaceModal({
  title,
  label,
  onClose,
  busy,
  children,
}: {
  title: string
  label: string
  onClose: () => void
  busy?: boolean
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = ref.current
    const previous = document.activeElement as HTMLElement | null
    element?.showModal()
    return () => {
      element?.close()
      previous?.focus({ preventScroll: true })
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className="modal workspace-modal"
      aria-labelledby="workspace-dialog-title"
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onClose()
      }}
    >
      <button
        className="icon-button modal-close"
        disabled={busy}
        aria-label="Close dialog"
        onClick={onClose}
      >
        <X size={20} />
      </button>
      <span className="eyebrow">{label}</span>
      <h2 id="workspace-dialog-title">{title}</h2>
      {children}
    </dialog>
  )
}

export function Empty({
  title,
  text,
  children,
}: {
  title: string
  text: string
  children?: ReactNode
}) {
  return (
    <div className="workspace-empty">
      <span className="empty-icon">
        <CalendarDays size={24} strokeWidth={1.4} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  )
}
export function displayDate(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
export function monthTitle(month: string) {
  return new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
export function shiftMonth(month: string, delta: number) {
  const date = new Date(`${month}-01T12:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + delta)
  return date.toISOString().slice(0, 7)
}
export type CalendarEntry = {
  id: string
  title: string
  kind: string
  date: string
  time?: string | null
  completedAt?: Date | null
  clientName?: string
  readOnly?: boolean
}

export function Calendar({
  month,
  today,
  entries,
  onMonth,
  onEntry,
}: {
  month: string
  today: string
  entries: CalendarEntry[]
  onMonth: (value: string) => void
  onEntry: (entry: CalendarEntry) => void
}) {
  const [selected, setSelected] = useState(today.startsWith(month) ? today : `${month}-01`)
  useEffect(() => setSelected(today.startsWith(month) ? today : `${month}-01`), [month, today])
  const first = new Date(`${month}-01T12:00:00Z`)
  const start = new Date(first)
  start.setUTCDate(1 - ((first.getUTCDay() + 6) % 7))
  const dates = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    return date.toISOString().slice(0, 10)
  })
  const daily = entries
    .filter((item) => item.date === selected)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  return (
    <div className="workspace-calendar">
      <section className="calendar-board">
        <div className="calendar-toolbar">
          <h2>{monthTitle(month)}</h2>
          <div>
            <button
              className="text-link"
              onClick={() => {
                onMonth(today.slice(0, 7))
                setSelected(today)
              }}
            >
              Today
            </button>
            <button
              className="icon-button"
              aria-label="Previous month"
              onClick={() => onMonth(shiftMonth(month, -1))}
            >
              <ChevronLeft size={19} />
            </button>
            <button
              className="icon-button"
              aria-label="Next month"
              onClick={() => onMonth(shiftMonth(month, 1))}
            >
              <ChevronRight size={19} />
            </button>
          </div>
        </div>
        <div className="calendar-weekdays">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {dates.map((date) => {
            const items = entries.filter((item) => item.date === date)
            return (
              <button
                key={date}
                disabled={!date.startsWith(month)}
                className={`calendar-day ${date === selected ? 'selected' : ''} ${date === today ? 'today' : ''} ${!date.startsWith(month) ? 'outside' : ''}`}
                aria-label={`${displayDate(date)}, ${items.length} items`}
                aria-pressed={date === selected}
                onClick={() => setSelected(date)}
              >
                <span className="calendar-day-number">{Number(date.slice(-2))}</span>
                <div className="calendar-day-items">
                  {items.slice(0, 2).map((item) => (
                    <span
                      key={item.id}
                      className={`calendar-chip kind-${item.kind.toLowerCase()} ${item.completedAt ? 'is-done' : ''}`}
                    >
                      <i />
                      {item.clientName ? `${item.clientName.split(' ')[0]} · ` : ''}
                      {item.title}
                    </span>
                  ))}
                  {items.length > 2 && (
                    <span className="calendar-more">+{items.length - 2} more</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
        <div className="calendar-legend">
          <span>
            <i className="legend-workout" />
            Training
          </span>
          <span>
            <i className="legend-nutrition" />
            Nutrition
          </span>
          <span>
            <i className="legend-checkin" />
            Check-ins
          </span>
          <span className="calendar-zone">Los Angeles time</span>
        </div>
      </section>
      <aside className="calendar-agenda">
        <span className="eyebrow">Selected day</span>
        <h3>{displayDate(selected)}</h3>
        <span className="form-note">
          {daily.length} {daily.length === 1 ? 'item' : 'items'} on your calendar
        </span>
        {daily.length ? (
          <div className="agenda-list">
            {daily.map((item) => (
              <button
                key={item.id}
                onClick={() => onEntry(item)}
                className={`agenda-item kind-${item.kind.toLowerCase()}`}
              >
                <span className="agenda-time">
                  {item.time || 'Any time'}
                  {item.completedAt && <Check size={14} />}
                </span>
                <strong>{item.title}</strong>
                {item.clientName && <span>{item.clientName}</span>}
                <span className="eyebrow">
                  {kindLabels[item.kind] || item.kind}
                  {item.completedAt ? ' · Done' : ''}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="agenda-empty">
            Room to recover.
            <br />
            Nothing scheduled for this day.
          </p>
        )}
      </aside>
    </div>
  )
}
