import { waitForHydration } from './hydration'
import { test, expect } from '@playwright/test'
import { db } from '../../scripts/db'
import { randomUUID } from 'node:crypto'
import { completeBasicIntake } from './intake-helper'

const testEmails: string[] = []
test.afterAll(async () => {
  await db.enquiry.deleteMany({ where: { email: { in: testEmails } } })
  await db.user.deleteMany({ where: { email: { in: testEmails } } })
  await db.$disconnect()
})

test('landing page, mobile navigation, and pricing selection', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')
  await waitForHydration(page)
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Personal coaching, built around you.',
  )
  await expect(page.locator('.hero-image')).toBeVisible()
  await page.screenshot({ path: 'test-results/landing-desktop.png', fullPage: true })
  await page.getByRole('link', { name: 'Start hybrid', exact: true }).click()
  await expect(page.locator('select[name="interest"]')).toHaveValue('Hybrid coaching')
  const email = `rossiter-test-${randomUUID()}@example.com`
  testEmails.push(email)
  await page.getByLabel('Name', { exact: true }).fill('Test Enquiry')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByRole('button', { name: 'Request intro call' }).click()
  await expect(page.getByText('You’ve taken the first step.')).toBeVisible()
  expect(await db.enquiry.count({ where: { email, interest: 'Hybrid coaching' } })).toBe(1)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await waitForHydration(page)
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('navigation').getByRole('link', { name: 'Services' }).click()
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.screenshot({ path: 'test-results/landing-mobile.png', fullPage: true })
  await page.getByText('I’ve never lifted before. Is it too soon?').click()
  await expect(page.getByText('Not at all. Your first block', { exact: false })).toBeVisible()
  expect(errors).toEqual([])
})

test('protected dashboard redirects visitors', async ({ page }) => {
  await page.goto('/dashboard')
  await waitForHydration(page)
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: 'Good to have you back.' })).toBeVisible()
})

test('pricing selection works before JavaScript loads and survives a reload', async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
  })
  const page = await context.newPage()
  await page.goto('/')
  await page.getByRole('link', { name: 'Start hybrid', exact: true }).click()
  await expect(page.locator('select[name="interest"]')).toHaveValue('Hybrid coaching')
  await page.reload()
  await expect(page.locator('select[name="interest"]')).toHaveValue('Hybrid coaching')
  await context.close()
})

test('accounts persist workouts and check-ins, isolate records, and sign out', async ({
  page,
  browser,
}) => {
  const email = `rossiter-test-${randomUUID()}@example.com`
  testEmails.push(email)
  const password = `Test-${randomUUID()}!`
  await page.goto('/signup')
  await waitForHydration(page)
  await page.getByLabel('Your name').fill('Alex Test')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page).toHaveURL(/\/onboarding/)
  await completeBasicIntake(page)
  await page.goto('/dashboard')
  await waitForHydration(page)
  await expect(page.getByRole('heading', { name: 'Keep going, Alex.' })).toBeVisible()
  await page.getByRole('button', { name: 'Log a workout', exact: true }).click()
  await page.getByLabel('Workout name').fill('Lower body strength')
  await page.getByLabel('Duration (minutes)').fill('50')
  await page.getByLabel('Notes', { exact: false }).fill('Squat 3 × 8. Felt strong.')
  await page.getByRole('button', { name: 'Save workout' }).click()
  await expect(page.getByRole('heading', { name: 'Lower body strength' })).toBeVisible()
  await page.reload()
  await waitForHydration(page)
  await expect(page.getByRole('heading', { name: 'Lower body strength' })).toBeVisible()
  await page.getByRole('button', { name: 'Write your check-in' }).click()
  await page.getByLabel('How did your week go?').fill('A good week with consistent sleep.')
  await page.getByRole('button', { name: 'Save check-in' }).click()
  await expect(page.getByRole('heading', { name: 'Your week, reflected.' })).toBeVisible()
  await page.getByRole('button', { name: 'Update check-in' }).click()
  await page.getByLabel('How did your week go?').fill('Updated reflection, same weekly record.')
  await page.getByRole('button', { name: 'Save check-in' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  const user = await db.user.findUniqueOrThrow({ where: { email } })
  expect(await db.checkIn.count({ where: { userId: user.id } })).toBe(1)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true })

  const other = await browser.newContext({
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
  })
  const secondEmail = `rossiter-test-${randomUUID()}@example.com`
  testEmails.push(secondEmail)
  const response = await other.request.post('/api/auth/sign-up/email', {
    data: { name: 'Other Client', email: secondEmail, password },
    headers: { Origin: process.env.TEST_BASE_URL || 'http://localhost:3000' },
  })
  expect(response.ok()).toBe(true)
  const secondPage = await other.newPage()
  await completeBasicIntake(secondPage)
  await secondPage.goto('/dashboard')
  await waitForHydration(secondPage)
  await expect(
    secondPage.getByRole('heading', { name: 'Your first session starts here.' }),
  ).toBeVisible()
  await expect(secondPage.getByRole('heading', { name: 'Lower body strength' })).toHaveCount(0)
  await other.close()

  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.screenshot({ path: 'test-results/dashboard-mobile.png', fullPage: true })
  await page.getByRole('button', { name: 'Remove Lower body strength' }).click()
  await page.getByRole('button', { name: 'Keep workout' }).click()
  await expect(page.getByRole('heading', { name: 'Lower body strength' })).toBeVisible()
  await page.getByRole('button', { name: 'Remove Lower body strength' }).click()
  await page.getByRole('button', { name: 'Remove workout', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your first session starts here.' })).toBeVisible()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page).toHaveURL(/\/login/)
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/portal/)
  await page.goto('/dashboard')
  await waitForHydration(page)
  await expect(page.getByRole('heading', { name: 'Your week, reflected.' })).toBeVisible()
})
