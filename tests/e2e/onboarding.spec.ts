import { waitForHydration } from './hydration'
import { test, expect, type BrowserContext, type Request } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { db } from '../../scripts/db'

const base = process.env.TEST_BASE_URL || 'http://localhost:3000'
const emails: string[] = []
const contexts: BrowserContext[] = []
test.afterAll(async () => {
  await Promise.all(contexts.map((c) => c.close()))
  await db.user.deleteMany({ where: { email: { in: emails } } })
  await db.$disconnect()
})
async function register(context: BrowserContext, name: string) {
  const email = `rossiter-intake-test-${randomUUID()}@example.com`
  emails.push(email)
  const options = {
    data: { name, email, password: `Test-${randomUUID()}!` },
    headers: { Origin: base },
  }
  let response = await context.request.post(`${base}/api/auth/sign-up/email`, options)
  for (let attempt = 0; response.status() === 429 && attempt < 3; attempt++) {
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        Math.min(60, Math.max(10, Number(response.headers()['retry-after']) || 10)) * 1000,
      ),
    )
    response = await context.request.post(`${base}/api/auth/sign-up/email`, options)
  }
  expect(response.ok()).toBe(true)
  return db.user.findUniqueOrThrow({ where: { email } })
}
async function replay(context: BrowserContext, request: Request) {
  return context.request.post(request.url(), {
    data: request.postData(),
    headers: {
      'content-type': request.headers()['content-type'] || 'application/json',
      'x-tsr': request.headers()['x-tsr'] || 'serverFn',
      Origin: base,
    },
  })
}

test('service questionnaire, mixed tiers, contact preferences, editing, and coach visibility', async ({
  browser,
}) => {
  test.setTimeout(180_000)
  const clientContext = await browser.newContext({
    baseURL: base,
    viewport: { width: 1440, height: 1000 },
  })
  const otherContext = await browser.newContext({ baseURL: base })
  const anonymous = await browser.newContext({ baseURL: base })
  contexts.push(clientContext, otherContext, anonymous)
  const user = await register(clientContext, 'Jamie Questionnaire')
  const other = await register(otherContext, 'Private Other Client')
  const page = await clientContext.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/dashboard')
  await waitForHydration(page)
  await expect(page).toHaveURL(/\/onboarding/)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Choose at least one service')
  for (const name of ['Fitness coaching', 'Nutrition', 'Accountability', 'Lifestyle'])
    await page.getByRole('checkbox', { name, exact: true }).check()
  await page.screenshot({ path: 'test-results/intake-services-desktop.png', fullPage: true })
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Choose a support tier')
  for (const name of [
    'Fitness coaching: In person',
    'Nutrition: Essential',
    'Accountability: Ongoing support',
    'Lifestyle: Essential',
  ])
    await page.getByRole('radio', { name, exact: true }).check()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: 'Accountability', exact: true })).toBeChecked()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(
    page.getByRole('radio', { name: 'Fitness coaching: In person', exact: true }),
  ).toBeChecked()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'test-results/intake-tiers-mobile.png', fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Save & open my portal', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Choose at least one way')
  for (const name of ['Voice call', 'Text message', 'Email'])
    await page.getByRole('checkbox', { name, exact: true }).check()
  await page.getByRole('textbox', { name: 'Phone number', exact: true }).fill('5551234567')
  await page.getByRole('button', { name: 'Save & open my portal', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('country code')
  await page.getByRole('textbox', { name: 'Phone number', exact: true }).fill('+1 (555) 123-4567')
  await page
    .getByRole('textbox', { name: 'Anything you’d like Steve to know?' })
    .fill('Build consistent habits around a changing work schedule.')
  await page.screenshot({ path: 'test-results/intake-contact-mobile.png', fullPage: true })
  const saveRequest = page.waitForRequest(
    (r) => r.method() === 'POST' && r.url().includes('/_serverFn/'),
  )
  await page.getByRole('button', { name: 'Save & open my portal', exact: true }).click()
  const captured = await saveRequest
  await expect(page).toHaveURL(/\/portal/)
  await page.reload()
  await waitForHydration(page)
  await expect(page.getByRole('heading', { name: 'Your coaching preferences' })).toBeVisible()
  await expect(
    page.getByText('Build consistent habits around a changing work schedule.', { exact: true }),
  ).toBeVisible()
  const saved = await db.clientIntake.findUniqueOrThrow({
    where: { userId: user.id },
    include: { interests: true },
  })
  expect(saved.phone).toBe('+15551234567')
  expect(saved.interests).toHaveLength(4)
  expect(saved.channels).toEqual(['VOICE_CALL', 'TEXT_MESSAGE', 'EMAIL'])
  await replay(anonymous, captured)
  expect(await db.clientIntake.count({ where: { userId: user.id } })).toBe(1)
  const otherPage = await otherContext.newPage()
  await otherPage.goto(`/onboarding?userId=${user.id}`)
  await waitForHydration(otherPage)
  await expect(
    otherPage.getByRole('checkbox', { name: 'Fitness coaching', exact: true }),
  ).not.toBeChecked()
  await expect(
    otherPage.getByText('Build consistent habits around a changing work schedule.'),
  ).toHaveCount(0)

  await page.getByRole('link', { name: 'Edit preferences', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Lifestyle', exact: true }).uncheck()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('radio', { name: 'Lifestyle: Essential', exact: true })).toHaveCount(
    0,
  )
  await page.getByRole('radio', { name: 'Fitness coaching: Ongoing support', exact: true }).check()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Voice call', exact: true }).uncheck()
  await page.getByRole('checkbox', { name: 'Text message', exact: true }).uncheck()
  await expect(page.getByRole('textbox', { name: 'Phone number', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click()
  await expect(page).toHaveURL(/\/portal/)
  const updated = await db.clientIntake.findUniqueOrThrow({
    where: { userId: user.id },
    include: { interests: true },
  })
  expect(updated.interests).toHaveLength(3)
  expect(updated.phone).toBeNull()
  expect(updated.channels).toEqual(['EMAIL'])
  expect(updated.interests.find((i) => i.service === 'FITNESS')?.tier).toBe('ONGOING')

  await db.user.update({ where: { id: other.id }, data: { role: 'ADMIN' } })
  await otherPage.goto('/onboarding')
  await waitForHydration(otherPage)
  await expect(otherPage).toHaveURL(/\/coach/)
  await otherPage.goto(`/coach?tab=overview&clientId=${user.id}`)
  await waitForHydration(otherPage)
  await expect(
    otherPage.getByRole('heading', { name: 'Client coaching preferences' }),
  ).toBeVisible()
  await expect(
    otherPage.getByText('Build consistent habits around a changing work schedule.', {
      exact: true,
    }),
  ).toBeVisible()
  await otherPage.screenshot({ path: 'test-results/intake-coach-summary.png', fullPage: true })
  await replay(otherContext, captured)
  expect(await db.clientIntake.count({ where: { userId: other.id } })).toBe(0)
  expect(
    (await db.clientIntake.findUniqueOrThrow({ where: { userId: user.id } })).updatedAt,
  ).toEqual(updated.updatedAt)
  expect(errors).toEqual([])
})
