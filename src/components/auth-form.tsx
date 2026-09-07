import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { authClient } from '../lib/auth-client'
import { Brand } from './brand'
import { googleAuthError } from '../lib/auth-errors'

export function AuthForm({
  signup,
  googleEnabled,
  oauthError,
}: {
  signup?: boolean
  googleEnabled: boolean
  oauthError?: string
}) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(googleAuthError(oauthError))
  const [showPassword, setShowPassword] = useState(false)
  return (
    <main id="main" className="auth-page">
      <div className="auth-aside">
        <Brand />
        <div>
          <span className="eyebrow">Strength is a practice.</span>
          <h1>
            A little stronger.
            <br />A little steadier.
            <br />
            <span>Every week.</span>
          </h1>
          <p>A place for the work you put in—and the progress that follows.</p>
        </div>
        <span className="eyebrow">Steve Rossiter Coaching / Strength &amp; Nutrition</span>
      </div>
      <div className="auth-main">
        <Link to="/" className="text-link back-link">
          <ArrowLeft size={16} />
          Back to Steve Rossiter Coaching
        </Link>
        <div className="auth-form-wrap">
          <span className="eyebrow">{signup ? 'Your next chapter' : 'Your client space'}</span>
          <h2>{signup ? 'Let’s make this personal.' : 'Good to have you back.'}</h2>
          <p>
            {signup
              ? 'Create your free account, then tell Steve what kind of support you’re looking for.'
              : 'Sign in to pick up where you left off.'}
          </p>
          <button
            className="button button-outline google-button"
            disabled={busy || !googleEnabled}
            onClick={async () => {
              setBusy(true)
              setError('')
              try {
                const result = await authClient.signIn.social({
                  provider: 'google',
                  callbackURL: '/portal',
                  errorCallbackURL: '/login',
                })
                if (result.error) {
                  setError(result.error.message ?? 'Google sign-in failed.')
                  setBusy(false)
                }
              } catch {
                setError('Could not connect to Google. Please try again.')
                setBusy(false)
              }
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.22c1.89-1.74 2.99-4.31 2.99-7.36Z"
              />
              <path
                fill="#34A853"
                d="M12 22c2.7 0 4.96-.9 6.61-2.41l-3.22-2.51c-.89.6-2.03.95-3.39.95-2.6 0-4.81-1.76-5.6-4.12H3.07v2.59A10 10 0 0 0 12 22Z"
              />
              <path
                fill="#FBBC05"
                d="M6.4 13.91a6 6 0 0 1 0-3.82V7.5H3.07a10 10 0 0 0 0 9l3.33-2.59Z"
              />
              <path
                fill="#EA4335"
                d="M12 5.97c1.47 0 2.79.51 3.82 1.51l2.86-2.87A9.58 9.58 0 0 0 12 2a10 10 0 0 0-8.93 5.5l3.33 2.59C7.19 7.73 9.4 5.97 12 5.97Z"
              />
            </svg>
            Continue with Google
          </button>
          {!googleEnabled && (
            <p className="form-note google-note">
              Google sign-in is not available yet. Please use email below.
            </p>
          )}
          <div className="form-divider">
            <span>or use your email</span>
          </div>
          <form
            onSubmit={async (event) => {
              event.preventDefault()
              setBusy(true)
              setError('')
              const data = new FormData(event.currentTarget)
              const email = String(data.get('email')).trim()
              const password = String(data.get('password'))
              try {
                const result = signup
                  ? await authClient.signUp.email({
                      name: String(data.get('name')).trim(),
                      email,
                      password,
                    })
                  : await authClient.signIn.email({ email, password })
                if (result.error) {
                  setError(result.error.message || 'Please check your details and try again.')
                  setBusy(false)
                  return
                }
                await navigate({ to: '/portal' })
              } catch {
                setError('We couldn’t connect. Please try again.')
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
                  placeholder="Alex Morgan"
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
            <button className="button" disabled={busy}>
              {busy ? (
                <>
                  <LoaderCircle size={16} className="spin" />
                  Please wait…
                </>
              ) : (
                <>
                  {signup ? 'Create account' : 'Sign in'}
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
          <p className="auth-switch">
            {signup ? 'Already have an account?' : 'New to Steve Rossiter Coaching?'}{' '}
            <Link to={signup ? '/login' : '/signup'}>
              {signup ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
          <p className="form-note">Your training record is shared with your coach. <Link to="/privacy">Privacy policy</Link></p>
        </div>
        <span className="auth-copyright">
          © 2026 Steve Rossiter Coaching Strength &amp; Nutrition
        </span>
      </div>
    </main>
  )
}
