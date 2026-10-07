import { test, expect, type BrowserContext, type Page } from '@playwright/test'
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

async function admin(context: BrowserContext, name: string) {
  const email = `studio-sharing-test-${randomUUID()}@example.com`
  emails.push(email)
  const options = {
    data: { name, email, password: `Private-${randomUUID()}!` },
    headers: { Origin: base },
  }
  let response = await context.request.post('/api/auth/sign-up/email', options)
  for (let attempt = 0; response.status() === 429 && attempt < 3; attempt++) {
    const delay = Math.max(1, Number(response.headers()['retry-after']) || 10)
    await new Promise((resolve) => setTimeout(resolve, delay * 1000))
    response = await context.request.post('/api/auth/sign-up/email', options)
  }
  expect(response.ok()).toBe(true)
  return db.user.update({ where: { email }, data: { role: 'ADMIN' } })
}

async function create(page: Page, title: string) {
  await page.getByRole('button', { name: 'New idea', exact: true }).click()
  await page.getByLabel('Idea title').fill(title)
  await page.getByRole('dialog').getByRole('button', { name: 'Instagram', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Add idea', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
}

test('separate admins see live cards and keep workspace data after its creator leaves', async ({
  browser,
}) => {
  test.setTimeout(120000)
  const aliceContext = await browser.newContext({ baseURL: base })
  const bobContext = await browser.newContext({ baseURL: base })
  contexts.push(aliceContext, bobContext)
  const alice = await admin(aliceContext, 'Shared Board Alice')
  await admin(bobContext, 'Shared Board Bob')
  const alicePage = await aliceContext.newPage()
  const bobPage = await bobContext.newPage()
  await Promise.all([alicePage.goto('/admin/content'), bobPage.goto('/admin/content')])
  await Promise.all([waitForHydration(alicePage), waitForHydration(bobPage)])
  for (const page of [alicePage, bobPage])
    await expect(page.locator('.content-save-status')).toHaveText('Live shared board')
  const title = `Shared board ${randomUUID()}`
  const updated = `${title} updated`
  const second = `${title} second`
  titles.push(title, updated, second)
  await create(alicePage, title)
  // This deadline is shorter than the fallback polling interval: it verifies
  // that the WebSocket notification refreshes another admin's board.
  await expect(bobPage.getByRole('heading', { name: title, exact: true })).toBeVisible({
    timeout: 5000,
  })
  const idea = await db.contentIdea.findFirstOrThrow({ where: { title } })
  const card = (page: Page) => page.locator(`[data-idea-id="${idea.id}"]`)
  await expect(card(bobPage).getByRole('list', { name: 'Social platforms' })).toContainText(
    'Instagram',
  )
  await expect(card(bobPage).getByRole('combobox')).toHaveCount(0)
  await expect(
    card(bobPage).getByRole('button', { name: `Edit ${title}`, exact: true }),
  ).toHaveCount(0)
  await expect(card(bobPage).locator('.content-card-meta')).not.toBeVisible()
  const collapsedHeight = (await card(bobPage).boundingBox())!.height
  await bobPage.screenshot({ path: 'test-results/cards-collapsed-desktop.png', fullPage: true })
  const expand = card(bobPage).getByRole('button', { name: `Expand ${title}`, exact: true })
  await expect(expand).toHaveAttribute('aria-expanded', 'false')
  await expand.focus()
  await bobPage.keyboard.press('Enter')
  await expect(
    card(bobPage).getByRole('button', { name: `Collapse ${title}`, exact: true }),
  ).toHaveAttribute('aria-expanded', 'true')
  await expect(card(bobPage).getByRole('combobox')).toBeVisible()
  expect((await card(bobPage).boundingBox())!.height).toBeGreaterThan(collapsedHeight + 80)
  await expect(card(alicePage).getByRole('combobox')).toHaveCount(0)
  await card(bobPage).getByRole('combobox').selectOption('FILMING')
  await expect(
    alicePage.locator('[data-stage="FILMING"]').getByRole('heading', { name: title }),
  ).toBeVisible({ timeout: 5000 })

  // Updates elsewhere refresh the board without replacing an open local draft.
  await alicePage.getByRole('button', { name: `Expand ${title}`, exact: true }).click()
  await alicePage.getByRole('button', { name: `Edit ${title}`, exact: true }).click()
  await alicePage.getByLabel('Idea title').fill(updated)
  await create(bobPage, second)
  await expect(alicePage.getByRole('heading', { name: second, exact: true })).toBeAttached({
    timeout: 5000,
  })
  await expect(alicePage.getByLabel('Idea title')).toHaveValue(updated)
  await alicePage.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(alicePage.getByRole('dialog')).not.toBeVisible()
  await expect(bobPage.getByRole('heading', { name: updated, exact: true })).toBeVisible({
    timeout: 5000,
  })

  // The explicit card actions are available on mobile and synchronize edits
  // and confirmed deletions without navigating through another card first.
  await alicePage.setViewportSize({ width: 390, height: 844 })
  await expect(alicePage.getByRole('button', { name: `Edit ${second}`, exact: true })).toHaveCount(
    0,
  )
  await alicePage.screenshot({ path: 'test-results/cards-collapsed-mobile.png', fullPage: true })
  await alicePage.getByRole('button', { name: `Expand ${second}`, exact: true }).click()
  await alicePage.getByRole('button', { name: `Edit ${second}`, exact: true }).click()
  await alicePage.getByLabel('Notes & direction').fill('Edited using the mobile card action.')
  await alicePage.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(alicePage.getByRole('dialog')).not.toBeVisible()
  await expect(bobPage.locator('[data-idea-id]').filter({ hasText: second })).toContainText(
    'Edited using the mobile card action.',
    { timeout: 5000 },
  )
  const secondCard = alicePage
    .locator('[data-idea-id]')
    .filter({ has: alicePage.getByRole('heading', { name: second, exact: true }) })
  await expect(secondCard.getByRole('list', { name: 'Social platforms' })).toContainText(
    'Instagram',
  )
  await alicePage.getByRole('button', { name: `Collapse ${second}`, exact: true }).click()
  await expect(
    secondCard.getByText('Edited using the mobile card action.', { exact: true }),
  ).not.toBeVisible()
  await expect(secondCard.getByRole('list', { name: 'Social platforms' })).toBeVisible()
  await alicePage.getByRole('button', { name: `Expand ${second}`, exact: true }).click()
  await expect(
    secondCard.getByText('Edited using the mobile card action.', { exact: true }),
  ).toBeVisible()
  await expect
    .poll(() => alicePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true)
  await bobPage.getByRole('button', { name: `Expand ${second}`, exact: true }).click()
  await alicePage.screenshot({ path: 'test-results/card-actions-mobile.png', fullPage: true })
  await bobPage.screenshot({ path: 'test-results/card-actions-desktop.png', fullPage: true })
  await bobPage.getByRole('button', { name: `Delete ${second}`, exact: true }).click()
  await expect(bobPage.getByRole('dialog')).toContainText(second)
  await bobPage.getByRole('button', { name: 'Keep idea', exact: true }).click()
  await expect(bobPage.getByRole('dialog')).not.toBeVisible()
  await expect(
    alicePage.getByRole('button', { name: `Delete ${second}`, exact: true }),
  ).toBeVisible()
  await alicePage.getByRole('button', { name: `Delete ${second}`, exact: true }).click()
  await alicePage
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete idea', exact: true })
    .click()
  await expect(alicePage.getByRole('dialog')).not.toBeVisible()
  await expect(bobPage.getByRole('heading', { name: second, exact: true })).toHaveCount(0, {
    timeout: 5000,
  })
  expect(await db.contentIdea.count({ where: { title: second } })).toBe(0)

  // Content belongs to the workspace, so deleting its author's account cannot
  // cascade-delete shared cards. The other admin can still edit and delete them.
  await db.user.delete({ where: { id: alice.id } })
  expect(await db.contentIdea.count({ where: { id: idea.id } })).toBe(1)
  await aliceContext.close()
  await bobPage.getByRole('button', { name: `Expand ${updated}`, exact: true }).click()
  await bobPage.getByRole('button', { name: `Edit ${updated}`, exact: true }).click()
  await bobPage
    .getByLabel('Notes & direction')
    .fill('Still shared after the creator account is removed.')
  await bobPage.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(bobPage.getByRole('dialog')).not.toBeVisible()
  await bobPage.reload()
  await waitForHydration(bobPage)
  await expect(bobPage.getByRole('button', { name: `Edit ${updated}`, exact: true })).toHaveCount(0)
  await bobPage.getByRole('button', { name: `Expand ${updated}`, exact: true }).click()
  await bobPage.getByRole('button', { name: `Edit ${updated}`, exact: true }).click()
  await expect(bobPage.getByLabel('Notes & direction')).toHaveValue(
    'Still shared after the creator account is removed.',
  )
  await bobPage.getByRole('button', { name: 'Delete idea', exact: true }).click()
  await bobPage
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete idea', exact: true })
    .click()
  await expect(bobPage.getByRole('heading', { name: updated, exact: true })).toHaveCount(0)
  expect(await db.contentIdea.count({ where: { id: idea.id } })).toBe(0)
})
