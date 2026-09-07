import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Dumbbell,
  Utensils,
  MessagesSquare,
  Leaf,
  Phone,
  MessageSquare,
  Mail,
  LogOut,
} from 'lucide-react'
import { Brand } from '../components/brand'
import { authClient } from '../lib/auth-client'
import { getIntake, saveIntake } from '../lib/intake'
import {
  serviceOptions,
  tierOptions,
  channelOptions,
  needsPhone,
  intakeSchema,
  type CoachingService,
  type CoachingTier,
  type ContactChannel,
} from '../lib/intake-validation'

const serviceIcons = {
  FITNESS: Dumbbell,
  NUTRITION: Utensils,
  ACCOUNTABILITY: MessagesSquare,
  LIFESTYLE: Leaf,
}
const contactIcons = { VOICE_CALL: Phone, TEXT_MESSAGE: MessageSquare, EMAIL: Mail }
const steps = ['Your interests', 'Your support', 'Stay in touch']

export const Route = createFileRoute('/onboarding')({
  head: () => ({
    meta: [
      { title: 'Your coaching preferences — Steve Rossiter Coaching' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  headers: () => ({ 'Cache-Control': 'private, no-store' }),
  loader: () => getIntake(),
  component: () => {
    const data = Route.useLoaderData()
    return <Questionnaire key={data.user.id} data={data} />
  },
})

function Questionnaire({ data }: { data: Awaited<ReturnType<typeof getIntake>> }) {
  const navigate = useNavigate()
  const router = useRouter()
  const heading = useRef<HTMLHeadingElement>(null)
  const [step, setStep] = useState(0)
  const [interests, setInterests] = useState<
    { service: CoachingService; tier: CoachingTier | null }[]
  >(data.intake?.interests.map(({ service, tier }) => ({ service, tier })) || [])
  const [channels, setChannels] = useState<ContactChannel[]>(data.intake?.channels || [])
  const [phone, setPhone] = useState(data.intake?.phone || '')
  const [goals, setGoals] = useState(data.intake?.goals || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    if (step) heading.current?.scrollIntoView({ block: 'start' })
  }, [step])
  const move = (next: number) => {
    setError('')
    setStep(next)
  }
  const toggleService = (service: CoachingService) => {
    setError('')
    setInterests((current) =>
      current.some((item) => item.service === service)
        ? current.filter((item) => item.service !== service)
        : [...current, { service, tier: null }],
    )
  }
  const toggleChannel = (channel: ContactChannel) => {
    const next = channels.includes(channel)
      ? channels.filter((c) => c !== channel)
      : [...channels, channel]
    setChannels(next)
    if (!needsPhone(next)) setPhone('')
    setError('')
  }

  return (
    <div className="intake-page">
      <header className="intake-header">
        <Brand />
        <button
          className="text-link"
          disabled={busy}
          onClick={async () => {
            setError('')
            setBusy(true)
            try {
              const result = await authClient.signOut()
              if (result.error) throw new Error()
              await navigate({ to: '/login' })
            } catch {
              setError('Could not sign out. Please try again.')
              setBusy(false)
            }
          }}
        >
          <LogOut size={15} /> Sign out
        </button>
      </header>
      <main id="main" className="intake-layout">
        <aside className="intake-aside">
          <span className="eyebrow">Personal from the start</span>
          <h1>
            Your goals.
            <br />
            Your life.
            <br />
            <span>Your coaching.</span>
          </h1>
          <p>
            Tell Steve what you’d like support with. We’ll use your choices to start a conversation
            about a plan that fits.
          </p>
          <div className="intake-selection-summary" aria-live="polite">
            <span className="eyebrow">Your choices so far</span>
            {interests.length ? (
              <ul>
                {serviceOptions
                  .filter((option) => interests.some((item) => item.service === option.id))
                  .map((option) => {
                    const selected = interests.find((item) => item.service === option.id)!
                    return (
                      <li key={option.id}>
                        <Check size={14} />
                        <span>
                          {option.label}
                          <small>
                            {tierOptions.find((tier) => tier.id === selected.tier)?.label ||
                              'Choose your support next'}
                          </small>
                        </span>
                      </li>
                    )
                  })}
              </ul>
            ) : (
              <p>Choose the services that feel right for you.</p>
            )}
          </div>
          <p className="intake-small">
            These are preferences, not a purchase. Steve will confirm availability, pricing, and the
            details with you.
          </p>
        </aside>
        <section className="intake-content">
          <ol className="intake-progress" aria-label="Questionnaire progress">
            {steps.map((title, index) => (
              <li
                key={title}
                aria-current={step === index ? 'step' : undefined}
                className={step >= index ? 'is-current' : ''}
              >
                <span>{step > index ? <Check size={13} /> : index + 1}</span>
                {title}
              </li>
            ))}
          </ol>
          <span className="eyebrow intake-step-label">
            Step {step + 1} of 3 ·{' '}
            {data.intake ? 'Update your preferences' : `Welcome, ${data.user.name.split(' ')[0]}`}
          </span>
          <h2 ref={heading} tabIndex={-1}>
            {step === 0
              ? 'What would you like help with?'
              : step === 1
                ? 'How much support feels right?'
                : 'How would you like to stay in touch?'}
          </h2>
          <p className="intake-lead">
            {step === 0
              ? 'Choose one or more services. You can combine them in whatever way works for you.'
              : step === 1
                ? 'Choose a tier for each service. You can mix and match levels of support.'
                : 'Choose all the ways you prefer to connect, including for accountability check-ins.'}
          </p>
          <form
            onSubmit={async (event) => {
              event.preventDefault()
              setError('')
              if (step === 0) {
                if (!interests.length) {
                  setError('Choose at least one service to continue.')
                  return
                }
                move(1)
                return
              }
              if (step === 1) {
                if (interests.some((item) => !item.tier)) {
                  setError('Choose a support tier for each selected service.')
                  return
                }
                move(2)
                return
              }
              const parsed = intakeSchema.safeParse({ interests, channels, phone, goals })
              if (!parsed.success) {
                setError(parsed.error.issues[0].message)
                return
              }
              setBusy(true)
              try {
                await saveIntake({ data: parsed.data })
                await router.invalidate({ sync: true })
                await navigate({ to: '/portal' })
              } catch {
                setError(
                  'Your preferences couldn’t be saved. Your choices are still here; please try again.',
                )
                setBusy(false)
              }
            }}
          >
            <fieldset className="intake-fields" disabled={busy}>
              <legend className="sr-only">{steps[step]}</legend>
              {step === 0 && (
                <div className="intake-service-grid">
                  {serviceOptions.map((option) => {
                    const Icon = serviceIcons[option.id]
                    const selected = interests.some((item) => item.service === option.id)
                    return (
                      <label
                        key={option.id}
                        className={`intake-service ${selected ? 'is-selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          aria-label={option.label}
                          checked={selected}
                          onChange={() => toggleService(option.id)}
                        />
                        <Icon size={26} strokeWidth={1.5} />
                        <strong>{option.label}</strong>
                        <span>{option.description}</span>
                      </label>
                    )
                  })}
                </div>
              )}
              {step === 1 && (
                <div className="intake-tier-groups">
                  {serviceOptions
                    .filter((option) => interests.some((item) => item.service === option.id))
                    .map((option) => (
                      <fieldset key={option.id} className="intake-tier-group">
                        <legend>{option.label}</legend>
                        <div className="intake-tier-options">
                          {tierOptions.map((tier, index) => (
                            <label
                              key={tier.id}
                              className={`intake-tier ${interests.find((i) => i.service === option.id)?.tier === tier.id ? 'is-selected' : ''}`}
                            >
                              <input
                                type="radio"
                                name={`tier-${option.id}`}
                                aria-label={`${option.label}: ${tier.label}`}
                                checked={
                                  interests.find((i) => i.service === option.id)?.tier === tier.id
                                }
                                onChange={() => {
                                  setInterests((current) =>
                                    current.map((item) =>
                                      item.service === option.id
                                        ? { ...item, tier: tier.id }
                                        : item,
                                    ),
                                  )
                                  setError('')
                                }}
                              />
                              <span className="eyebrow">Tier {index + 1}</span>
                              <strong>{tier.label}</strong>
                              <span className="tier-subtitle">{tier.subtitle}</span>
                              <p>{tier.description}</p>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    ))}
                </div>
              )}
              {step === 2 && (
                <>
                  <div className="intake-contact-options">
                    {channelOptions.map((option) => {
                      const Icon = contactIcons[option.id]
                      return (
                        <label
                          key={option.id}
                          className={`intake-contact ${channels.includes(option.id) ? 'is-selected' : ''}`}
                        >
                          <input
                            type="checkbox"
                            aria-label={option.label}
                            checked={channels.includes(option.id)}
                            onChange={() => toggleChannel(option.id)}
                          />
                          <Icon size={20} strokeWidth={1.6} />
                          <span>
                            <strong>{option.label}</strong>
                            <small>{option.description}</small>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                  {channels.includes('EMAIL') && (
                    <p className="intake-contact-note">
                      Email check-ins will use <strong>{data.user.email}</strong>.
                    </p>
                  )}
                  {needsPhone(channels) && (
                    <label className="intake-text-field">
                      Phone number
                      <input
                        type="tel"
                        aria-label="Phone number"
                        required
                        autoComplete="tel"
                        maxLength={40}
                        placeholder="+1 555 123 4567"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                      <span className="form-note">
                        Include your country code. Steve will use this for your selected calls or
                        messages.
                      </span>
                    </label>
                  )}
                  <label className="intake-text-field">
                    Anything you’d like Steve to know? <span className="form-note">Optional</span>
                    <textarea
                      aria-label="Anything you’d like Steve to know?"
                      rows={4}
                      maxLength={2000}
                      placeholder="Your goals, your schedule, or what you’d like to change…"
                      value={goals}
                      onChange={(e) => setGoals(e.target.value)}
                    />
                  </label>
                  <p className="intake-contact-note">
                    Your choices are shared with your coach. No calls, texts, or emails are sent
                    when you submit this form.
                  </p>
                </>
              )}
            </fieldset>
            {error && (
              <p role="alert" className="form-error intake-error">
                {error}
              </p>
            )}
            <div className="intake-actions">
              {step > 0 ? (
                <button
                  type="button"
                  className="button button-outline"
                  disabled={busy}
                  onClick={() => move(step - 1)}
                >
                  <ArrowLeft size={16} /> Back
                </button>
              ) : data.intake ? (
                <Link to="/portal" className="text-link">
                  Cancel
                </Link>
              ) : (
                <span className="intake-save-note">Your choices are saved when you finish.</span>
              )}
              <button className="button" disabled={busy}>
                {busy
                  ? 'Saving your preferences…'
                  : step < 2
                    ? 'Continue'
                    : data.intake
                      ? 'Save preferences'
                      : 'Save & open my portal'}
                <ArrowRight size={17} />
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  )
}
