import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { randomUUID, createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { db } from '../../scripts/db'
import { MEDIA_PART_SIZE, MEDIA_THUMBNAIL_MAX_BYTES } from '../../src/lib/media-validation'
import { waitForHydration } from './hydration'
const base = process.env.TEST_BASE_URL || 'http://localhost:3000'
const contexts: BrowserContext[] = [],
  emails: string[] = [],
  assetIds: string[] = [],
  cardIds: string[] = []
let cleanupContext: BrowserContext
async function account(context: BrowserContext, name: string, admin = true) {
  const email = `media-test-${randomUUID()}@example.com`
  emails.push(email)
  const response = await context.request.post('/api/auth/sign-up/email', {
    data: { name, email, password: `Private-${randomUUID()}!` },
    headers: { Origin: base },
  })
  expect(response.ok(), await response.text()).toBe(true)
  return db.user.update({ where: { email }, data: { role: admin ? 'ADMIN' : 'CLIENT' } })
}
const action = (context: BrowserContext, data: unknown, origin = base) =>
  context.request.post('/api/admin/media', { data, headers: { Origin: origin } })
const clip = (page: Page, id: string) => page.locator(`[data-media-id="${id}"]`)
function trackUploads(page: Page) {
  page.on('request', (request) => {
    if (request.method() !== 'POST' || !request.url().endsWith('/api/admin/media')) return
    try {
      const data = request.postDataJSON()
      if (data.action === 'start' && typeof data.id === 'string') assetIds.push(data.id)
    } catch {
      /* Only the known JSON upload endpoint is tracked. */
    }
  })
}
test.afterAll(async () => {
  if (cleanupContext)
    for (const id of assetIds) {
      const asset = await db.mediaAsset.findUnique({ where: { id } })
      if (asset)
        await action(
          cleanupContext,
          asset.status === 'READY' || asset.status === 'DELETING'
            ? { action: 'delete', id, expectedUpdatedAt: asset.updatedAt.toISOString() }
            : { action: 'abort', id },
        )
    }
  await Promise.all(contexts.map((context) => context.close()))
  await db.contentIdea.deleteMany({ where: { id: { in: cardIds } } })
  await db.user.deleteMany({ where: { email: { in: emails } } })
  await db.$disconnect()
})

test('admins upload, resume, organize, preview and download shared originals with live access controls', async ({
  browser,
}) => {
  test.setTimeout(240000)
  const alice = await browser.newContext({ baseURL: base, viewport: { width: 1440, height: 1000 } })
  const bob = await browser.newContext({ baseURL: base, viewport: { width: 1440, height: 1000 } })
  const client = await browser.newContext({ baseURL: base }),
    anonymous = await browser.newContext({ baseURL: base })
  contexts.push(alice, bob, client, anonymous)
  cleanupContext = bob
  const aliceUser = await account(alice, 'Media Admin Alice')
  await account(bob, 'Media Admin Bob')
  await account(client, 'Media Client', false)
  const a = await alice.newPage(),
    b = await bob.newPage()
  trackUploads(a)
  const errors: string[] = []
  a.on('pageerror', (error) => errors.push(error.message))
  b.on('pageerror', (error) => errors.push(error.message))
  const card = await db.contentIdea.create({
    data: { title: `Media exercise demo ${randomUUID()}`, position: 9999 },
  })
  cardIds.push(card.id)
  await Promise.all([a.goto('/admin/media'), b.goto('/admin/media')])
  await Promise.all([waitForHydration(a), waitForHydration(b)])
  await expect(a.locator('.media-live')).toHaveText('Live shared media')
  const clientPage = await client.newPage(),
    anonPage = await anonymous.newPage()
  await clientPage.goto('/admin/media')
  await expect(clientPage).toHaveURL(/\/(portal|onboarding)/)
  await anonPage.goto('/admin/media')
  await expect(anonPage).toHaveURL(/\/admin\/login/)
  // Block the second chunk to prove an interrupted upload can resume after a reload.
  const fixture = await readFile(resolve('tests/fixtures/shared-media.mp4'))
  const buffer = Buffer.concat([fixture, Buffer.alloc(MEDIA_PART_SIZE + 4096 - fixture.length)])
  const filename = `Media-test-${randomUUID()}.mp4`,
    title = filename.replace('.mp4', '')
  const path = resolve('test-results', filename)
  await mkdir(resolve('test-results'), { recursive: true })
  await writeFile(path, buffer)
  let firstParts = 0
  await a.route('**/api/admin/media/*?part=*', async (route) => {
    if (route.request().url().endsWith('part=1')) {
      firstParts++
      await route.continue()
    } else {
      // With parallel chunks, wait for the first persisted part before forcing
      // the second to fail, so this tests resume rather than cancelling both.
      await expect
        .poll(async () => {
          const asset = await db.mediaAsset.findFirst({ where: { filename } })
          return asset ? db.mediaUploadPart.count({ where: { assetId: asset.id } }) : 0
        })
        .toBe(1)
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Simulated connection interruption' }),
      })
    }
  })
  await a.getByLabel('Upload video clips').setInputFiles(path)
  await expect(a.getByRole('button', { name: 'Resume', exact: true })).toBeVisible({
    timeout: 30000,
  })
  const upload = await db.mediaAsset.findFirstOrThrow({ where: { filename } })
  assetIds.push(upload.id)
  expect(await db.mediaUploadPart.count({ where: { assetId: upload.id } })).toBe(1)
  await a.unroute('**/api/admin/media/*?part=*')
  await a.reload()
  await waitForHydration(a)
  await a.route('**/api/admin/media/*?part=1', async (route) => {
    firstParts++
    await route.continue()
  })
  await a.getByRole('button', { name: 'Resume', exact: true }).click()
  await a.getByLabel('Reselect original clip').setInputFiles(path)
  await expect(clip(a, upload.id)).toBeVisible({ timeout: 30000 })
  await expect(clip(b, upload.id)).toBeVisible({ timeout: 5000 })
  expect(firstParts).toBe(1)
  await a.unroute('**/api/admin/media/*?part=1')
  const saved = await db.mediaAsset.findUniqueOrThrow({ where: { id: upload.id } })
  expect(saved.status).toBe('READY')
  expect(saved.uploadId).toBeNull()
  const thumbnailUrl = `/api/admin/media/${saved.id}?thumbnail`
  await expect(clip(b, saved.id).locator('.media-thumbnail img')).toBeVisible({ timeout: 30000 })
  await expect.poll(async () => (await bob.request.head(thumbnailUrl)).status()).toBe(200)
  const thumbnail = await bob.request.get(thumbnailUrl)
  expect(thumbnail.headers()['content-type']).toBe('image/jpeg')
  expect(thumbnail.headers()['cache-control']).toContain('no-store')
  const thumbnailBytes = await thumbnail.body()
  expect(thumbnailBytes.length).toBeGreaterThan(100)
  expect(thumbnailBytes.length).toBeLessThanOrEqual(MEDIA_THUMBNAIL_MAX_BYTES)
  expect([...thumbnailBytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff])
  // A fresh visit uses the shared JPEG without fetching/decoding the original again.
  let coverOriginalRequests = 0
  await b.route(`**/api/admin/media/${saved.id}`, async (route) => {
    coverOriginalRequests++
    await route.abort()
  })
  await b.reload()
  await waitForHydration(b)
  await expect
    .poll(() =>
      clip(b, saved.id)
        .locator('.media-thumbnail img')
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0)
  expect(coverOriginalRequests).toBe(0)
  await b.unroute(`**/api/admin/media/${saved.id}`)
  expect(
    (
      await bob.request.put(thumbnailUrl, {
        data: thumbnailBytes,
        headers: { Origin: 'https://evil.test', 'Content-Type': 'image/jpeg' },
      })
    ).status(),
  ).toBe(403)
  expect(
    (
      await bob.request.put(thumbnailUrl, {
        data: Buffer.from('invalid'),
        headers: { Origin: base, 'Content-Type': 'image/jpeg' },
      })
    ).status(),
  ).toBe(400)
  expect(
    (
      await bob.request.put(thumbnailUrl, {
        data: Buffer.alloc(MEDIA_THUMBNAIL_MAX_BYTES + 1),
        headers: { Origin: base, 'Content-Type': 'image/jpeg' },
      })
    ).status(),
  ).toBe(413)
  const downloaded = await bob.request.get(`/api/admin/media/${saved.id}?download`)
  expect(downloaded.status()).toBe(200)
  expect(downloaded.headers()['content-disposition']).toContain('attachment')
  expect(downloaded.headers()['cache-control']).toContain('no-store')
  expect(
    createHash('sha256')
      .update(await downloaded.body())
      .digest('hex'),
  ).toBe(createHash('sha256').update(buffer).digest('hex'))
  const ranged = await bob.request.get(`/api/admin/media/${saved.id}`, {
    headers: { Range: 'bytes=10-19' },
  })
  expect(ranged.status()).toBe(206)
  expect(ranged.headers()['content-range']).toBe(`bytes 10-19/${buffer.length}`)
  expect(await ranged.body()).toEqual(buffer.subarray(10, 20))
  expect((await bob.request.head(`/api/admin/media/${saved.id}`)).headers()['content-length']).toBe(
    String(buffer.length),
  )
  expect(
    (
      await bob.request.get(`/api/admin/media/${saved.id}`, {
        headers: { Range: `bytes=${buffer.length}-` },
      })
    ).status(),
  ).toBe(416)
  for (const context of [client, anonymous]) {
    expect((await context.request.get(thumbnailUrl)).status()).toBe(context === client ? 403 : 401)
    expect(
      (
        await context.request.put(thumbnailUrl, {
          data: thumbnailBytes,
          headers: { Origin: base, 'Content-Type': 'image/jpeg' },
        })
      ).status(),
    ).toBe(context === client ? 403 : 401)
    expect((await context.request.get(`/api/admin/media/${saved.id}`)).status()).toBe(
      context === client ? 403 : 401,
    )
    expect((await action(context, { action: 'complete', id: saved.id })).status()).toBe(
      context === client ? 403 : 401,
    )
    expect(
      (
        await context.request.put(`/api/admin/media/${saved.id}?part=1`, {
          data: Buffer.from('x'),
          headers: { Origin: base },
        })
      ).status(),
    ).toBe(context === client ? 403 : 401)
  }
  expect(
    (
      await action(
        bob,
        { action: 'delete', id: saved.id, expectedUpdatedAt: saved.updatedAt.toISOString() },
        'https://evil.test',
      )
    ).status(),
  ).toBe(403)
  // Native playback really loads the stored file, including byte-range seeking.
  await clip(b, saved.id)
    .getByRole('button', { name: `Preview ${title}` })
    .click()
  await expect(b.locator('video')).toBeVisible()
  await expect
    .poll(() => b.locator('video').evaluate((video: HTMLVideoElement) => video.readyState))
    .toBeGreaterThanOrEqual(2)
  await b.locator('video').evaluate((video: HTMLVideoElement) => {
    video.currentTime = 1
  })
  await expect
    .poll(() => b.locator('video').evaluate((video: HTMLVideoElement) => video.currentTime))
    .toBeGreaterThanOrEqual(1)
  await b.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await expect(b.locator('video')).toHaveCount(0)
  // An open draft must survive another admin editing the same asset.
  await clip(a, saved.id)
    .getByRole('button', { name: `Edit ${title}` })
    .click()
  await a.getByLabel('Clip title', { exact: true }).fill(`${title} local draft`)
  await clip(b, saved.id)
    .getByRole('button', { name: `Edit ${title}` })
    .click()
  await b.getByLabel('Clip title', { exact: true }).fill(`${title} organized`)
  await b.getByLabel('Category', { exact: true }).selectOption('DEMOS')
  await b.getByLabel('Tags', { exact: true }).fill('squat, Strength, strength')
  await b.getByLabel('Production card', { exact: true }).selectOption(card.id)
  await b.getByLabel('Notes', { exact: true }).fill('A useful exercise demonstration.')
  await b.getByRole('button', { name: 'Save details', exact: true }).click()
  await expect(b.getByRole('dialog')).not.toBeVisible()
  await expect(clip(a, saved.id).getByRole('heading')).toHaveText(`${title} organized`, {
    timeout: 5000,
  })
  await expect(a.getByLabel('Clip title', { exact: true })).toHaveValue(`${title} local draft`)
  await a.getByRole('button', { name: 'Save details', exact: true }).click()
  await expect(a.getByRole('alert')).toContainText('Another admin changed this clip')
  await expect(a.getByLabel('Clip title', { exact: true })).toHaveValue(`${title} local draft`)
  await a.getByRole('button', { name: 'Close dialog', exact: true }).click()
  const organized = await db.mediaAsset.findUniqueOrThrow({ where: { id: saved.id } })
  expect(organized.tags).toEqual(['squat', 'strength'])
  expect(organized.cardId).toBe(card.id)
  await b.getByLabel('Search shared media').fill('squat')
  await expect(clip(b, saved.id)).toBeVisible()
  await b.getByRole('button', { name: /^Raw footage/ }).click()
  await expect(clip(b, saved.id)).toHaveCount(0)
  await b.getByRole('button', { name: /^Exercise demos/ }).click()
  await expect(clip(b, saved.id)).toBeVisible()
  await b.getByLabel('Search shared media').fill('')
  await b.getByLabel('Filter by production card').selectOption(card.id)
  await expect(clip(b, saved.id)).toBeVisible()
  await b.setViewportSize({ width: 390, height: 844 })
  await expect(b.getByRole('link', { name: 'Shared media', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  expect(await b.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await b.screenshot({ path: 'test-results/shared-media-mobile.png', fullPage: true })
  await b.setViewportSize({ width: 1440, height: 1000 })
  await b.screenshot({ path: 'test-results/shared-media-desktop.png', fullPage: true })
  // Deleting a production card or the uploading account never deletes shared footage.
  await db.contentIdea.delete({ where: { id: card.id } })
  await db.user.delete({ where: { id: aliceUser.id } })
  expect((await bob.request.get(`/api/admin/media/${saved.id}`)).status()).toBe(200)
  expect((await alice.request.get(`/api/admin/media/${saved.id}`)).status()).toBe(401)
  await b.getByLabel('Filter by production card').selectOption('ALL')
  await clip(b, saved.id)
    .getByRole('button', { name: `Delete ${title} organized` })
    .click()
  await b.getByRole('button', { name: 'Delete clip', exact: true }).click()
  await expect(b.getByRole('dialog')).not.toBeVisible()
  await expect(clip(b, saved.id)).toHaveCount(0)
  expect(await db.mediaAsset.findUnique({ where: { id: saved.id } })).toBeNull()
  expect((await bob.request.get(`/api/admin/media/${saved.id}`)).status()).toBe(404)
  expect((await bob.request.get(thumbnailUrl)).status()).toBe(404)
  expect(
    (
      await bob.request.put(thumbnailUrl, {
        data: thumbnailBytes,
        headers: { Origin: base, 'Content-Type': 'image/jpeg' },
      })
    ).status(),
  ).toBe(404)
  expect(errors).toEqual([])
  await rm(path, { force: true })
})

test('multipart lifecycle is idempotent, validates sizes, and cancels incomplete uploads', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: base })
  contexts.push(context)
  cleanupContext = context
  await account(context, 'Media Lifecycle Admin')
  const id = randomUUID()
  assetIds.push(id)
  const data = {
    action: 'start',
    id,
    filename: 'lifecycle.mp4',
    size: 8,
    lastModified: 1,
    title: 'Lifecycle test',
    notes: '',
    category: 'RAW',
    tags: [],
    cardId: null,
  }
  for (let attempt = 0; attempt < 2; attempt++)
    expect((await action(context, data)).ok()).toBe(true)
  expect((await action(context, { ...data, size: 9 })).status()).toBe(409)
  expect((await action(context, { action: 'complete', id })).status()).toBe(409)
  expect((await context.request.get(`/api/admin/media/${id}`)).status()).toBe(404)
  expect(
    (
      await context.request.put(`/api/admin/media/${id}?part=1`, {
        data: Buffer.alloc(9),
        headers: { Origin: base },
      })
    ).status(),
  ).toBe(400)
  expect(
    (
      await context.request.put(`/api/admin/media/${id}?part=2`, {
        data: Buffer.alloc(8),
        headers: { Origin: base },
      })
    ).status(),
  ).toBe(400)
  expect(
    (
      await context.request.put(`/api/admin/media/${id}?part=1`, {
        data: Buffer.alloc(8),
        headers: { Origin: base },
      })
    ).ok(),
  ).toBe(true)
  expect((await action(context, { action: 'abort', id })).ok()).toBe(true)
  expect(await db.mediaAsset.findUnique({ where: { id } })).toBeNull()
  expect((await action(context, { action: 'complete', id })).status()).toBe(404)
})

test('multiple selections share a two-file queue and queued clips can be cancelled', async ({
  browser,
}) => {
  test.setTimeout(90000)
  const context = await browser.newContext({ baseURL: base })
  contexts.push(context)
  cleanupContext = context
  await account(context, 'Media Queue Admin')
  const page = await context.newPage()
  trackUploads(page)
  await page.goto('/admin/media')
  await waitForHydration(page)
  const fixture = await readFile(resolve('tests/fixtures/shared-media.mp4'))
  const suffix = randomUUID()
  const names = ['first', 'second', 'cancelled', 'broll'].map(
    (label) => `queue-${label}-${suffix}.mp4`,
  )
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let active = 0,
    peak = 0
  await page.route('**/api/admin/media/*?part=*', async (route) => {
    active++
    peak = Math.max(peak, active)
    await gate
    try {
      await route.continue()
    } finally {
      active--
    }
  })
  try {
    await page
      .getByLabel('Upload video clips')
      .setInputFiles(
        names.slice(0, 2).map((name) => ({ name, mimeType: 'video/mp4', buffer: fixture })),
      )
    await expect.poll(() => active).toBe(2)
    await page
      .getByLabel('Upload video clips')
      .setInputFiles({ name: names[2], mimeType: 'video/mp4', buffer: fixture })
    await expect(page.getByText('Queued — waiting to upload', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: `Cancel ${names[2]}`, exact: true }).click()
    await expect(page.getByText(names[2], { exact: true })).toHaveCount(0)
    await page.getByLabel('Upload category').selectOption('BROLL')
    await page
      .getByLabel('Upload video clips')
      .setInputFiles({ name: names[3], mimeType: 'video/mp4', buffer: fixture })
    await expect(page.getByText('Queued — waiting to upload', { exact: true })).toBeVisible()
  } finally {
    release()
  }
  await expect(page.locator('.media-card').filter({ hasText: suffix })).toHaveCount(3, {
    timeout: 30000,
  })
  const saved = await db.mediaAsset.findMany({ where: { filename: { in: names } } })
  assetIds.push(...saved.map((asset) => asset.id))
  expect(saved).toHaveLength(3)
  expect(saved.find((asset) => asset.filename === names[3])?.category).toBe('BROLL')
  expect(peak).toBe(2)
  for (const asset of saved) {
    // Finalization is safe to retry after losing the successful response.
    expect((await action(context, { action: 'complete', id: asset.id })).ok()).toBe(true)
    expect((await action(context, { action: 'abort', id: asset.id })).status()).toBe(409)
  }
})
