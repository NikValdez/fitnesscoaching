import { test, expect, type BrowserContext, type Request, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { db } from '../../scripts/db'
import { waitForHydration } from './hydration'

const base = process.env.TEST_BASE_URL || 'http://localhost:3000'
const emails: string[] = []
const contexts: BrowserContext[] = []
const titles: string[] = []

test.afterAll(async () => {
  await Promise.all(contexts.map((context) => context.close()))
  await db.contentIdea.deleteMany({ where: { title: { in: titles } } })
  await db.user.deleteMany({ where: { email: { in: emails } } })
  await db.$disconnect()
})

async function register(context: BrowserContext, name: string) {
  const email = `content-studio-test-${randomUUID()}@example.com`
  const password = `Private-${randomUUID()}!`
  emails.push(email)
  const options = {
    data: { name, email, password, role: 'ADMIN' },
    headers: { Origin: base },
  }
  let response = await context.request.post(`${base}/api/auth/sign-up/email`, options)
  for (let attempt = 0; response.status() === 429 && attempt < 3; attempt++) {
    const delay = Math.max(1, Number(response.headers()['retry-after']) || 10)
    await new Promise((resolve) => setTimeout(resolve, delay * 1000))
    response = await context.request.post(`${base}/api/auth/sign-up/email`, options)
  }
  expect(response.ok()).toBe(true)
  const user = await db.user.findUniqueOrThrow({ where: { email } })
  expect(user.role).toBe('CLIENT')
  return { ...user, password }
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

async function drag(page: Page, ideaId: string, stage: string) {
  const handle = page.locator(`[data-idea-id="${ideaId}"]`).getByRole('button', { name: /^Drag / })
  const column = page.locator(`[data-stage="${stage}"]`)
  await column.scrollIntoViewIfNeeded()
  const source = await handle.boundingBox()
  const target = await column.boundingBox()
  if (!source || !target) throw new Error('Missing drag source or target')
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  await page.mouse.move(source.x + source.width / 2 + 10, source.y + source.height / 2, {
    steps: 3,
  })
  await expect(page.locator('.content-card-overlay')).toBeVisible()
  // Aim inside the column padding, which stays a column drop target even when
  // another admin has added cards in this stage.
  await page.mouse.move(target.x + 8, Math.max(8, target.y + 150), { steps: 20 })
  await expect(column).toHaveClass(/is-over/)
  await page.mouse.up()
}

test('admin sign-in, persistent ideas, drag and reorder, mobile, and server access checks', async ({
  browser,
}) => {
  test.setTimeout(180_000)
  const adminContext = await browser.newContext({
    baseURL: base,
    viewport: { width: 1600, height: 1000 },
  })
  const clientContext = await browser.newContext({ baseURL: base })
  const anonymous = await browser.newContext({ baseURL: base })
  contexts.push(adminContext, clientContext, anonymous)
  const admin = await register(adminContext, 'Content Admin')
  const client = await register(clientContext, 'Content Client')
  await db.user.update({ where: { id: admin.id }, data: { role: 'ADMIN' } })
  await db.clientIntake.create({
    data: {
      userId: client.id,
      channels: ['EMAIL'],
      interests: { create: [{ service: 'FITNESS', tier: 'ESSENTIAL' }] },
    },
  })

  const page = await adminContext.newPage()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const signOut = await adminContext.request.post('/api/auth/sign-out', {
    data: {},
    headers: { Origin: base },
  })
  expect(signOut.ok()).toBe(true)
  await adminContext.clearCookies()
  await page.goto('/admin/content')
  await waitForHydration(page)
  await expect(page).toHaveURL(/\/admin\/login/)
  await page.getByLabel('Email address').fill(admin.email)
  await page.getByLabel('Password', { exact: true }).fill('incorrect-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL(/\/admin\/login/)
  await page.getByLabel('Password', { exact: true }).fill(admin.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/content/)
  await expect(page.getByRole('heading', { name: 'Content & ideas.' })).toBeVisible()
  for (const stage of ['Concepts', 'Pre production', 'Filming', 'Done']) {
    await expect(page.getByRole('heading', { name: stage, exact: true })).toBeVisible()
  }

  const title = `Build a stronger week ${randomUUID().slice(0, 8)}`
  titles.push(title, `${title} updated`, `${title} second`)
  await page.getByRole('button', { name: 'New idea', exact: true }).click()
  await page.getByLabel('Idea title').fill(title)
  for (const name of ['Instagram', 'TikTok', 'Facebook', 'YouTube', 'Twitter', 'LinkedIn']) {
    await page.getByRole('dialog').getByRole('button', { name, exact: true }).click()
  }
  await page
    .getByLabel('Notes & direction')
    .fill('Hook: start with one small habit.\nFilm three simple exercises.')
  const createPromise = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().includes('/_serverFn/'),
  )
  await page.getByRole('dialog').getByRole('button', { name: 'Add idea', exact: true }).click()
  const createRequest = await createPromise
  await expect(page.getByRole('dialog')).not.toBeVisible()
  const idea = await db.contentIdea.findFirstOrThrow({ where: { title } })
  expect(idea.platforms).toEqual([
    'INSTAGRAM',
    'TIKTOK',
    'FACEBOOK',
    'YOUTUBE',
    'TWITTER',
    'LINKEDIN',
  ])
  await replay(clientContext, createRequest)
  await replay(anonymous, createRequest)
  expect(await db.contentIdea.count({ where: { title } })).toBe(1)
  const crossSite = await adminContext.request.post(createRequest.url(), {
    data: createRequest.postData(),
    headers: {
      'content-type': createRequest.headers()['content-type'],
      'x-tsr': 'serverFn',
      Origin: 'https://untrusted.example',
      'Sec-Fetch-Site': 'cross-site',
    },
  })
  expect(crossSite.status()).toBe(403)

  await page.reload()
  await waitForHydration(page)
  await expect(
    page.locator('[data-stage="CONCEPTS"]').getByRole('heading', { name: title }),
  ).toBeVisible()
  const tags = page
    .locator(`[data-idea-id="${idea.id}"]`)
    .getByRole('list', { name: 'Social platforms' })
  await expect(tags.getByRole('listitem')).toHaveCount(6)
  await expect(tags).toContainText('InstagramTikTokFacebookYouTubeTwitterLinkedIn')
  const movePromise = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().includes('/_serverFn/'),
  )
  await drag(page, idea.id, 'PRE_PRODUCTION')
  const moveRequest = await movePromise
  await expect(
    page.locator('[data-stage="PRE_PRODUCTION"]').getByRole('heading', { name: title }),
  ).toBeVisible()
  await expect(page.getByText('Saving…', { exact: true })).toHaveCount(0)
  expect((await db.contentIdea.findUniqueOrThrow({ where: { id: idea.id } })).stage).toBe(
    'PRE_PRODUCTION',
  )

  await db.contentIdea.update({ where: { id: idea.id }, data: { stage: 'CONCEPTS' } })
  await replay(clientContext, moveRequest)
  await replay(anonymous, moveRequest)
  expect((await db.contentIdea.findUniqueOrThrow({ where: { id: idea.id } })).stage).toBe(
    'CONCEPTS',
  )
  await page.reload()
  await waitForHydration(page)

  // Changes from another tab cannot silently replace a stale admin's draft.
  await page.getByRole('button', { name: `Edit ${title}`, exact: true }).click()
  await page.getByLabel('Idea title').fill(`${title} updated`)
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Instagram', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('dialog').getByRole('button', { name: 'Twitter', exact: true }).click()
  await db.contentBoard.update({ where: { id: 'main' }, data: { revision: { increment: 1 } } })
  await db.contentIdea.update({
    where: { id: idea.id },
    data: { notes: 'Another admin updated this card.' },
  })
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('card was edited')
  await expect(page.getByLabel('Idea title')).toHaveValue(`${title} updated`)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: `Edit ${title}`, exact: true }).click()
  await expect(page.getByLabel('Notes & direction')).toHaveValue('Another admin updated this card.')
  await page.getByLabel('Idea title').fill(`${title} updated`)
  await page.getByRole('dialog').getByRole('button', { name: 'Twitter', exact: true }).click()
  const editPromise = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().includes('/_serverFn/'),
  )
  await page.getByRole('button', { name: 'Save changes' }).click()
  const editRequest = await editPromise
  await expect(page.getByRole('dialog')).not.toBeVisible()
  expect((await db.contentIdea.findUniqueOrThrow({ where: { id: idea.id } })).platforms).toEqual([
    'INSTAGRAM',
    'TIKTOK',
    'FACEBOOK',
    'YOUTUBE',
    'LINKEDIN',
  ])
  await db.contentIdea.update({ where: { id: idea.id }, data: { title } })
  await replay(clientContext, editRequest)
  await replay(anonymous, editRequest)
  expect((await db.contentIdea.findUniqueOrThrow({ where: { id: idea.id } })).title).toBe(title)
  await page.reload()
  await waitForHydration(page)

  // Reorder within a stage using the keyboard drag handle.
  await page.getByRole('button', { name: 'New idea', exact: true }).click()
  await page.getByLabel('Idea title').fill(`${title} second`)
  await page.getByRole('dialog').getByRole('button', { name: 'Add idea', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  const second = await db.contentIdea.findFirstOrThrow({
    where: { title: `${title} second` },
  })
  await page.getByRole('button', { name: `Drag ${title} second`, exact: true }).focus()
  await page.keyboard.press('Space')
  await expect(
    page.getByRole('button', { name: `Drag ${title} second`, exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.content-card-overlay')).toBeVisible()
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
  await page.keyboard.press('ArrowUp')
  await expect(page.locator('[id^="DndLiveRegion"]')).toContainText(`is over ${title}.`)
  await page.keyboard.press('Space')
  await expect(page.locator('.content-card-overlay')).toHaveCount(0)
  await expect(page.getByText('Saving…', { exact: true })).toHaveCount(0)
  await expect
    .poll(
      async () => (await db.contentIdea.findUniqueOrThrow({ where: { id: second.id } })).position,
    )
    .toBeLessThan(idea.position + 1)
  await page.reload()
  await waitForHydration(page)
  const cardIds = await page
    .locator('[data-stage="CONCEPTS"] [data-idea-id]')
    .evaluateAll((cards) => cards.map((card) => card.getAttribute('data-idea-id')))
  expect(cardIds.indexOf(second.id)).toBeLessThan(cardIds.indexOf(idea.id))

  // Mobile can scroll the board and move cards without a drag gesture.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('.content-board').evaluate((element) => {
    element.scrollIntoView({ block: 'center', behavior: 'instant' })
    element.scrollLeft = 0
  })
  await page.locator(`[data-idea-id="${second.id}"] .content-drag-handle`).evaluate((element) => {
    element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })
  })
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
  const touchHandle = await page
    .locator(`[data-idea-id="${second.id}"] .content-drag-handle`)
    .boundingBox()
  const touchTarget = await page.locator('[data-stage="PRE_PRODUCTION"]').boundingBox()
  if (!touchHandle || !touchTarget) throw new Error('Missing touch drag source or target')
  const touchSession = await adminContext.newCDPSession(page)
  await touchSession.send('Emulation.setTouchEmulationEnabled', { enabled: true })
  const touchX = touchHandle.x + touchHandle.width / 2
  const touchY = touchHandle.y + touchHandle.height / 2
  await touchSession.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: touchX, y: touchY }],
  })
  await touchSession.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: touchX + 12, y: touchY }],
  })
  await expect(page.locator('.content-card-overlay')).toBeVisible()
  await touchSession.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: touchTarget.x + 8, y: Math.max(8, touchTarget.y + 150) }],
  })
  await expect(page.locator('[data-stage="PRE_PRODUCTION"]')).toHaveClass(/is-over/)
  await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect(
    page.locator(`[data-stage="PRE_PRODUCTION"] [data-idea-id="${second.id}"]`),
  ).toHaveCount(1)
  await expect(page.getByText('Saving…', { exact: true })).toHaveCount(0)
  await touchSession.send('Emulation.setTouchEmulationEnabled', { enabled: false })
  await touchSession.detach()
  await page.getByLabel(`Stage for ${title}`, { exact: true }).selectOption('FILMING')
  await expect(
    page
      .locator('[data-stage="FILMING"] [data-idea-id]')
      .filter({ has: page.getByRole('heading', { name: title, exact: true }) }),
  ).toHaveCount(1)
  await expect(page.getByText('Saving…', { exact: true })).toHaveCount(0)
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true)
  await page.screenshot({ path: 'test-results/content-studio-mobile.png', fullPage: true })
  await page.setViewportSize({ width: 1600, height: 1000 })
  await page.reload()
  await waitForHydration(page)
  await page.getByLabel(`Stage for ${title}`, { exact: true }).selectOption('DONE')
  await expect(
    page.locator('[data-stage="DONE"]').getByRole('heading', { name: title, exact: true }),
  ).toBeVisible()
  await expect(page.getByText('Saving…', { exact: true })).toHaveCount(0)
  await page.screenshot({ path: 'test-results/content-studio-desktop.png', fullPage: true })

  const clientPage = await clientContext.newPage()
  const clientResponse = await clientPage.goto('/admin/content')
  await expect(clientPage).toHaveURL(/\/portal/)
  expect(await clientResponse?.text()).not.toContain(title)
  await expect(clientPage.getByRole('link', { name: 'Content Studio' })).toHaveCount(0)
  const anonymousPage = await anonymous.newPage()
  const anonymousResponse = await anonymousPage.goto('/admin/content')
  await expect(anonymousPage).toHaveURL(/\/admin\/login/)
  expect(await anonymousResponse?.text()).not.toContain(title)

  await page.getByRole('button', { name: `Edit ${title}`, exact: true }).click()
  await page.getByRole('button', { name: 'Delete idea', exact: true }).click()
  await page.getByRole('button', { name: 'Keep idea' }).click()
  expect(await db.contentIdea.count({ where: { id: idea.id } })).toBe(1)
  await page.getByRole('button', { name: `Edit ${title}`, exact: true }).click()
  await page.getByRole('button', { name: 'Delete idea', exact: true }).click()
  const deletePromise = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().includes('/_serverFn/'),
  )
  await page.getByRole('button', { name: 'Delete idea', exact: true }).click()
  const deleteRequest = await deletePromise
  await expect(page.getByRole('dialog')).not.toBeVisible()
  expect(await db.contentIdea.count({ where: { id: idea.id } })).toBe(0)
  await db.contentIdea.create({ data: { ...idea, stage: 'DONE' } })
  await replay(clientContext, deleteRequest)
  await replay(anonymous, deleteRequest)
  expect(await db.contentIdea.count({ where: { id: idea.id } })).toBe(1)

  // A revoked administrator's existing session immediately loses read/write access.
  await db.user.update({ where: { id: admin.id }, data: { role: 'CLIENT' } })
  await replay(adminContext, deleteRequest)
  expect(await db.contentIdea.count({ where: { id: idea.id } })).toBe(1)
  await page.goto('/admin/content')
  await expect(page).not.toHaveURL(/\/admin\/content/)
  expect(errors).toEqual([])
})
