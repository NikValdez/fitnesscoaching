import { waitForHydration } from './hydration'
import { test, expect } from '@playwright/test'

test('public PDF product, guest navigation, mobile layout and payment guards', async ({
  page,
  request,
}) => {
  await page.goto('/')
  await waitForHydration(page)
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: '69 easy', exact: true })
    .click()
  await expect(page).toHaveURL(/\/program/)
  await expect(page.getByRole('heading', { name: '69 easy.' })).toBeVisible()
  await expect(page.getByText('USD 49', { exact: true })).toBeVisible()
  await expect(page.getByText('Buy as a guest, no account needed')).toBeVisible()
  for (const width of [1440, 1100, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.goto('/program?checkout=cancelled')
  await waitForHydration(page)
  await expect(page.getByRole('status')).toContainText('Checkout was cancelled')
  await page.goto('/purchase/success?session_id=forged')
  await waitForHydration(page)
  await expect(page.getByRole('link', { name: 'Download your PDF' })).toHaveCount(0)
  const denied = await request.get('/api/program/download?session_id=forged')
  expect(denied.status()).toBe(403)
  const crossOrigin = await request.post('/api/checkout', {
    headers: { Origin: 'https://elsewhere.example' },
  })
  expect(crossOrigin.status()).toBe(403)
})
