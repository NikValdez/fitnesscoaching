import { test, expect, type BrowserContext, type Page, type Request } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { db } from '../../scripts/db'
import { waitForHydration } from './hydration'

const base = process.env.TEST_BASE_URL || 'http://localhost:3000'
const contexts: BrowserContext[] = []
const emails: string[] = []
const urls: string[] = []
test.afterAll(async () => {
  await Promise.all(contexts.map((context) => context.close()))
  const removed = await db.contentLibraryEntry.deleteMany({ where: { url: { in: urls } } })
  if (removed.count)
    await db.contentLibrary.update({ where: { id: 'main' }, data: { revision: { increment: 1 } } })
  await db.user.deleteMany({ where: { email: { in: emails } } })
  await db.$disconnect()
})

async function account(context: BrowserContext, name: string, admin: boolean) {
  const email = `library-test-${randomUUID()}@example.com`
  emails.push(email)
  const options = {
    data: { name, email, password: `Private-${randomUUID()}!` },
    headers: { Origin: base },
  }
  let response = await context.request.post('/api/auth/sign-up/email', options)
  for (let attempt = 0; response.status() === 429 && attempt < 3; attempt++) {
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        Math.min(60, Math.max(10, Number(response.headers()['retry-after']) || 10)) * 1000,
      ),
    )
    response = await context.request.post('/api/auth/sign-up/email', options)
  }
  expect(response.ok()).toBe(true)
  return db.user.update({ where: { email }, data: { role: admin ? 'ADMIN' : 'CLIENT' } })
}
async function replay(context: BrowserContext, request: Request, origin = base) {
  return context.request.post(request.url(), {
    data: request.postData(),
    headers: {
      'content-type': request.headers()['content-type'] || 'application/json',
      'x-tsr': 'serverFn',
      Origin: origin,
      ...(origin !== base ? { 'Sec-Fetch-Site': 'cross-site' } : {}),
    },
  })
}
async function save(page: Page, title: string, url: string, notes = '') {
  await page.getByRole('button', { name: 'Save link', exact: true }).click()
  await page.getByLabel('Content link', { exact: true }).fill(url)
  await page.getByLabel('Title (optional)', { exact: true }).fill(title)
  await page.getByLabel('Notes (optional)', { exact: true }).fill(notes)
  const request = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().includes('/_serverFn/'),
  )
  await page.getByRole('dialog').getByRole('button', { name: 'Save link', exact: true }).click()
  const sent = await request
  await expect(page.getByRole('dialog')).not.toBeVisible()
  return sent
}

test('admins share, find, edit, and delete inspiration links with private access and mobile navigation', async ({
  browser,
}) => {
  test.setTimeout(180000)
  const aliceContext = await browser.newContext({
    baseURL: base,
    viewport: { width: 1440, height: 1000 },
  })
  const bobContext = await browser.newContext({ baseURL: base })
  const clientContext = await browser.newContext({ baseURL: base })
  const anonymous = await browser.newContext({ baseURL: base })
  contexts.push(aliceContext, bobContext, clientContext, anonymous)
  const alice = await account(aliceContext, 'Library Admin Alice', true)
  await account(bobContext, 'Library Admin Bob', true)
  await account(clientContext, 'Library Client', false)
  const a = await aliceContext.newPage(),
    b = await bobContext.newPage()
  const errors: string[] = []
  // Isolate player UI checks from external platform availability. The real
  // preview endpoint still validates the saved entry and the admin session.
  for (const page of [a, b]) {
    await page.route('https://www.instagram.com/**/embed/', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<html><body style="background:#faf8f5;display:grid;place-items:center;height:90vh;font:16px sans-serif">Instagram player fixture</body></html>',
      }),
    )
    await page.route('https://www.tiktok.com/player/v1/**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<html><body style="background:#111;color:white;display:grid;place-items:center;height:90vh;font:16px sans-serif">TikTok player fixture<button onclick="parent.postMessage({'x-tiktok-player':true,type:'onPlayerError',value:{errorCode:1001}}, '*')">Simulate unavailable video</button></body></html>`,
      }),
    )
    await page.route('https://www.youtube.com/embed/**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<html><body>YouTube player fixture</body></html>',
      }),
    )
  }
  a.on('pageerror', (error) => errors.push(error.message))
  b.on('pageerror', (error) => errors.push(error.message))
  for (const page of [a, b])
    page.on('websocket', (socket) => {
      if (!socket.url().includes('/api/admin/live')) return
      socket.on('framereceived', (frame) => {
        const message = JSON.parse(String(frame.payload))
        if (message.type === 'error') errors.push(message.message)
      })
    })
  const clientPage = await clientContext.newPage(),
    anonymousPage = await anonymous.newPage()
  await clientPage.goto('/admin/library')
  await expect(clientPage).toHaveURL(/\/(portal|onboarding)/)
  await anonymousPage.goto('/admin/library')
  await expect(anonymousPage).toHaveURL(/\/admin\/login/)
  await Promise.all([a.goto('/admin/library'), b.goto('/admin/library')])
  await Promise.all([waitForHydration(a), waitForHydration(b)])
  for (const page of [a, b]) {
    await expect(page.getByRole('link', { name: 'Content library', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(page.locator('.library-live')).toHaveText('Live shared library')
  }
  const suffix = randomUUID().replaceAll('-', '')
  const instagram = `https://www.instagram.com/reel/LibraryTest${suffix}/`
  const tiktokId = (7000000000000000000n + BigInt(`0x${suffix.slice(0, 15)}`)).toString()
  const tiktok = `https://www.tiktok.com/@library_test/video/${tiktokId}/`
  urls.push(instagram, tiktok)
  const title = `Hook inspiration ${suffix.slice(0, 8)}`
  const updated = `${title} updated`
  const second = `Filming style ${suffix.slice(0, 8)}`
  const request = await save(a, title, `${instagram}?igsh=tracking`, 'Notice the opening question.')
  await expect(b.getByRole('heading', { name: title, exact: true })).toBeVisible({ timeout: 5000 })
  const entry = await db.contentLibraryEntry.findUniqueOrThrow({
    where: { libraryId_url: { libraryId: 'main', url: instagram } },
  })
  const card = (page: Page) => page.locator(`[data-library-id="${entry.id}"]`)
  await expect(card(b).getByRole('link', { name: /Open on Instagram/ })).toHaveAttribute(
    'href',
    instagram,
  )
  await expect(card(b).getByRole('link', { name: /Open on Instagram/ })).toHaveAttribute(
    'target',
    '_blank',
  )
  await expect(a.locator('iframe')).toHaveCount(0)
  const previewRequest = a.waitForRequest(
    (request) =>
      request.method() === 'GET' &&
      request.url().includes('/_serverFn/') &&
      decodeURIComponent(request.url()).includes(entry.id),
  )
  await card(a)
    .getByRole('button', { name: `Preview ${title}`, exact: true })
    .click()
  const previewRead = await previewRequest
  const instagramEmbed = `${instagram}embed/`
  await expect(a.getByRole('dialog').locator('iframe')).toHaveAttribute('src', instagramEmbed)
  await expect(
    a.getByRole('dialog').getByRole('link', { name: /Open on Instagram/ }),
  ).toHaveAttribute('href', instagram)
  await a.getByRole('dialog').screenshot({ path: 'test-results/library-preview-desktop.png' })
  await a.keyboard.press('Escape')
  await expect(a.getByRole('dialog')).not.toBeVisible()
  await expect(a.locator('iframe')).toHaveCount(0)
  const previewAs = (context: BrowserContext) =>
    context.request.get(previewRead.url(), { headers: { Origin: base, 'x-tsr': 'serverFn' } })
  for (const context of [clientContext, anonymous])
    expect(await (await previewAs(context)).text()).not.toContain(instagramEmbed)
  await replay(clientContext, request)
  await replay(anonymous, request)
  expect((await replay(aliceContext, request, 'https://untrusted.example')).status()).toBe(403)
  expect(await db.contentLibraryEntry.count({ where: { url: instagram } })).toBe(1)

  // Open a draft while another admin adds an unrelated reference.
  await a.getByRole('button', { name: `Edit ${title}`, exact: true }).click()
  await a.getByLabel('Title (optional)', { exact: true }).fill(updated)
  await save(b, second, tiktok, 'Try this camera angle.')
  await expect(a.getByRole('heading', { name: second, exact: true })).toBeAttached({
    timeout: 5000,
  })
  await expect(a.getByLabel('Title (optional)', { exact: true })).toHaveValue(updated)
  await a.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(a.getByRole('dialog')).not.toBeVisible()
  await expect(b.getByRole('heading', { name: updated, exact: true })).toBeVisible({
    timeout: 5000,
  })
  await a.getByRole('button', { name: `Preview ${second}`, exact: true }).click()
  const tiktokFrame = a.getByRole('dialog').locator('iframe')
  await expect(tiktokFrame).toHaveAttribute(
    'src',
    `https://www.tiktok.com/player/v1/${tiktokId}?autoplay=0&rel=0`,
  )
  // Messages from the parent page cannot impersonate the embedded player.
  await a.evaluate(() =>
    window.postMessage({ 'x-tiktok-player': true, type: 'onPlayerError' }, '*'),
  )
  await expect(tiktokFrame).toBeVisible()
  await a.getByRole('dialog').screenshot({ path: 'test-results/library-preview-tiktok.png' })
  await a
    .frameLocator('.library-preview-frame iframe')
    .getByRole('button', { name: 'Simulate unavailable video' })
    .click()
  await expect(a.getByRole('dialog').getByRole('status')).toContainText(
    'cannot play this video here',
  )
  await expect(a.getByRole('dialog').locator('iframe')).toHaveCount(0)
  await expect(a.getByRole('dialog').getByRole('link', { name: /Open on TikTok/ })).toHaveAttribute(
    'href',
    tiktok,
  )
  await a.getByRole('button', { name: 'Close dialog', exact: true }).click()

  // Each additional platform persists, appears for another admin, and filters independently.
  const youtubeId = suffix.slice(0, 11)
  const additions = [
    {
      platform: 'FACEBOOK',
      label: 'Facebook',
      url: `https://www.facebook.com/watch/?v=${tiktokId}`,
      input: `https://m.facebook.com/watch/?v=${tiktokId}&mibextid=tracking`,
    },
    {
      platform: 'YOUTUBE',
      label: 'YouTube',
      url: `https://www.youtube.com/watch?v=${youtubeId}`,
      input: `https://youtu.be/${youtubeId}?si=tracking`,
    },
    {
      platform: 'TWITTER',
      label: 'Twitter / X',
      url: `https://x.com/library_test/status/${tiktokId}`,
      input: `https://twitter.com/library_test/status/${tiktokId}?s=20`,
    },
    {
      platform: 'LINKEDIN',
      label: 'LinkedIn',
      url: `https://www.linkedin.com/feed/update/urn:li:activity:${tiktokId}/`,
      input: `https://www.linkedin.com/feed/update/urn:li:activity:${tiktokId}/?utm_source=share`,
    },
  ]
  urls.push(...additions.map((item) => item.url))
  for (const item of additions) {
    const savedTitle = `${item.label} reference ${suffix.slice(0, 8)}`
    await save(
      a,
      item.platform === 'LINKEDIN' ? '' : savedTitle,
      item.input,
      'A fresh angle to try.',
    )
    const saved = await db.contentLibraryEntry.findUniqueOrThrow({
      where: { libraryId_url: { libraryId: 'main', url: item.url } },
    })
    expect(saved.platform).toBe(item.platform)
    expect(saved.title).toBe(item.platform === 'LINKEDIN' ? 'LinkedIn inspiration' : savedTitle)
    const savedCard = a.locator(`[data-library-id="${saved.id}"]`)
    await expect(b.locator(`[data-library-id="${saved.id}"]`)).toContainText(saved.title, {
      timeout: 5000,
    })
    await expect(savedCard.locator('.library-platform svg')).toHaveCount(1)
    await expect(
      savedCard.getByRole('link', { name: `Open on ${item.label}`, exact: false }),
    ).toHaveAttribute('href', item.url)
    await a
      .getByRole('group', { name: 'Filter by platform' })
      .getByRole('button', { name: item.label, exact: true })
      .click()
    await expect(savedCard).toBeVisible()
    await expect(card(a)).toHaveCount(0)
    if (item.platform === 'YOUTUBE') {
      await savedCard.getByRole('button', { name: `Preview ${saved.title}`, exact: true }).click()
      await expect(a.getByRole('dialog').locator('iframe')).toHaveAttribute(
        'src',
        `https://www.youtube.com/embed/${youtubeId}?autoplay=0&rel=0`,
      )
      await expect(
        a.getByRole('dialog').getByRole('link', { name: /Open on YouTube/ }),
      ).toHaveAttribute('href', item.url)
      await a.getByRole('button', { name: 'Close dialog', exact: true }).click()
    } else
      await expect(
        savedCard.getByRole('button', { name: `Preview ${saved.title}`, exact: true }),
      ).toHaveCount(0)
    await a
      .getByRole('group', { name: 'Filter by platform' })
      .getByRole('button', { name: 'All', exact: true })
      .click()
  }

  // Validation and duplicate detection preserve the existing shared entry.
  await a.getByRole('button', { name: 'Save link', exact: true }).click()
  await a.getByLabel('Content link', { exact: true }).fill('https://www.instagram.com/profile/')
  await a.getByRole('dialog').getByRole('button', { name: 'Save link', exact: true }).click()
  await expect(a.getByRole('dialog').getByRole('alert')).toContainText('video link')
  await a.getByLabel('Content link', { exact: true }).fill(`${instagram}?utm_source=another`)
  await a.getByRole('dialog').getByRole('button', { name: 'Save link', exact: true }).click()
  await expect(a.getByRole('dialog').getByRole('alert')).toContainText('already in the library')
  await a.getByRole('button', { name: 'Cancel', exact: true }).click()
  await a
    .getByRole('group', { name: 'Filter by platform' })
    .getByRole('button', { name: 'TikTok', exact: true })
    .click()
  await expect(a.getByRole('heading', { name: second, exact: true })).toBeVisible()
  await expect(a.getByRole('heading', { name: updated, exact: true })).toHaveCount(0)
  await a
    .getByRole('group', { name: 'Filter by platform' })
    .getByRole('button', { name: 'All', exact: true })
    .click()
  await a.getByLabel('Search library', { exact: true }).fill('opening question')
  await expect(a.getByRole('heading', { name: updated, exact: true })).toBeVisible()
  await expect(a.getByRole('heading', { name: second, exact: true })).toHaveCount(0)
  await a.getByLabel('Search library', { exact: true }).fill('')

  // Same-entry edits cannot silently overwrite another admin's changes.
  await a.getByRole('button', { name: `Edit ${updated}`, exact: true }).click()
  await a.getByLabel('Notes (optional)', { exact: true }).fill('My unsaved local notes.')
  await b.getByRole('button', { name: `Edit ${updated}`, exact: true }).click()
  await b.getByLabel('Notes (optional)', { exact: true }).fill('Shared notes from Bob.')
  await b.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(b.getByRole('dialog')).not.toBeVisible()
  await a.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(a.getByRole('dialog').getByRole('alert')).toContainText('edited by another admin')
  await expect(a.getByLabel('Notes (optional)', { exact: true })).toHaveValue(
    'My unsaved local notes.',
  )
  await a.getByRole('button', { name: 'Cancel', exact: true }).click()
  await a.reload()
  await waitForHydration(a)
  await expect(a.locator('.library-live')).toHaveText('Live shared library')
  await expect(card(a)).toContainText('Shared notes from Bob.')
  await a.screenshot({ path: 'test-results/content-library-desktop.png', fullPage: true })
  await a.setViewportSize({ width: 390, height: 844 })
  await a.getByRole('link', { name: 'Content library', exact: true }).scrollIntoViewIfNeeded()
  await expect(a.getByRole('link', { name: 'Content library', exact: true })).toBeInViewport()
  expect(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  for (const item of additions) {
    const filter = a
      .getByRole('group', { name: 'Filter by platform' })
      .getByRole('button', { name: item.label, exact: true })
    await expect(filter).toBeVisible()
    expect(
      await filter.evaluate((element) => element.getBoundingClientRect().right <= innerWidth),
    ).toBe(true)
  }
  await a.screenshot({ path: 'test-results/content-library-mobile.png', fullPage: true })
  await a.getByRole('button', { name: `Preview ${updated}`, exact: true }).click()
  await expect(a.getByRole('dialog').locator('iframe')).toHaveAttribute('src', instagramEmbed)
  expect(
    await a.getByRole('dialog').evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true)
  await a.getByRole('dialog').screenshot({ path: 'test-results/library-preview-mobile.png' })
  await a.getByRole('button', { name: 'Close dialog', exact: true }).click()

  await a.getByRole('button', { name: `Delete ${updated}`, exact: true }).click()
  await a.getByRole('button', { name: 'Keep link', exact: true }).click()
  expect(await db.contentLibraryEntry.count({ where: { id: entry.id } })).toBe(1)
  const beforeDeletion = await db.contentLibraryEntry.findUniqueOrThrow({ where: { id: entry.id } })
  await a.getByRole('button', { name: `Delete ${updated}`, exact: true }).click()
  const deletion = a.waitForRequest(
    (request) => request.method() === 'POST' && request.url().includes('/_serverFn/'),
  )
  await a.getByRole('button', { name: 'Delete link', exact: true }).click()
  const deleteRequest = await deletion
  await expect(a.getByRole('dialog')).not.toBeVisible()
  await expect(b.getByRole('heading', { name: updated, exact: true })).toHaveCount(0, {
    timeout: 5000,
  })
  await db.contentLibraryEntry.create({ data: beforeDeletion })
  await replay(clientContext, deleteRequest)
  await replay(anonymous, deleteRequest)
  expect(await db.contentLibraryEntry.count({ where: { id: entry.id } })).toBe(1)
  await db.user.update({ where: { id: alice.id }, data: { role: 'CLIENT' } })
  expect(await (await previewAs(aliceContext)).text()).not.toContain(instagramEmbed)
  await replay(aliceContext, deleteRequest)
  expect(await db.contentLibraryEntry.count({ where: { id: entry.id } })).toBe(1)
  await b.reload()
  await waitForHydration(b)
  for (const savedTitle of [updated, second]) {
    await b.getByRole('button', { name: `Delete ${savedTitle}`, exact: true }).click()
    await b.getByRole('button', { name: 'Delete link', exact: true }).click()
    await expect(b.getByRole('dialog')).not.toBeVisible()
  }
  expect(errors).toEqual([])
})
