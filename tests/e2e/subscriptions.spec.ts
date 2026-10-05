import { test, expect } from '@playwright/test'
import { waitForHydration } from './hydration'

test('pricing and the application action share one panel without online signup', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/work-with-me#online-coaching')
  await waitForHydration(page)
  const offering = page.locator('#online-coaching')
  await expect(offering.getByRole('link', { name: 'Apply for coaching' })).toBeVisible()
  await expect(offering.locator('.coaching-plan-badge')).toHaveCount(0)
  await expect(page.locator('.work-process #online-coaching')).toBeVisible()
  await expect(offering.locator('.coaching-plan-terms')).toHaveText(
    'Starts with a free 30-minute call. Billed monthly until you cancel.',
  )
  await expect(offering.locator('.coaching-plan-price')).toHaveText('$1,000 / month')
  await expect(offering.locator('.coaching-plan-price')).not.toContainText('USD')
  await expect(page.locator('.online-coaching')).toHaveCount(0)
  await expect(page.locator('.coaching-auth-tabs, .coaching-signup-form')).toHaveCount(0)
  await expect(offering.locator('form, input')).toHaveCount(0)
  await expect(page).toHaveURL(/\/work-with-me(?:\?billing=monthly)?#online-coaching$/)
  await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('pricing fits a mobile viewport and links to the application form', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/work-with-me?coaching=cancelled#online-coaching')
  await waitForHydration(page)
  await expect(page.locator('#online-coaching .coaching-plan-price')).toHaveText('$1,000 / month')
  await expect(page.locator('.coaching-signup-form')).toHaveCount(0)
  const viewport = await page.evaluate(() => ({
    width: window.innerWidth,
    content: document.documentElement.scrollWidth,
  }))
  expect(viewport.content).toBeLessThanOrEqual(viewport.width)
  // Phones read the process before the price.
  const steps = await page.locator('.work-process-steps').boundingBox()
  const pricing = await page.locator('#online-coaching').boundingBox()
  expect(pricing!.y).toBeGreaterThan(steps!.y + steps!.height)
  await page.getByRole('link', { name: 'Apply for coaching', exact: true }).click()
  await expect(page).toHaveURL(/#work-title$/)
  await expect(page.getByRole('heading', { name: 'Wellth Management', exact: true })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Online coaching' })).toBeChecked()
})

test('checkout and billing management reject anonymous and cross-origin requests', async ({
  request,
  baseURL,
}) => {
  for (const path of ['/api/coaching/checkout', '/api/coaching/portal']) {
    const crossOrigin = await request.post(path, {
      headers: { Origin: 'https://evil.example' },
      maxRedirects: 0,
    })
    expect(crossOrigin.status()).toBe(403)
    const anonymous = await request.post(path, {
      headers: { Origin: baseURL! },
      maxRedirects: 0,
    })
    expect(anonymous.status()).toBe(303)
    expect(anonymous.headers().location).toContain('/work-with-me?coaching=signin')
    expect(anonymous.headers()['cache-control']).toBe('private, no-store')
  }
})

test('yearly billing shows 20% savings and stays selected after reloading', async ({ page }) => {
  await page.goto('/work-with-me#online-coaching')
  await waitForHydration(page)
  const offering = page.locator('#online-coaching')
  const billing = offering.getByRole('group', { name: 'Billing frequency' })
  await billing.getByRole('button', { name: 'Yearly Save 20%' }).click()
  await expect(offering.locator('.coaching-plan-price')).toHaveText('$800 / month')
  await expect(offering.locator('.coaching-plan-savings')).toHaveText(
    '$9,600 billed once a year. Save $2,400.',
  )
  await expect(offering.locator('.coaching-plan-terms')).toContainText(
    'Renews annually until you cancel.',
  )
  await expect(billing.getByRole('button', { name: 'Yearly Save 20%' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page).toHaveURL(/billing=yearly/)
  await page.reload()
  await waitForHydration(page)
  await expect(offering.locator('.coaching-plan-price')).toHaveText('$800 / month')
  await expect(billing.getByRole('button', { name: 'Yearly Save 20%' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await billing.getByRole('button', { name: 'Monthly', exact: true }).click()
  await expect(offering.locator('.coaching-plan-price')).toHaveText('$1,000 / month')
  await expect(billing.getByRole('button', { name: 'Monthly', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})
