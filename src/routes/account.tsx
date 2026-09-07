import { createFileRoute, Link, type SearchSchemaInput } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowLeft, Check, LoaderCircle } from 'lucide-react'
import { Brand } from '../components/brand'
import { authClient } from '../lib/auth-client'
import { getAccountSettings } from '../lib/account'
import { googleAuthError } from '../lib/auth-errors'

export const Route = createFileRoute('/account')({
  head: () => ({
    meta: [
      { title: 'Your account — Steve Rossiter Coaching' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  headers: () => ({ 'Cache-Control': 'private, no-store' }),
  validateSearch: (search: { error?: unknown } & SearchSchemaInput) => ({
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  loader: () => getAccountSettings(),
  staleTime: 0,
  component: AccountSettings,
})

function AccountSettings() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <>
      <header className="intake-header">
        <Brand />
        <Link to="/portal" className="text-link">
          <ArrowLeft size={16} /> Back to portal
        </Link>
      </header>
      <main id="main" className="account-settings">
        <span className="eyebrow">Your account</span>
        <h1>Sign in your way.</h1>
        <p>
          {data.name} · {data.email}
        </p>
        <section className="workspace-panel">
          <h2>Google sign-in</h2>
          {data.googleConnected ? (
            <p className="account-connected">
              <Check size={18} /> Google is connected. You can use it to sign in to this account.
            </p>
          ) : (
            <>
              <p>
                Connect Google to sign in with a single click. Choose the Google account for{' '}
                <strong>{data.email}</strong>. Your coaching history and existing password stay with
                this account.
              </p>
              <button
                className="button button-primary"
                disabled={busy || !data.googleEnabled}
                onClick={async () => {
                  setBusy(true)
                  setError('')
                  try {
                    const result = await authClient.linkSocial({
                      provider: 'google',
                      callbackURL: '/account',
                      errorCallbackURL: '/account',
                    })
                    if (result.error) throw new Error('Could not connect Google. Please try again.')
                  } catch {
                    setError('Could not connect Google. Please try again.')
                    setBusy(false)
                  }
                }}
              >
                {busy && <LoaderCircle size={16} className="spin" />}
                {busy ? 'Opening Google…' : 'Connect Google'}
              </button>
              {!data.googleEnabled && <p>Google sign-in is currently unavailable.</p>}
            </>
          )}
          {(error || search.error) && (
            <p className="form-error" role="alert">
              {error || googleAuthError(search.error)}
            </p>
          )}
        </section>
      </main>
    </>
  )
}
