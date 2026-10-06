import { test, expect, type BrowserContext, type Request } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { db } from '../../scripts/db'
import { waitForHydration } from './hydration'

const base = process.env.TEST_BASE_URL || 'http://localhost:3000'
const emails: string[] = []
const contexts: BrowserContext[] = []

test.afterAll(async () => {
  await Promise.all(contexts.map((context) => context.close()))
  const users = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true } })
  const authors = { authorId: { in: users.map((user) => user.id) } }
  await db.contentScratch.deleteMany({ where: authors })
  await db.contentIdea.deleteMany({ where: authors })
  await db.user.deleteMany({ where: { email: { in: emails } } })
  await db.$disconnect()
})

async function register(context: BrowserContext) {
  const email = `content-ideas-test-${randomUUID()}@example.com`
  emails.push(email)
  const response = await context.request.post(`${base}/api/auth/sign-up/email`, {
    data: { name: 'Ideas Test', email, password: `Private-${randomUUID()}!` },
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

test('private scratch pad persists, protects drafts, and creates a single board card', async ({
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
  const anonPage = await anonymous.newPage()
  await anonPage.goto('/admin/ideas')
  await expect(anonPage).toHaveURL(/\/admin\/login/)
  const clientPage = await clientContext.newPage()
  await clientPage.goto('/admin/ideas')
  await expect(clientPage).not.toHaveURL(/\/admin\//)
  await page.goto('/admin/content')
  await waitForHydration(page)
  await page.getByRole('link', { name: 'Ideas', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/ideas/)
  const title = `Three small habits ${randomUUID().slice(0, 8)}`
  const body = `${title}\n\nA hook about starting with one habit.\nFilm a walk and a simple meal.`
  const mutation = () =>
    page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().includes('/_serverFn/'),
    )
  await page.getByLabel('Your idea', { exact: true }).fill(body)
  const saving = mutation()
  await page.getByRole('button', { name: 'Save idea', exact: true }).click()
  const saveRequest = await saving
  await expect(page.getByLabel('Your idea', { exact: true })).toHaveValue('')
  const idea = await db.contentScratch.findFirstOrThrow({ where: { body, authorId: admin.id } })
  const note = page.locator(`[data-scratch-id="${idea.id}"]`)
  await expect(note).toContainText(title)
  await replay(clientContext, saveRequest)
  await replay(anonymous, saveRequest)
  expect(await db.contentScratch.count({ where: { body } })).toBe(1)
  await page.reload()
  await waitForHydration(page)
  await expect(note).toContainText('Film a walk and a simple meal.')

  const other = await adminContext.newPage()
  await other.goto('/admin/ideas')
  await waitForHydration(other)
  await note.getByRole('button', { name: `Edit ${title}`, exact: true }).click()
  const dialog = page.getByRole('dialog')
  const revised = `${body}\nEnd with a question for the audience.`
  await dialog.getByLabel('Idea', { exact: true }).fill(revised)
  await other
    .locator(`[data-scratch-id="${idea.id}"]`)
    .getByRole('button', { name: `Edit ${title}`, exact: true })
    .click()
  await other
    .getByRole('dialog')
    .getByLabel('Idea', { exact: true })
    .fill(`${body}\nAnother tab’s note.`)
  await other.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(other.getByRole('dialog')).not.toBeVisible()
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('changed in another tab')
  await expect(dialog.getByLabel('Idea', { exact: true })).toHaveValue(revised)
  await dialog.getByRole('button', { name: 'Refresh ideas, keep my draft' }).click()
  await expect(dialog.getByRole('alert')).not.toBeVisible()
  await expect(dialog.getByLabel('Idea', { exact: true })).toHaveValue(revised)
  const editing = mutation()
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
  const editRequest = await editing
  await expect(dialog).not.toBeVisible()
  await replay(clientContext, editRequest)
  await replay(anonymous, editRequest)
  expect((await db.contentScratch.findUniqueOrThrow({ where: { id: idea.id } })).body).toBe(revised)

  await note.getByRole('button', { name: 'Create card', exact: true }).click()
  await expect(dialog.getByLabel('Card title')).toHaveValue(title)
  const cardTitle = `${title} — reel`
  await dialog.getByLabel('Card title').fill(cardTitle)
  const converting = mutation()
  await dialog.getByRole('button', { name: 'Create card', exact: true }).click()
  const conversionRequest = await converting
  await expect(dialog).not.toBeVisible()
  const converted = await db.contentScratch.findUniqueOrThrow({
    where: { id: idea.id },
    include: { card: true },
  })
  expect(converted.body).toBe(revised)
  expect(converted.card).toMatchObject({ title: cardTitle, stage: 'CONCEPTS', notes: revised })
  await Promise.all([
    replay(adminContext, conversionRequest),
    replay(adminContext, conversionRequest),
    replay(clientContext, conversionRequest),
    replay(anonymous, conversionRequest),
  ])
  expect(await db.contentIdea.count({ where: { title: cardTitle } })).toBe(1)
  await expect(note.getByRole('button', { name: 'Create card', exact: true })).toHaveCount(0)
  await expect(note.getByRole('link', { name: /Concepts/ })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('ideas-desktop.png'), fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('link', { name: 'Ideas', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.screenshot({ path: testInfo.outputPath('ideas-mobile.png'), fullPage: true })
  await note.getByRole('link', { name: /Concepts/ }).click()
  await expect(page.getByRole('heading', { name: cardTitle, exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('board-mobile.png'), fullPage: true })
  await page.getByRole('link', { name: 'Ideas', exact: true }).click()
  await note.getByRole('button', { name: `Delete ${title}`, exact: true }).click()
  await expect(dialog).toContainText('Its board card will stay.')
  const deleting = mutation()
  await dialog.getByRole('button', { name: 'Delete idea', exact: true }).click()
  const deleteRequest = await deleting
  await expect(dialog).not.toBeVisible()
  await expect(note).toHaveCount(0)
  expect(await db.contentIdea.count({ where: { id: converted.cardId! } })).toBe(1)
  await replay(clientContext, deleteRequest)
  await replay(anonymous, deleteRequest)
  await db.user.update({ where: { id: admin.id }, data: { role: 'CLIENT' } })
  await replay(adminContext, saveRequest)
  expect(await db.contentScratch.count({ where: { authorId: admin.id } })).toBe(0)
  await page.goto('/admin/ideas')
  await expect(page).not.toHaveURL(/\/admin\//)
  expect(errors).toEqual([])
})
