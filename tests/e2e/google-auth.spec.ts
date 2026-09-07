import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { db } from '../../scripts/db'

const base = process.env.TEST_BASE_URL || 'http://localhost:3000'
const emails: string[] = []
test.afterAll(async () => {
  await db.user.deleteMany({ where: { email: { in: emails } } })
  await db.$disconnect()
})

test('Google connection requires a session, keeps accounts separate, and uses a secure OAuth redirect', async ({
  page,
  browser,
}) => {
  await page.goto('/account')
  await expect(page).toHaveURL(/\/login/)
  const anonymousLink = await page.request.post('/api/auth/link-social', {
    headers: { Origin: base },
    data: { provider: 'google', callbackURL: '/account' },
  })
  expect(anonymousLink.status()).toBe(401)
  await page.goto('/login?error=account_not_linked')
  await expect(page.getByRole('alert')).toContainText('Sign in with your password')
  await page.goto('/login?error=%3Cscript%3Eunsafe%3C%2Fscript%3E')
  await expect(page.getByRole('alert')).toHaveText(
    'Google sign-in could not be completed. Please try again.',
  )

  const email = `rossiter-google-test-${randomUUID()}@example.com`
  emails.push(email)
  const signup = await page.request.post('/api/auth/sign-up/email', {
    headers: { Origin: base },
    data: { name: 'Google Connection Test', email, password: `Test-${randomUUID()}!` },
  })
  expect(signup.ok()).toBe(true)
  const user = await db.user.findUniqueOrThrow({ where: { email } })
  await page.goto('/account')
  await expect(page.getByRole('heading', { name: 'Sign in your way.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Connect Google' })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/google-account-mobile.png', fullPage: true })

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    // Inspect the actual Better Auth redirect, without authorizing a real Google account.
    await page.route('https://accounts.google.com/**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<p>Google authorization request captured</p>',
      }),
    )
    await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true')
    await page.getByRole('button', { name: 'Connect Google' }).click()
    await expect(page).toHaveURL(/^https:\/\/accounts\.google\.com\//)
    const oauth = new URL(page.url())
    expect(oauth.searchParams.get('redirect_uri')).toBe(`${base}/api/auth/callback/google`)
    expect(oauth.searchParams.get('scope')?.split(' ').sort()).toEqual([
      'email',
      'openid',
      'profile',
    ])
    expect(oauth.searchParams.get('code_challenge_method')).toBe('S256')
    expect(oauth.searchParams.get('state')).toBeTruthy()
    expect(oauth.searchParams.has('client_secret')).toBe(false)
    expect(await db.account.count({ where: { userId: user.id, providerId: 'google' } })).toBe(0)
  }
  // Synthetic, isolated linked-account fixture checks status display and ownership.
  await db.account.create({
    data: {
      id: randomUUID(),
      userId: user.id,
      providerId: 'google',
      accountId: `test-only-${randomUUID()}`,
    },
  })
  await page.goto('/account')
  await expect(page.getByText('Google is connected.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Connect Google' })).toHaveCount(0)

  const otherContext = await browser.newContext({ baseURL: base })
  try {
    const otherEmail = `rossiter-google-test-${randomUUID()}@example.com`
    emails.push(otherEmail)
    const otherSignup = await otherContext.request.post('/api/auth/sign-up/email', {
      headers: { Origin: base },
      data: { name: 'Other Account', email: otherEmail, password: `Test-${randomUUID()}!` },
    })
    expect(otherSignup.ok()).toBe(true)
    const otherPage = await otherContext.newPage()
    await otherPage.goto(`/account?userId=${user.id}`)
    await expect(otherPage.getByRole('button', { name: 'Connect Google' })).toBeVisible()
    await expect(otherPage.getByText('Google is connected.', { exact: false })).toHaveCount(0)
    await expect(otherPage.locator('main')).not.toContainText(email)
  } finally {
    await otherContext.close()
  }
  expect(await db.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({
    role: 'CLIENT',
    emailVerified: false,
  })
})
