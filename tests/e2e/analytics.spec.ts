import { test, expect, type BrowserContext, type Request } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { db } from '../../scripts/db'
import { coachingAnalyticsAccounts } from '../../src/lib/analytics-accounts'
import { waitForHydration } from './hydration'

const base = process.env.TEST_BASE_URL || 'http://localhost:3000'
const emails: string[] = [],
  titles: string[] = [],
  contexts: BrowserContext[] = []
// This suite writes fixtures only in a dedicated loopback database.
test.skip(
  !process.env.DATABASE_URL ||
    !['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL!).hostname),
  'Use a local analytics test database.',
)
test.afterAll(async () => {
  await Promise.all(contexts.map((context) => context.close()))
  if (titles.length)
    await db.analyticsItem.deleteMany({
      where: { OR: titles.map((title) => ({ payload: { path: ['title'], equals: title } })) },
    })
  if (emails.length) await db.user.deleteMany({ where: { email: { in: emails } } })
  await db.$disconnect()
})
async function account(context: BrowserContext, admin: boolean) {
  const email = `analytics-test-${randomUUID()}@example.com`
  emails.push(email)
  const response = await context.request.post('/api/auth/sign-up/email', {
    headers: { Origin: base },
    data: { name: 'Analytics Test', email, password: `Test-${randomUUID()}!` },
  })
  expect(response.ok(), await response.text()).toBe(true)
  return db.user.update({ where: { email }, data: { role: admin ? 'ADMIN' : 'CLIENT' } })
}
async function replay(context: BrowserContext, sent: Request, origin = base) {
  return context.request.post(sent.url(), {
    data: sent.postData(),
    maxRedirects: 0,
    headers: {
      'Content-Type': sent.headers()['content-type'],
      'x-tsr': 'serverFn',
      Origin: origin,
      ...(origin !== base ? { 'Sec-Fetch-Site': 'cross-site' } : {}),
    },
  })
}

test('admin analytics persists history, creator assignment, CSV, archiving and daily settings with private access and responsive layouts', async ({
  browser,
}) => {
  test.setTimeout(180000)
  const admin = await browser.newContext({ baseURL: base, viewport: { width: 1440, height: 1050 } })
  const client = await browser.newContext({ baseURL: base }),
    anonymous = await browser.newContext({ baseURL: base })
  contexts.push(admin, client, anonymous)
  const user = await account(admin, true)
  await account(client, false)
  const page = await admin.newPage(),
    errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/admin/analytics')
  await waitForHydration(page)
  await expect(page.getByRole('link', { name: 'Analytics', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(page.getByText('A clearer picture.')).toBeVisible()
  const creatorTitle = `Creator Test ${randomUUID().slice(0, 8)}`
  const campaignTitle = `Campaign Test ${randomUUID().slice(0, 8)}`
  titles.push(creatorTitle, campaignTitle)
  await page.getByRole('tab', { name: 'Creators', exact: true }).click()
  await page.getByRole('button', { name: 'Add creator', exact: true }).click()
  await page.getByLabel('Creator name').fill(creatorTitle)
  await page.getByLabel('Estimated earnings per 1,000 views (USD)').fill('5')
  await page.getByRole('dialog').getByRole('button', { name: 'Start tracking' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.getByRole('tab', { name: 'Campaigns', exact: true }).click()
  await page.getByRole('button', { name: 'New campaign', exact: true }).first().click()
  await page.getByLabel('Campaign name').fill(campaignTitle)
  await page.getByLabel('Campaign budget (USD)').fill('20')
  await page.getByRole('dialog').getByRole('button', { name: 'Start tracking' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  const title = `Strength Test ${randomUUID().slice(0, 8)}`
  titles.push(title)
  const url = `https://www.instagram.com/p/Test${randomUUID().replaceAll('-', '').slice(0, 16)}/`
  await page.getByRole('button', { name: 'Track a video', exact: true }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('Published post URL').fill(url)
  await dialog.getByLabel('Title', { exact: true }).fill(title)
  await dialog
    .getByRole('combobox', { name: 'Creator', exact: true })
    .selectOption({ label: creatorTitle })
  await dialog
    .getByRole('combobox', { name: 'Campaign', exact: true })
    .selectOption({ label: campaignTitle })
  await dialog.getByLabel('Tags', { exact: true }).fill('Strength, Nutrition')
  await dialog.getByLabel('Notes').fill('A useful strength tutorial.')
  const sending = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().includes('/_serverFn/'),
  )
  await dialog.getByRole('button', { name: 'Start tracking', exact: true }).click()
  const mutation = await sending
  await expect(dialog).not.toBeVisible()
  await page.getByRole('tab', { name: /Videos/ }).click()
  await page.getByRole('button', { name: new RegExp(title) }).click()
  await page.getByRole('button', { name: 'Record snapshot', exact: true }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('Views', { exact: true }).fill('1000')
  await dialog.getByLabel('Likes', { exact: true }).fill('100')
  await dialog.getByLabel('Comments', { exact: true }).fill('10')
  await dialog.getByRole('button', { name: 'Save snapshot', exact: true }).click()
  await expect(dialog.getByRole('heading', { name: title })).toBeVisible()
  await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await expect(page.getByRole('row').filter({ hasText: title })).toContainText('11.00%')
  await page.getByRole('tab', { name: 'Creators', exact: true }).click()
  await expect(page.locator('.analytics-creator').filter({ hasText: creatorTitle })).toContainText(
    '$5.00',
  )
  await page.getByRole('tab', { name: 'Campaigns', exact: true }).click()
  await expect(
    page.locator('.analytics-campaign').filter({ hasText: campaignTitle }),
  ).toContainText('$20.00')
  await page.getByRole('tab', { name: 'Overview', exact: true }).click()
  await mkdir('output/analytics', { recursive: true })
  await page.screenshot({ path: 'output/analytics/desktop.png', fullPage: true })
  await page.getByRole('tab', { name: /Videos/ }).click()
  await page.getByRole('button', { name: new RegExp(title) }).click()
  await expect(
    page.getByRole('dialog').getByText('Manual snapshot', { exact: true }).first(),
  ).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export history', exact: true }).click()
  expect((await download).suggestedFilename()).toBe('rossiter-video-history.csv')
  await page.getByRole('button', { name: 'Archive', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Restore', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await expect(page.getByRole('row').filter({ hasText: title })).toHaveCount(0)
  await page.getByRole('button', { name: 'Archived', exact: true }).click()
  await page.getByRole('button', { name: new RegExp(title) }).click()
  await page.getByRole('button', { name: 'Restore', exact: true }).click()
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Archive', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await page.getByRole('button', { name: 'Active', exact: true }).click()
  await expect(page.getByRole('row').filter({ hasText: title })).toHaveCount(1)
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await page
    .getByLabel('CSV contents')
    .fill(
      `url,title,capturedAt,views,likes,comments\n${url},${title},${new Date(Date.now() - 86400000).toISOString()},500,50,5`,
    )
  await page.getByRole('button', { name: 'Import snapshots', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: title })).toContainText('1K')
  await page.getByRole('tab', { name: 'Daily scraping', exact: true }).click()
  for (const account of coachingAnalyticsAccounts) {
    await expect(page.getByRole('link', { name: account.title, exact: true })).toHaveAttribute(
      'href',
      account.url,
    )
  }
  await expect(page.getByLabel('Automatically scrape daily')).toBeChecked()
  await expect(page.getByText('once every 24 hours')).toBeVisible()
  await expect(page.locator('input[type=password]')).toHaveCount(0)
  await page.getByLabel('Maximum public requests per day').fill('400')
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Refresh preferences saved')
  await page.reload()
  await waitForHydration(page)
  await page.getByRole('tab', { name: 'Daily scraping', exact: true }).click()
  await expect(page.getByLabel('Maximum public requests per day')).toHaveValue('400')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('tab', { name: 'Overview', exact: true }).click()
  await page.screenshot({ path: 'output/analytics/mobile.png', fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('tab', { name: /Videos/ }).click()
  await page.getByRole('button', { name: new RegExp(title) }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { name: title })).toBeVisible()
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click()
  const anonPage = await anonymous.newPage()
  await anonPage.goto('/admin/analytics')
  await expect(anonPage).toHaveURL(/\/admin\/login/)
  const clientPage = await client.newPage()
  await clientPage.goto('/admin/analytics')
  await expect(clientPage).not.toHaveURL(/\/admin\/analytics/)
  expect((await replay(anonymous, mutation)).headers().location).toContain('/admin/login')
  expect((await replay(client, mutation)).headers().location).toContain('/portal')
  expect((await replay(admin, mutation, 'https://untrusted.example')).status()).toBe(403)
  await db.user.update({ where: { id: user.id }, data: { role: 'CLIENT' } })
  expect((await replay(admin, mutation)).headers().location).toContain('/portal')
  expect(errors).toEqual([])
})
