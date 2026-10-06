import { test, expect, type BrowserContext, type Request } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { db } from '../../scripts/db'
import { waitForHydration } from './hydration'

const base = process.env.TEST_BASE_URL || 'http://localhost:3000'
const emails: string[] = []
const contexts: BrowserContext[] = []
const markers: string[] = []
const marker = (name: string) => {
  const value = `\n\n[Scratchpad verification ${randomUUID()} / ${name}]\n`
  markers.push(value)
  return value
}

test.afterAll(async () => {
  await Promise.all(contexts.map((context) => context.close()))
  // Remove only this run's unique text, preserving any concurrent admin writing.
  let cleaned = false
  for (let attempt = 0; attempt < 6; attempt++) {
    const pad = await db.contentPad.findUniqueOrThrow({ where: { id: 'main' } })
    const body = markers.reduce((text, value) => text.replaceAll(value, ''), pad.body)
    if (body === pad.body) {
      cleaned = true
      break
    }
    const result = await db.contentPad.updateMany({
      where: { id: pad.id, revision: pad.revision },
      data: { body, revision: { increment: 1 } },
    })
    if (result.count) {
      cleaned = true
      break
    }
  }
  await db.user.deleteMany({ where: { email: { in: emails } } })
  await db.$disconnect()
  expect(cleaned, 'Remove this test run’s markers without overwriting other writing').toBe(true)
})

async function register(context: BrowserContext) {
  const email = `content-ideas-test-${randomUUID()}@example.com`
  emails.push(email)
  const response = await context.request.post(`${base}/api/auth/sign-up/email`, {
    data: { name: 'Scratch Pad Test', email, password: `Private-${randomUUID()}!` },
    headers: { Origin: base },
  })
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

test('shared scratch pad autosaves, queues typing, restores state, and protects stale writing', async ({
  browser,
}, testInfo) => {
  test.setTimeout(180_000)
  const adminContext = await browser.newContext({
    baseURL: base,
    viewport: { width: 1440, height: 1100 },
  })
  const clientContext = await browser.newContext({ baseURL: base })
  const anonymous = await browser.newContext({ baseURL: base })
  contexts.push(adminContext, clientContext, anonymous)
  const admin = await register(adminContext)
  await register(clientContext)
  await db.user.update({ where: { id: admin.id }, data: { role: 'ADMIN' } })
  const page = await adminContext.newPage()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/admin/ideas')
  await waitForHydration(page)
  const textarea = page.getByLabel('Your idea', { exact: true })
  const status = page.getByRole('status')
  const original = (await db.contentPad.findUniqueOrThrow({ where: { id: 'main' } })).body
  await expect(textarea).toHaveValue(original)
  await expect(page.getByRole('heading', { name: 'Saved ideas' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Save idea', exact: true })).toHaveCount(0)
  const writing = original + marker('saved')
  const saving = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().includes('/_serverFn/'),
  )
  await textarea.fill(writing)
  const saveRequest = await saving
  await expect(status).toHaveText('All changes saved')
  await expect(textarea).toHaveValue(writing)
  await page.reload()
  await waitForHydration(page)
  await expect(textarea).toHaveValue(writing)
  const revision = (await db.contentPad.findUniqueOrThrow({ where: { id: 'main' } })).revision
  await replay(clientContext, saveRequest)
  await replay(anonymous, saveRequest)
  await replay(adminContext, saveRequest)
  expect((await db.contentPad.findUniqueOrThrow({ where: { id: 'main' } })).revision).toBe(revision)
  const anonPage = await anonymous.newPage()
  await anonPage.goto('/admin/ideas')
  await expect(anonPage).toHaveURL(/\/admin\/login/)
  const clientPage = await clientContext.newPage()
  await clientPage.goto('/admin/ideas')
  await expect(clientPage).not.toHaveURL(/\/admin\//)

  // Hold a successful response while the user keeps typing. The next save must
  // use the new revision and must never replace the textarea with older text.
  let release!: () => void
  let held!: () => void
  const responseHeld = new Promise<void>((resolve) => {
    held = resolve
  })
  const responseRelease = new Promise<void>((resolve) => {
    release = resolve
  })
  let holdNext = true
  await page.route('**/_serverFn/**', async (route) => {
    if (!holdNext || route.request().method() !== 'POST') return route.continue()
    holdNext = false
    const response = await route.fetch()
    held()
    await responseRelease
    await route.fulfill({ response })
  })
  const firstQueued = writing + marker('first queued')
  const newest = firstQueued + marker('newest queued')
  await textarea.fill(firstQueued)
  await responseHeld
  await expect(textarea).toBeEnabled()
  await textarea.fill(newest)
  release()
  await expect(status).toHaveText('All changes saved')
  await expect(textarea).toHaveValue(newest)
  expect((await db.contentPad.findUniqueOrThrow({ where: { id: 'main' } })).body).toBe(newest)
  await page.unroute('**/_serverFn/**')

  const stale = await adminContext.newPage()
  await stale.goto('/admin/ideas')
  await waitForHydration(stale)
  const latest = newest + marker('another tab')
  await textarea.fill(latest)
  await expect(status).toHaveText('All changes saved')
  const staleWriting = newest + marker('stale draft')
  await stale.getByLabel('Your idea', { exact: true }).fill(staleWriting)
  await expect(stale.getByRole('alert')).toContainText('Another admin changed')
  await expect(stale.getByLabel('Your idea', { exact: true })).toHaveValue(staleWriting)
  expect((await db.contentPad.findUniqueOrThrow({ where: { id: 'main' } })).body).toBe(latest)
  await stale.getByRole('button', { name: 'Load saved version' }).click()
  await expect(stale.getByLabel('Your idea', { exact: true })).toHaveValue(latest)

  await adminContext.setOffline(true)
  const offline = latest + marker('offline recovery')
  await textarea.fill(offline)
  await expect(page.getByRole('alert')).toContainText('haven’t saved yet')
  await expect(textarea).toHaveValue(offline)
  await adminContext.setOffline(false)
  await expect(status).toHaveText('All changes saved')
  expect((await db.contentPad.findUniqueOrThrow({ where: { id: 'main' } })).body).toBe(offline)

  // Navigating immediately after typing flushes the debounce before leaving.
  const navigationDraft = offline + marker('navigation flush')
  await textarea.fill(navigationDraft)
  await page.getByRole('link', { name: 'Production board', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/content/)
  await page.getByRole('link', { name: 'Ideas', exact: true }).click()
  await expect(textarea).toHaveValue(navigationDraft)
  await page.screenshot({ path: testInfo.outputPath('scratch-pad-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('scratch-pad-mobile.png'), fullPage: true })

  await db.user.update({ where: { id: admin.id }, data: { role: 'CLIENT' } })
  const beforeRevoke = await db.contentPad.findUniqueOrThrow({ where: { id: 'main' } })
  await replay(adminContext, saveRequest)
  expect((await db.contentPad.findUniqueOrThrow({ where: { id: 'main' } })).body).toBe(
    beforeRevoke.body,
  )
  await page.goto('/admin/ideas')
  await expect(page).not.toHaveURL(/\/admin\//)
  expect(errors).toEqual([])
})
