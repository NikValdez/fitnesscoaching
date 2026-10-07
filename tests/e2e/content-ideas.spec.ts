import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { db } from '../../scripts/db'
import { waitForHydration } from './hydration'

const base = process.env.TEST_BASE_URL || 'http://localhost:3000'
const emails: string[] = []
const contexts: BrowserContext[] = []
const markers: string[] = []
let cleanupPage: Page | undefined

async function select(page: Page, marker: string) {
  await page
    .getByRole('textbox', { name: 'Your idea', exact: true })
    .locator('p,h1,h2,h3')
    .filter({ hasText: marker })
    .evaluate(async (element) => {
      ;(element.closest('[contenteditable]') as HTMLElement).focus()
      const range = document.createRange()
      range.selectNodeContents(element)
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      )
    })
}

test.afterAll(async () => {
  // Local Durable Object storage is isolated from production. Remove this run's
  // nodes through the editor; never replace the production database scratch pad.
  try {
    if (cleanupPage && !cleanupPage.isClosed()) {
      for (const marker of markers) {
        if (
          await cleanupPage
            .getByRole('textbox', { name: 'Your idea', exact: true })
            .locator('p,h1,h2,h3')
            .filter({ hasText: marker })
            .count()
        ) {
          await select(cleanupPage, marker)
          await cleanupPage.keyboard.press('Backspace')
        }
      }
      await expect(cleanupPage.getByRole('status')).toHaveText('All changes saved')
    }
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
    await db.user.deleteMany({ where: { email: { in: emails } } })
    await db.$disconnect()
  }
})

async function register(context: BrowserContext, name: string) {
  const email = `studio-collab-test-${randomUUID()}@example.com`
  emails.push(email)
  const options = {
    data: { name, email, password: `Private-${randomUUID()}!` },
    headers: { Origin: base },
  }
  let response = await context.request.post(`${base}/api/auth/sign-up/email`, options)
  for (let attempt = 0; response.status() === 429 && attempt < 3; attempt++) {
    const delay = Math.max(1, Number(response.headers()['retry-after']) || 10)
    await new Promise((resolve) => setTimeout(resolve, delay * 1000))
    response = await context.request.post(`${base}/api/auth/sign-up/email`, options)
  }
  expect(response.ok()).toBe(true)
  return db.user.findUniqueOrThrow({ where: { email } })
}

async function append(page: Page, label: string) {
  const marker = `[Collaboration ${randomUUID()} / ${label}]`
  markers.push(marker)
  await page.getByRole('textbox', { name: 'Your idea', exact: true }).evaluate(async (element) => {
    ;(element as HTMLElement).focus()
    const range = document.createRange()
    range.selectNodeContents(element)
    range.collapse(false)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
  })
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Clear formatting', exact: true }).click()
  await page.keyboard.insertText(marker)
  return marker
}

test('admins collaborate live with cursors, local undo, offline merging, persistence, and access control', async ({
  browser,
}, testInfo) => {
  test.skip(
    base.startsWith('https:'),
    'Use isolated local Durable Object storage for editing tests.',
  )
  test.setTimeout(180000)
  const aliceContext = await browser.newContext({
    baseURL: base,
    viewport: { width: 1440, height: 1100 },
  })
  const bobContext = await browser.newContext({ baseURL: base })
  const anonymous = await browser.newContext({ baseURL: base })
  contexts.push(aliceContext, bobContext, anonymous)
  const alice = await register(aliceContext, 'Alice Studio Test')
  const bob = await register(bobContext, 'Bob Studio Test')
  await db.user.update({ where: { id: alice.id }, data: { role: 'ADMIN' } })
  const alicePage = await aliceContext.newPage()
  cleanupPage = alicePage
  const bobPage = await bobContext.newPage()
  const errors: string[] = []
  alicePage.on('pageerror', (error) => errors.push(error.message))
  bobPage.on('pageerror', (error) => errors.push(error.message))
  const denied = await bobContext.request.get(`${base}/api/admin/live?client=12`, {
    headers: { Origin: base, Upgrade: 'websocket' },
  })
  expect(denied.status()).toBe(403)
  const signedOut = await anonymous.request.get(`${base}/api/admin/live?client=12`, {
    headers: { Origin: base, Upgrade: 'websocket' },
  })
  expect(signedOut.status()).toBe(401)
  const foreign = await aliceContext.request.get(`${base}/api/admin/live?client=12`, {
    headers: { Origin: 'https://untrusted.example', Upgrade: 'websocket' },
  })
  expect(foreign.status()).toBe(403)
  await db.user.update({ where: { id: bob.id }, data: { role: 'ADMIN' } })
  await Promise.all([alicePage.goto('/admin/ideas'), bobPage.goto('/admin/ideas')])
  await Promise.all([waitForHydration(alicePage), waitForHydration(bobPage)])
  const editor = (page: Page) => page.getByRole('textbox', { name: 'Your idea', exact: true })
  await expect(editor(alicePage)).toBeEditable()
  await expect(editor(bobPage)).toBeEditable()
  await expect(alicePage.getByLabel('Admins online')).toContainText('Bob Studio Test')
  await expect(bobPage.getByLabel('Admins online')).toContainText('Alice Studio Test')
  const first = await append(alicePage, 'live formatting')
  await select(alicePage, first)
  for (const name of ['Bold', 'Italic', 'Underline', 'Highlight', 'Bullet list'])
    await alicePage.getByRole('button', { name, exact: true }).click()
  await expect(
    editor(bobPage).locator('ul li strong em u mark').filter({ hasText: first }),
  ).toBeVisible()
  await expect(
    bobPage.locator('.collaboration-carets__label').filter({ hasText: 'Alice Studio Test' }),
  ).toBeVisible()

  const typing = await append(alicePage, 'continuous typing')
  await alicePage.keyboard.type(
    ' A quick series of keystrokes should synchronize without a growing queue.',
    { delay: 30 },
  )
  await expect(alicePage.getByRole('status')).toHaveText('All changes saved', { timeout: 5000 })
  await expect(editor(bobPage)).toContainText(
    `${typing} A quick series of keystrokes should synchronize without a growing queue.`,
  )

  // Both browsers edit from the same offline base, then reconnect concurrently.
  await Promise.all([aliceContext.setOffline(true), bobContext.setOffline(true)])
  const aliceOffline = await append(alicePage, 'Alice offline')
  const bobOffline = await append(bobPage, 'Bob offline')
  await expect(alicePage.getByRole('status')).toContainText('Offline')
  await Promise.all([aliceContext.setOffline(false), bobContext.setOffline(false)])
  for (const page of [alicePage, bobPage]) {
    await expect(editor(page)).toContainText(aliceOffline)
    await expect(editor(page)).toContainText(bobOffline)
    await expect(page.getByRole('status')).toHaveText('All changes saved')
  }

  const own = await append(alicePage, 'own undo')
  await expect(editor(bobPage)).toContainText(own)
  const other = await append(bobPage, 'other admin stays')
  await expect(editor(alicePage)).toContainText(other)
  await alicePage.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(editor(alicePage)).not.toContainText(own)
  await expect(editor(alicePage)).toContainText(other)
  await expect(editor(bobPage)).toContainText(other)
  await alicePage.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect(editor(bobPage)).toContainText(own)

  await alicePage.reload()
  await waitForHydration(alicePage)
  await expect(editor(alicePage)).toContainText(aliceOffline)
  await expect(editor(alicePage)).toContainText(bobOffline)
  await expect(
    editor(alicePage).locator('ul li strong em u mark').filter({ hasText: first }),
  ).toBeVisible()
  await alicePage.screenshot({
    path: testInfo.outputPath('shared-pad-desktop.png'),
    fullPage: true,
  })
  await alicePage.setViewportSize({ width: 390, height: 844 })
  expect(await alicePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  )
  await alicePage.screenshot({ path: testInfo.outputPath('shared-pad-mobile.png'), fullPage: true })

  await append(bobPage, 'access revocation')
  await expect(bobPage.getByRole('status')).toHaveText('All changes saved')
  await db.user.update({ where: { id: bob.id }, data: { role: 'CLIENT' } })
  const forbidden = `revoked-${randomUUID()}`
  await bobPage.keyboard.insertText(forbidden)
  await expect(bobPage.getByRole('alert')).toContainText('admin session ended')
  await expect(editor(bobPage)).not.toBeEditable()
  await expect(editor(alicePage)).not.toContainText(forbidden)
  expect(errors).toEqual([])
})
