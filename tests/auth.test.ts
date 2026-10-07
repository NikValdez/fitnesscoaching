import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.mock('../src/lib/db.server', () => ({ db: {} }))
vi.mock('better-auth/adapters/prisma', async () => {
  const { memoryAdapter } = await import('better-auth/adapters/memory')
  return {
    prismaAdapter: () => memoryAdapter({ user: [], session: [], account: [], verification: [] }),
  }
})

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('BETTER_AUTH_URL', 'https://steve-rossiter-coaching.nikcochran.workers.dev')
  vi.stubEnv('BETTER_AUTH_SECRET', 'test-only-auth-secret-at-least-32-characters')
  vi.stubEnv('GOOGLE_CLIENT_ID', 'test-only.apps.googleusercontent.com')
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-only-google-secret')
})

afterEach(() => vi.unstubAllEnvs())

let requestNumber = 0
async function startGoogle(
  origin: string,
  headers: Record<string, string> = {},
  callbackURL = '/admin/content',
) {
  const { getAuth } = await import('../src/lib/auth.server')
  const auth = getAuth()
  // Better Auth skips this guard in test mode; restore its production default.
  const context = await auth.$context
  context.skipOriginCheck = false
  return auth.handler(
    new Request(`${origin}/api/auth/sign-in/social`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
        'cf-connecting-ip': `192.0.2.${++requestNumber}`,
        ...headers,
      },
      body: JSON.stringify({
        provider: 'google',
        callbackURL,
        errorCallbackURL: '/admin/login',
        disableRedirect: true,
      }),
    }),
  )
}

it('keeps Google callbacks and secure OAuth cookies on each production host using the shared auth instance', async () => {
  for (const origin of [
    'https://steverossiter.com',
    'https://www.steverossiter.com',
    'https://steve-rossiter-coaching.nikcochran.workers.dev',
  ]) {
    // Existing cookies make Better Auth validate the request's origin too.
    const response = await startGoogle(origin, { Cookie: 'existing-cookie=1' })
    expect(response.status).toBe(200)
    const oauth = new URL(((await response.json()) as { url: string }).url)
    expect(oauth.searchParams.get('redirect_uri')).toBe(`${origin}/api/auth/callback/google`)
    expect(oauth.searchParams.get('code_challenge_method')).toBe('S256')
    expect(oauth.searchParams.get('state')).toBeTruthy()
    expect(oauth.searchParams.has('client_secret')).toBe(false)
    const cookie = response.headers.get('set-cookie')!
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).not.toMatch(/Domain=/i)

    const { getAuth } = await import('../src/lib/auth.server')
    const callback = new URL(`${origin}/api/auth/callback/google`)
    callback.searchParams.set('state', oauth.searchParams.get('state')!)
    callback.searchParams.set('error', 'access_denied')
    const result = await getAuth().handler(
      new Request(callback, {
        headers: {
          Cookie: response.headers
            .getSetCookie()
            .map((value) => value.split(';')[0])
            .join('; '),
        },
      }),
    )
    expect(result.status).toBe(302)
    const destination = new URL(result.headers.get('location')!, origin)
    expect(destination.origin).toBe(origin)
    expect(destination.pathname).toBe('/admin/login')
    expect(destination.searchParams.get('error')).toBe('access_denied')
  }
})

it('does not trust unrelated origins or redirect destinations', async () => {
  const badOrigin = await startGoogle('https://steverossiter.com', {
    Origin: 'https://untrusted.example',
    Cookie: 'existing-cookie=1',
  })
  expect(badOrigin.status).toBe(403)
  const badRedirect = await startGoogle(
    'https://steverossiter.com',
    {},
    'https://untrusted.example/admin/content',
  )
  expect(badRedirect.status).toBe(403)
  await expect(startGoogle('https://untrusted.example')).rejects.toThrow(
    'not in the allowed hosts list',
  )
})

it('ignores an untrusted forwarded host and preserves local development callbacks', async () => {
  const response = await startGoogle('https://steverossiter.com', {
    'X-Forwarded-Host': 'untrusted.example',
  })
  expect(response.status).toBe(200)
  expect(
    new URL(((await response.json()) as { url: string }).url).searchParams.get('redirect_uri'),
  ).toBe('https://steverossiter.com/api/auth/callback/google')

  vi.resetModules()
  vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3000')
  const local = await startGoogle('http://localhost:3000')
  expect(local.status).toBe(200)
  expect(
    new URL(((await local.json()) as { url: string }).url).searchParams.get('redirect_uri'),
  ).toBe('http://localhost:3000/api/auth/callback/google')
})
