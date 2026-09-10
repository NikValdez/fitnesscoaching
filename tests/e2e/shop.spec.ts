import { waitForHydration } from './hydration'
import { test, expect } from '@playwright/test'

test('free 69 Easy sample download, mobile layout and legacy payment guards', async ({
  page,
  request,
}) => {
  await page.goto('/')
  await waitForHydration(page)
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: '69 Easy', exact: true })
    .click()
  await expect(page).toHaveURL(/\/program/)
  await expect(page.getByRole('heading', { name: '69 Easy.' })).toBeVisible()
  await expect(page.getByText('No account needed', { exact: true })).toBeVisible()
  await expect(page.locator('form[action="/api/checkout"]')).toHaveCount(0)
  await expect(page.locator('.product-price')).toHaveCount(0)
  const download = page.getByRole('link', { name: 'Download the free sample' })
  await expect(download).toBeVisible()
  await expect(download).toHaveAttribute('download', '69 Easy-sample.pdf')
  const pdfUrl = await download.getAttribute('href')
  const pdf = await request.get(pdfUrl!)
  expect(pdf.status()).toBe(200)
  expect(pdf.headers()['content-type']).toContain('application/pdf')
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-')
  for (const width of [1440, 1100, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
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
