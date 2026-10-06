import { test, expect, type BrowserContext, type Page, type Request } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { db } from '../../scripts/db'
import { plainTextDocument, richTextPlainText, type RichNode } from '../../src/lib/rich-text'
import { waitForHydration } from './hydration'

const base = process.env.TEST_BASE_URL || 'http://localhost:3000'
const emails: string[] = []
const contexts: BrowserContext[] = []
const markers: string[] = []
let original: { body: string; document: string | null } | undefined

function removeMarkers(node: RichNode): RichNode | null {
  if (node.type === 'text') {
    const text = markers.reduce((text, marker) => text.replaceAll(marker, ''), node.text ?? '')
    return text ? { ...node, text } : null
  }
  if (!node.content) return node
  const content = node.content
    .map(removeMarkers)
    .filter((child): child is RichNode => child !== null)
  if (node.content.length && !content.length && node.type !== 'doc') return null
  return { ...node, content }
}

test.afterAll(async () => {
  await Promise.all(contexts.map((context) => context.close()))
  // Remove only this run's unique nodes, preserving other admin text and formatting.
  let cleaned = false
  for (let attempt = 0; attempt < 6; attempt++) {
    const pad = await db.contentPad.findUniqueOrThrow({ where: { id: 'main' } })
    if (!markers.some((marker) => pad.body.includes(marker))) {
      cleaned = true
      break
    }
    const document = removeMarkers(
      pad.document ? JSON.parse(pad.document) : plainTextDocument(pad.body),
    )!
    if (!document.content?.length) document.content = [{ type: 'paragraph' }]
    const body = richTextPlainText(document)
    const result = await db.contentPad.updateMany({
      where: { id: pad.id, revision: pad.revision },
      data: {
        body,
        document:
          original?.document === null && body === original.body ? null : JSON.stringify(document),
        revision: { increment: 1 },
      },
    })
    if (result.count) {
      cleaned = true
      break
    }
  }
  await db.user.deleteMany({ where: { email: { in: emails } } })
  await db.$disconnect()
  expect(cleaned, 'Remove test nodes without overwriting other writing').toBe(true)
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

async function append(page: Page, name: string) {
  const marker = `[Scratchpad verification ${randomUUID()} / ${name}]`
  markers.push(marker)
  const editor = page.getByRole('textbox', { name: 'Your idea', exact: true })
  await editor.evaluate(async (element) => {
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

async function selectMarker(page: Page, marker: string) {
  await page
    .getByRole('textbox', { name: 'Your idea', exact: true })
    .locator('p,h1,h2,h3')
    .filter({ hasText: marker })
    .evaluate((element) => {
      ;(element.closest('[contenteditable]') as HTMLElement).focus()
      const range = document.createRange()
      range.selectNodeContents(element)
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)
    })
}

test('rich scratch pad preserves formatting, autosave queues, offline recovery, and stale edits', async ({
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
  original = await db.contentPad.findUniqueOrThrow({ where: { id: 'main' } })
  await page.goto('/admin/ideas')
  await waitForHydration(page)
  const editor = page.getByRole('textbox', { name: 'Your idea', exact: true })
  const status = page.getByRole('status')
  await expect(editor).toBeVisible()
  await expect(status).toHaveText('All changes saved')
  await expect(page.getByRole('heading', { name: 'Saved ideas' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Save idea', exact: true })).toHaveCount(0)

  const formatted = await append(page, 'formatted bullet')
  await selectMarker(page, formatted)
  for (const name of ['Bold', 'Italic', 'Underline', 'Highlight', 'Bullet list']) {
    await page.getByRole('button', { name, exact: true }).click()
  }
  const saving = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().includes('/_serverFn/'),
  )
  await page.keyboard.press('ControlOrMeta+s')
  const saveRequest = await saving
  await expect(status).toHaveText('All changes saved')
  await expect(
    editor.locator('ul li strong em u mark').filter({ hasText: formatted }),
  ).toBeVisible()
  await page.reload()
  await waitForHydration(page)
  await expect(
    editor.locator('ul li strong em u mark').filter({ hasText: formatted }),
  ).toBeVisible()
  const revision = (await db.contentPad.findUniqueOrThrow({ where: { id: 'main' } })).revision
  await replay(clientContext, saveRequest)
  await replay(anonymous, saveRequest)
  await replay(adminContext, saveRequest)
  expect((await db.contentPad.findUniqueOrThrow({ where: { id: 'main' } })).revision).toBe(revision)

  const numbered = await append(page, 'numbered')
  await page.getByRole('button', { name: 'Numbered list', exact: true }).click()
  await expect(status).toHaveText('All changes saved')
  await expect(editor.locator('ol li').filter({ hasText: numbered })).toBeVisible()
  const task = await append(page, 'checklist')
  await page.getByRole('button', { name: 'Checklist', exact: true }).click()
  await editor.locator('li').filter({ hasText: task }).getByRole('checkbox').check()
  await expect(status).toHaveText('All changes saved')
  const heading = await append(page, 'heading with link')
  await page.getByRole('combobox', { name: 'Text style' }).selectOption('h2')
  await selectMarker(page, heading)
  await page.getByRole('button', { name: 'Add or edit link' }).click()
  await page.getByLabel('Link URL').fill('https://example.com/content-idea')
  await page.getByRole('button', { name: 'Apply link' }).click()
  await page.getByRole('button', { name: 'Align center', exact: true }).click()
  await expect(status).toHaveText('All changes saved')
  await page.reload()
  await waitForHydration(page)
  await expect(editor.locator('ol li').filter({ hasText: numbered })).toBeVisible()
  await expect(editor.locator('li').filter({ hasText: task }).getByRole('checkbox')).toBeChecked()
  await expect(editor.locator('h2 a')).toContainText(heading)
  await expect(editor.locator('h2').filter({ hasText: heading })).toHaveCSS('text-align', 'center')

  const pasted = await append(page, 'pasted formatting')
  await selectMarker(page, pasted)
  await editor.evaluate((element, marker) => {
    const clipboardData = new DataTransfer()
    clipboardData.setData(
      'text/html',
      `<p><strong><a href="https://example.com/pasted" class="from-another-editor" rel="noopener">${marker}</a></strong></p>`,
    )
    element.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }),
    )
  }, pasted)
  await expect(status).toHaveText('All changes saved')
  await page.reload()
  await waitForHydration(page)
  const pastedLink = editor.locator('a').filter({ hasText: pasted })
  await expect(pastedLink).toBeVisible()
  await expect(pastedLink.locator('strong')).toBeVisible()
  await expect(pastedLink).toHaveAttribute('rel', 'noopener noreferrer nofollow')
  await expect(pastedLink).not.toHaveAttribute('class')

  const anonPage = await anonymous.newPage()
  await anonPage.goto('/admin/ideas')
  await expect(anonPage).toHaveURL(/\/admin\/login/)
  const clientPage = await clientContext.newPage()
  await clientPage.goto('/admin/ideas')
  await expect(clientPage).not.toHaveURL(/\/admin\//)

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
  await append(page, 'first queued')
  await responseHeld
  await expect(editor).toBeEditable()
  const newest = await append(page, 'newest queued')
  release()
  await expect(status).toHaveText('All changes saved')
  await expect(editor).toContainText(newest)
  expect((await db.contentPad.findUniqueOrThrow({ where: { id: 'main' } })).body).toContain(newest)
  await page.unroute('**/_serverFn/**')

  const stale = await adminContext.newPage()
  await stale.goto('/admin/ideas')
  await waitForHydration(stale)
  const latest = await append(page, 'another tab')
  await expect(status).toHaveText('All changes saved')
  const staleWriting = await append(stale, 'stale draft')
  await expect(stale.getByRole('alert')).toContainText('Another admin changed')
  await expect(stale.getByRole('textbox', { name: 'Your idea', exact: true })).toContainText(
    staleWriting,
  )
  expect((await db.contentPad.findUniqueOrThrow({ where: { id: 'main' } })).body).not.toContain(
    staleWriting,
  )
  await stale.getByRole('button', { name: 'Load saved version' }).click()
  await expect(stale.getByRole('textbox', { name: 'Your idea', exact: true })).toContainText(latest)
  await expect(stale.getByRole('textbox', { name: 'Your idea', exact: true })).not.toContainText(
    staleWriting,
  )

  await adminContext.setOffline(true)
  const offline = await append(page, 'offline recovery')
  await expect(page.getByRole('alert')).toContainText('haven’t saved yet')
  await expect(editor).toContainText(offline)
  await adminContext.setOffline(false)
  await expect(status).toHaveText('All changes saved')
  expect((await db.contentPad.findUniqueOrThrow({ where: { id: 'main' } })).body).toContain(offline)

  const navigation = await append(page, 'navigation flush')
  await page.getByRole('link', { name: 'Production board', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/content/)
  await page.getByRole('link', { name: 'Ideas', exact: true }).click()
  await expect(editor).toContainText(navigation)
  await page.screenshot({ path: testInfo.outputPath('scratch-pad-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('scratch-pad-mobile.png'), fullPage: true })

  await db.user.update({ where: { id: admin.id }, data: { role: 'CLIENT' } })
  const beforeRevoke = await db.contentPad.findUniqueOrThrow({ where: { id: 'main' } })
  await replay(adminContext, saveRequest)
  expect((await db.contentPad.findUniqueOrThrow({ where: { id: 'main' } })).document).toBe(
    beforeRevoke.document,
  )
  await page.goto('/admin/ideas')
  await expect(page).not.toHaveURL(/\/admin\//)
  expect(errors).toEqual([])
})
