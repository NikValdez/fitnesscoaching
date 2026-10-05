import { useRef, useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { ArrowRight, Check, CreditCard, Eye, EyeOff, LoaderCircle, LockKeyhole } from 'lucide-react'
import { authClient } from '../lib/auth-client'
import { CoachingPricing } from './coaching-pricing'
import {
  coachingBillingPlans,
  coachingPriceLabel,
  onlineCoachingPlan,
  type CoachingBillingCadence,
} from '../lib/coaching-offering'
import { googleAuthError } from '../lib/auth-errors'
import type { CoachingOfferingData } from '../lib/subscriptions'

const messages: Record<string, string> = {
  cancelled: 'Checkout was cancelled. You can return to payment whenever you’re ready.',
  signin: 'Create an account or sign in below to continue to payment.',
  unavailable: 'Online signup is temporarily unavailable. Please contact Steve below.',
  error:
    'We couldn’t open checkout. Please try again. If you already paid, refresh this page first.',
  busy: 'Checkout is already being opened. Wait a moment, then try again.',
  existing: 'You already have a coaching subscription. You can manage it below.',
  pending: 'Your payment is being confirmed. Refresh your subscription status in a moment.',
  'client-only':
    'Coaching subscriptions are for client accounts. Please sign in with a client account.',
  'no-subscription': 'There is no billing account to manage yet.',
  'billing-error': 'We couldn’t open billing management. Please try again in a moment.',
  'invalid-plan': 'Please choose monthly or yearly billing below.',
}

const verificationMessages = {
  confirmed: 'You’re in. Your coaching subscription is confirmed.',
  pending: 'Your payment is still being confirmed. Please check again in a moment.',
  invalid:
    'This checkout could not be verified for your account. Sign in with the account you used to pay.',
  error: 'We couldn’t refresh your subscription. Please try again in a moment.',
}

export function CoachingEnrollment({
  data,
  result,
  oauthError,
  billing = 'monthly',
  onBillingChange,
}: {
  data: CoachingOfferingData
  result?: string
  oauthError?: string
  billing?: CoachingBillingCadence
  onBillingChange?: (billing: CoachingBillingCadence) => void
}) {
  const router = useRouter()
  const checkout = useRef<HTMLFormElement>(null)
  const [signup, setSignup] = useState(true)
  const [busy, setBusy] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(googleAuthError(oauthError))
  const subscription = data.subscription
  const displayBilling = subscription?.blocksCheckout
    ? subscription.interval === 'year'
      ? 'yearly'
      : 'monthly'
    : billing
  const plan = coachingBillingPlans[displayBilling]
  const price = subscription?.blocksCheckout
    ? subscription
    : data.prices[billing] || {
        amountCents: plan.amountCents,
        currency: onlineCoachingPlan.currency,
      }
  const selectedEnabled = Boolean(data.prices[billing])
  const notice = data.verification
    ? verificationMessages[data.verification]
    : result === 'success'
      ? 'Sign in with the account you used at checkout to confirm your subscription.'
      : result
        ? messages[result]
        : undefined
  const clientOnly = data.user?.role === 'ADMIN'
  const canCheckout = selectedEnabled && !clientOnly && !subscription?.blocksCheckout
  const needsPayment =
    subscription && ['past_due', 'unpaid', 'incomplete'].includes(subscription.status)

  return (
    <section
      className="online-coaching"
      id="online-coaching"
      aria-labelledby="online-coaching-title"
    >
      <div className="container online-coaching-grid">
        <div className="online-coaching-copy">
          <span className="eyebrow">Work with me / Wherever you are</span>
          <h2 id="online-coaching-title">
            Your goals.
            <br />A plan. <em>A partner.</em>
          </h2>
          <p>
            Personal coaching that fits your life. Build strength, find a rhythm with your
            nutrition, and keep moving forward with Steve in your corner.
          </p>
          <ul className="online-coaching-features">
            {onlineCoachingPlan.features.map((feature) => (
              <li key={feature}>
                <Check size={18} aria-hidden="true" />
                {feature}
              </li>
            ))}
          </ul>
          <div className="online-coaching-steps" aria-label="How to get started">
            <span>
              <b>01</b> Create your account
            </span>
            <span>
              <b>02</b> Subscribe online
            </span>
            <span>
              <b>03</b> Tell Steve your goals
            </span>
          </div>
          <a className="text-link" href="#work-title">
            Prefer to talk first? Get in touch <ArrowRight size={16} />
          </a>
        </div>
        <div className="coaching-enrollment">
          <CoachingPricing
            billing={displayBilling}
            price={price}
            onBillingChange={onBillingChange}
            showBillingOptions={!subscription?.blocksCheckout}
            disabled={busy || submitting}
            manageOnline
          />
          {data.testMode && selectedEnabled && (
            <p className="coaching-notice">Test checkout · No real payments</p>
          )}
          {notice && (
            <p
              className="coaching-notice"
              role={
                data.verification === 'invalid' || data.verification === 'error'
                  ? 'alert'
                  : 'status'
              }
            >
              {notice}
            </p>
          )}
          {subscription?.blocksCheckout ? (
            <div className="coaching-membership">
              <span className={`coaching-status ${subscription.hasAccess ? 'is-active' : ''}`}>
                {subscription.hasAccess ? (
                  <Check size={16} aria-hidden="true" />
                ) : (
                  <CreditCard size={16} aria-hidden="true" />
                )}
                {subscription.hasAccess
                  ? subscription.cancelAtPeriodEnd
                    ? 'Cancellation scheduled'
                    : 'Coaching active'
                  : needsPayment
                    ? 'Payment needs attention'
                    : 'Subscription paused'}
              </span>
              <p>
                {coachingPriceLabel(subscription.amountCents, subscription.currency)}
                {subscription.intervalCount === 1
                  ? ` / ${subscription.interval}`
                  : ` every ${subscription.intervalCount} ${subscription.interval}s`}
                {' · '}
                {subscription.cancelAtPeriodEnd
                  ? 'Ends'
                  : subscription.hasAccess
                    ? 'Renews'
                    : 'Billing period ends'}{' '}
                {new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  timeZone: 'UTC',
                })}
              </p>
              {needsPayment && (
                <p>Update your payment method in billing management to continue coaching.</p>
              )}
              {subscription.hasAccess && (
                <Link to="/portal" className="button">
                  Continue to your client space <ArrowRight size={17} />
                </Link>
              )}
            </div>
          ) : (
            <>
              {subscription?.status === 'canceled' && (
                <p className="coaching-notice">
                  Your previous subscription has ended. You can start again below.
                </p>
              )}
              {!selectedEnabled && (
                <p className="coaching-notice" role="status">
                  {plan.label} signup is opening soon. Contact Steve below to get started.
                </p>
              )}
              {data.user ? (
                <div className="coaching-signed-in">
                  <Check size={18} aria-hidden="true" />
                  <div>
                    <strong>{data.user.name}</strong>
                    <span>{data.user.email}</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="coaching-auth-tabs" aria-label="Choose how to continue">
                    <button
                      type="button"
                      aria-pressed={signup}
                      onClick={() => {
                        setSignup(true)
                        setError('')
                      }}
                      disabled={busy}
                    >
                      Create account
                    </button>
                    <button
                      type="button"
                      aria-pressed={!signup}
                      onClick={() => {
                        setSignup(false)
                        setError('')
                      }}
                      disabled={busy}
                    >
                      Sign in
                    </button>
                  </div>
                  {data.googleEnabled && (
                    <>
                      <button
                        type="button"
                        className="button button-outline coaching-google"
                        disabled={busy || !selectedEnabled}
                        onClick={async () => {
                          setBusy(true)
                          setError('')
                          try {
                            const response = await authClient.signIn.social({
                              provider: 'google',
                              callbackURL: `/work-with-me?coaching=continue&billing=${billing}#online-coaching`,
                              errorCallbackURL: `/work-with-me?billing=${billing}#online-coaching`,
                            })
                            if (response.error)
                              throw new Error(
                                response.error.message || 'Could not sign in with Google.',
                              )
                          } catch (cause) {
                            setError(
                              cause instanceof Error
                                ? cause.message
                                : 'Could not sign in with Google. Please try again.',
                            )
                            setBusy(false)
                          }
                        }}
                      >
                        Continue with Google <ArrowRight size={16} />
                      </button>
                      <div className="form-divider">
                        <span>or use your email</span>
                      </div>
                    </>
                  )}
                  <form
                    className="coaching-signup-form"
                    onSubmit={async (event) => {
                      event.preventDefault()
                      if (busy || !canCheckout) return
                      setBusy(true)
                      setError('')
                      const fields = new FormData(event.currentTarget)
                      const email = String(fields.get('email')).trim()
                      const password = String(fields.get('password'))
                      try {
                        const response = signup
                          ? await authClient.signUp.email({
                              name: String(fields.get('name')).trim(),
                              email,
                              password,
                            })
                          : await authClient.signIn.email({ email, password })
                        if (response.error)
                          throw new Error(
                            response.error.message || 'Please check your details and try again.',
                          )
                        // A normal POST carries the new session cookie and checks the
                        // live role, plan and subscription on the server again.
                        checkout.current?.requestSubmit()
                      } catch (cause) {
                        setError(
                          cause instanceof Error
                            ? cause.message
                            : 'Could not connect. Please try again.',
                        )
                        setBusy(false)
                      }
                    }}
                  >
                    {signup && (
                      <label>
                        Your name
                        <input
                          name="name"
                          autoComplete="name"
                          required
                          minLength={2}
                          maxLength={100}
                          placeholder="Your full name"
                          disabled={busy || !selectedEnabled}
                        />
                      </label>
                    )}
                    <label>
                      Email address
                      <input
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        maxLength={254}
                        placeholder="you@email.com"
                        disabled={busy || !selectedEnabled}
                      />
                    </label>
                    <label>
                      Password
                      <div className="password-field">
                        <input
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete={signup ? 'new-password' : 'current-password'}
                          required
                          minLength={signup ? 10 : 1}
                          maxLength={128}
                          placeholder={signup ? 'At least 10 characters' : 'Your password'}
                          disabled={busy || !selectedEnabled}
                        />
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </label>
                    {error && (
                      <p className="form-error" role="alert">
                        {error}
                      </p>
                    )}
                    <button className="button" disabled={busy || !canCheckout}>
                      {busy ? (
                        <>
                          <LoaderCircle size={16} className="spin" /> Opening checkout…
                        </>
                      ) : (
                        <>
                          {signup ? 'Create account & continue' : 'Sign in & continue'}{' '}
                          <ArrowRight size={17} />
                        </>
                      )}
                    </button>
                  </form>
                </>
              )}
              {clientOnly && (
                <p className="coaching-notice">
                  You’re signed in as a coach. Use a client account to subscribe.
                </p>
              )}
            </>
          )}
          <form
            ref={checkout}
            action="/api/coaching/checkout"
            method="post"
            onSubmit={() => setSubmitting(true)}
          >
            <input type="hidden" name="billing" value={billing} />
            {data.user && !subscription?.blocksCheckout && (
              <button className="button" disabled={!canCheckout || submitting}>
                {submitting ? (
                  <>
                    <LoaderCircle size={16} className="spin" /> Opening checkout…
                  </>
                ) : (
                  <>
                    Subscribe & start coaching <ArrowRight size={17} />
                  </>
                )}
              </button>
            )}
          </form>
          {data.canManageBilling && (
            <form action="/api/coaching/portal" method="post" onSubmit={() => setSubmitting(true)}>
              <button className="button button-outline" disabled={submitting}>
                Manage billing & subscription <CreditCard size={17} />
              </button>
            </form>
          )}
          {data.user && (data.subscription || data.verification || result === 'pending') && (
            <button
              type="button"
              className="text-link coaching-refresh"
              disabled={refreshing}
              onClick={async () => {
                setRefreshing(true)
                setError('')
                try {
                  await router.invalidate()
                } catch {
                  setError('Could not refresh. Please try again.')
                } finally {
                  setRefreshing(false)
                }
              }}
            >
              {refreshing ? <LoaderCircle size={14} className="spin" /> : null}Refresh subscription
              status
            </button>
          )}
          {data.user && error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <p className="coaching-secure-note">
            <LockKeyhole size={13} aria-hidden="true" /> Secure payment through Stripe
          </p>
          <p className="form-note coaching-privacy">
            By continuing, you agree to {displayBilling === 'yearly' ? 'annual' : 'monthly'} billing
            until cancellation. <Link to="/privacy">Privacy policy</Link> ·{' '}
            <Link to="/disclaimer">Coaching disclaimer</Link>
          </p>
        </div>
      </div>
    </section>
  )
}
