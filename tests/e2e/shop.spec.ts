import { waitForHydration } from './hydration'
import { test, expect } from '@playwright/test'

test('free 69 easy reading page, mobile layout and legacy payment guards', async ({
  page,
  request,
}) => {
  const oldRoute = await request.get('/program', { maxRedirects: 0 })
  expect(oldRoute.status()).toBe(301)
  expect(oldRoute.headers().location).toBe('/69-easy')
  await page.goto('/')
  await waitForHydration(page)
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: '69 easy', exact: true })
    .click()
  await expect(page).toHaveURL(/\/69-easy/)
  await expect(page.getByRole('heading', { name: '69 easy', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'What is 69 easy?' })).toBeVisible()
  await expect(page.locator('form[action="/api/checkout"]')).toHaveCount(0)
  await expect(page.locator('.product-price')).toHaveCount(0)
  await expect(page.locator('a[download]')).toHaveCount(0)
  await expect(page.locator('.easy-examples > li')).toHaveCount(10)
  await page
    .getByRole('navigation', { name: 'Plan sections' })
    .getByRole('link', { name: '69 easy [EXAMPLE]', exact: true })
    .click()
  await expect(page).toHaveURL(/\/69-easy#example$/)
  await expect(
    page.getByRole('heading', { name: '69 easy [EXAMPLE]', exact: true }),
  ).toBeInViewport()
  for (const width of [1440, 1100, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.getByRole('link', { name: 'Back to top' }).click()
  await expect(page.getByRole('heading', { name: '69 easy', exact: true })).toBeInViewport()
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
