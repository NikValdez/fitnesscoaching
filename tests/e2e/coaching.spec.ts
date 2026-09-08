import { waitForHydration } from './hydration'
import { test, expect, type BrowserContext, type Request } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { db } from '../../scripts/db'
import { localDate } from '../../src/lib/coaching-validation'

const base = process.env.TEST_BASE_URL || 'http://localhost:3000'
const emails: string[] = []
const contexts: BrowserContext[] = []

test.afterAll(async () => {
  await Promise.all(contexts.map((context) => context.close()))
  const users = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true } })
  const ids = users.map((user) => user.id)
  await db.scheduleEvent.deleteMany({
    where: { OR: [{ clientId: { in: ids } }, { coachId: { in: ids } }] },
  })
  await db.program.deleteMany({
    where: { OR: [{ clientId: { in: ids } }, { coachId: { in: ids } }] },
  })
  await db.user.deleteMany({ where: { id: { in: ids } } })
  await db.$disconnect()
})

async function register(context: BrowserContext, name: string) {
  const email = `rossiter-portal-test-${randomUUID()}@example.com`
  emails.push(email)
  const options = {
    data: { name, email, password: `Private-${randomUUID()}!`, role: 'ADMIN' },
    headers: { Origin: base },
  }
  let response = await context.request.post(`${base}/api/auth/sign-up/email`, options)
  // The full suite deliberately exercises signup repeatedly. Respect auth throttling.
  for (let attempt = 0; response.status() === 429 && attempt < 3; attempt++) {
    const retrySeconds = Math.min(60, Math.max(10, Number(response.headers()['retry-after']) || 10))
    await new Promise((resolve) => setTimeout(resolve, retrySeconds * 1000))
    response = await context.request.post(`${base}/api/auth/sign-up/email`, options)
  }
  expect(response.ok(), `Signup returned HTTP ${response.status()}`).toBe(true)
  const user = await db.user.findUniqueOrThrow({ where: { email } })
  expect(user.role).toBe('CLIENT') // Crafted sign-up input must never elevate permissions.
  // This suite starts with onboarded clients; the questionnaire has its own UI coverage.
  await db.clientIntake.create({
    data: {
      userId: user.id,
      channels: ['EMAIL'],
      interests: { create: [{ service: 'FITNESS', tier: 'ESSENTIAL' }] },
    },
  })
  return user
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

test('coach programs, private client calendars, nutrition, check-in review, and server permissions', async ({
  browser,
}) => {
  test.setTimeout(180_000)
  const coachContext = await browser.newContext({
    baseURL: base,
    viewport: { width: 1440, height: 1000 },
  })
  const clientContext = await browser.newContext({
    baseURL: base,
    viewport: { width: 1440, height: 1000 },
  })
  const otherContext = await browser.newContext({ baseURL: base })
  const anonymous = await browser.newContext({ baseURL: base })
  contexts.push(coachContext, clientContext, otherContext, anonymous)
  const coach = await register(coachContext, 'Test Coach')
  const client = await register(clientContext, 'Avery Athlete')
  const other = await register(otherContext, 'Blake Athlete')
  await db.user.update({ where: { id: coach.id }, data: { role: 'ADMIN' } })
  const page = await coachContext.newPage()
  const clientPage = await clientContext.newPage()
  const otherPage = await otherContext.newPage()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  clientPage.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/portal')
  await waitForHydration(page)
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveURL(/\/coach/)
  await expect(page.getByRole('heading', { name: 'A clear view of the week.' })).toBeVisible()

  await page.getByRole('button', { name: 'Create fitness plan', exact: false }).click()
  await page.getByLabel('Client', { exact: true }).selectOption(client.id)
  await page.getByLabel('Plan title').fill('Avery strength foundation')
  await page
    .getByLabel('Program guidance')
    .fill('Train three times weekly with a rest day between sessions.')
  await page.getByLabel('Exercise 1', { exact: true }).fill('Goblet squat')
  await page.getByLabel('Coaching cues').fill('Controlled lowering. Rest for 90 seconds.')
  const createRequest = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().includes('/_serverFn/'),
  )
  await page.getByRole('button', { name: 'Save plan', exact: true }).click()
  const programRequest = await createRequest
  await expect(page.getByRole('dialog')).not.toBeVisible()
  const fitness = await db.program.findFirstOrThrow({
    where: { clientId: client.id, kind: 'FITNESS' },
    include: { exercises: true },
  })
  expect(fitness.exercises[0].name).toBe('Goblet squat')
  await replay(clientContext, programRequest)
  await replay(anonymous, programRequest)
  expect(await db.program.count({ where: { clientId: client.id } })).toBe(1)

  await page.getByRole('button', { name: 'Create nutrition plan', exact: false }).click()
  await page.getByLabel('Client', { exact: true }).selectOption(client.id)
  await page.getByLabel('Plan title').fill('Avery nutrition foundations')
  await page
    .getByLabel('Nutrition guidance & meal plan')
    .fill('Include protein at breakfast and add vegetables to lunch.')
  await page.getByLabel('Calories (kcal)', { exact: true }).fill('2200')
  await page.getByLabel('Protein (g)', { exact: true }).fill('150')
  await page.getByLabel('Carbs (g)', { exact: true }).fill('250')
  await page.getByLabel('Fats (g)', { exact: true }).fill('65')
  await page.getByRole('button', { name: 'Save plan', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()

  await page.getByRole('button', { name: 'Schedule an item', exact: true }).click()
  await page.getByLabel('Client', { exact: true }).selectOption(client.id)
  await page.getByLabel('Title', { exact: true }).fill('Avery lower body session')
  await page.getByLabel('Time (Los Angeles)').fill('09:00')
  await page.getByLabel('Linked plan (optional)').selectOption(fitness.id)
  await page.getByRole('button', { name: 'Save scheduled item' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  const scheduled = await db.scheduleEvent.findFirstOrThrow({ where: { clientId: client.id } })
  await db.scheduleEvent.create({
    data: {
      clientId: client.id,
      coachId: coach.id,
      kind: 'COACH_TASK',
      title: 'Private coach preparation',
      notes: 'Coach-only notes must stay private',
      date: localDate(),
      durationMinutes: 30,
    },
  })
  await db.scheduleEvent.create({
    data: {
      clientId: other.id,
      coachId: coach.id,
      kind: 'WORKOUT',
      title: 'Blake private session',
      date: localDate(),
      durationMinutes: 45,
    },
  })

  await clientPage.goto('/portal')
  await waitForHydration(clientPage)
  await clientPage.waitForLoadState('networkidle')
  await expect(clientPage.getByRole('heading', { name: 'Good to see you, Avery.' })).toBeVisible()
  await expect(clientPage.getByText('Avery strength foundation', { exact: true })).toBeVisible()
  await expect(clientPage.getByText('Blake private session')).toHaveCount(0)
  await expect(clientPage.getByText('Private coach preparation')).toHaveCount(0)
  await clientPage.getByRole('button', { name: 'Avery lower body session', exact: false }).click()
  const completeRequest = clientPage.waitForRequest(
    (request) => request.method() === 'POST' && request.url().includes('/_serverFn/'),
  )
  await clientPage.getByRole('button', { name: 'Mark as done', exact: true }).click()
  const eventRequest = await completeRequest
  await expect(clientPage.getByRole('dialog')).not.toBeVisible()
  expect(
    (await db.scheduleEvent.findUniqueOrThrow({ where: { id: scheduled.id } })).completedAt,
  ).not.toBeNull()
  await db.scheduleEvent.update({ where: { id: scheduled.id }, data: { completedAt: null } })
  await replay(otherContext, eventRequest)
  expect(
    (await db.scheduleEvent.findUniqueOrThrow({ where: { id: scheduled.id } })).completedAt,
  ).toBeNull()

  await otherPage.goto('/coach')
  await waitForHydration(otherPage)
  await expect(otherPage).toHaveURL(/\/portal/)
  await expect(otherPage.getByText('Avery strength foundation')).toHaveCount(0)
  await otherContext.request.post('/api/auth/update-user', {
    data: { role: 'ADMIN' },
    headers: { Origin: base },
  })
  expect((await db.user.findUniqueOrThrow({ where: { id: other.id } })).role).toBe('CLIENT')

  await clientPage
    .getByRole('navigation', { name: 'Client navigation' })
    .getByRole('button', { name: 'My nutrition' })
    .click()
  await expect(clientPage.getByText('Avery nutrition foundations', { exact: true })).toBeVisible()
  await clientPage.getByRole('button', { name: 'Log nutrition', exact: true }).click()
  await clientPage.getByLabel('Calories (kcal)', { exact: true }).fill('2100')
  await clientPage.getByLabel('Protein (g)', { exact: true }).fill('145')
  await clientPage.getByLabel('Carbs (g)', { exact: true }).fill('245')
  await clientPage.getByLabel('Fats (g)', { exact: true }).fill('62')
  await clientPage.getByLabel('Water (litres)').fill('2.5')
  await clientPage.getByRole('button', { name: 'Save nutrition log' }).click()
  await expect(clientPage.getByRole('dialog')).not.toBeVisible()
  await clientPage.reload()
  await waitForHydration(clientPage)
  await expect(clientPage.getByText('2100 kcal', { exact: true })).toBeVisible()
  expect(await db.nutritionLog.count({ where: { userId: client.id } })).toBe(1)

  await clientPage.goto('/dashboard')
  await waitForHydration(clientPage)
  await clientPage.getByRole('button', { name: 'Write your check-in' }).click()
  await clientPage
    .getByLabel('How did your week go?')
    .fill('Consistent sessions, but could use help with recovery.')
  await clientPage.getByRole('button', { name: 'Save check-in' }).click()
  await expect(clientPage.getByRole('dialog')).not.toBeVisible()
  await page.reload()
  await waitForHydration(page)
  await page
    .getByRole('navigation', { name: 'Coach navigation' })
    .getByRole('button', { name: 'Check-ins', exact: true })
    .click()
  await page.getByRole('button', { name: 'Avery Athlete', exact: false }).click()
  await page
    .getByLabel('Your feedback')
    .fill('Good consistency. Add an easier day after your lower body session.')
  await page.getByRole('button', { name: 'Mark reviewed & save feedback' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  expect(
    (await db.checkIn.findFirstOrThrow({ where: { userId: client.id } })).reviewedAt,
  ).not.toBeNull()
  await clientPage.goto('/portal')
  await waitForHydration(clientPage)
  await expect(
    clientPage.getByText('Good consistency. Add an easier day after your lower body session.'),
  ).toBeVisible()

  await page
    .getByRole('navigation', { name: 'Coach navigation' })
    .getByRole('button', { name: 'Calendar', exact: true })
    .click()
  await page.reload()
  await waitForHydration(page)
  await expect(
    page.getByRole('button', { name: 'Private coach preparation', exact: false }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Private coach preparation', exact: false }).click()
  await page.getByRole('button', { name: 'Mark as done', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.screenshot({ path: 'test-results/coach-calendar-desktop.png', fullPage: true })
  await clientPage.goto(`/portal?tab=calendar&month=${localDate().slice(0, 7)}`)
  await waitForHydration(clientPage)
  await expect(clientPage.getByText('Private coach preparation')).toHaveCount(0)
  await expect(clientPage.getByText('Blake private session')).toHaveCount(0)
  await clientPage.screenshot({ path: 'test-results/client-calendar-desktop.png', fullPage: true })
  await clientPage.setViewportSize({ width: 390, height: 844 })
  await clientPage.screenshot({ path: 'test-results/client-calendar-mobile.png', fullPage: true })
  expect(await clientPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'test-results/coach-calendar-mobile.png', fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

  // Updates reach the client; archiving keeps linked calendar history intact.
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/coach?tab=programs')
  await waitForHydration(page)
  await page.getByRole('button', { name: /Avery strength foundation/ }).click()
  await page.getByRole('button', { name: 'Edit plan', exact: true }).click()
  await page.getByLabel('Plan title').fill('Avery updated strength plan')
  await page.getByLabel('Exercise 1', { exact: true }).fill('Front squat')
  await page.getByRole('button', { name: 'Save plan', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await clientPage.goto('/portal?tab=workouts')
  await waitForHydration(clientPage)
  await clientPage.getByRole('button', { name: /Avery updated strength plan/ }).click()
  await expect(clientPage.getByRole('heading', { name: 'Front squat', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Avery updated strength plan/ }).click()
  await page.getByRole('button', { name: 'Archive plan', exact: true }).click()
  await page.getByRole('button', { name: 'Archive plan', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await clientPage.reload()
  await waitForHydration(clientPage)
  await expect(clientPage.getByRole('button', { name: /Avery updated strength plan/ })).toHaveCount(
    0,
  )
  expect(await db.scheduleEvent.count({ where: { programId: fitness.id } })).toBe(1)

  await page.goto('/coach?tab=calendar')
  await waitForHydration(page)
  await page.getByRole('button', { name: /Private coach preparation/ }).click()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page
    .getByLabel('Notes', { exact: true })
    .fill('Review recovery before creating the next plan.')
  await page.getByRole('button', { name: 'Save scheduled item' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.getByRole('button', { name: /Private coach preparation/ }).click()
  await expect(page.getByText('Review recovery before creating the next plan.')).toBeVisible()
  await page.getByRole('button', { name: 'Delete scheduled item' }).click()
  await page.getByRole('button', { name: 'Remove item', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  expect(await db.scheduleEvent.count({ where: { coachId: coach.id, kind: 'COACH_TASK' } })).toBe(0)

  // A coach can schedule, edit, complete and stop a series across calendar months.
  await page.goto('/coach?tab=checkins&month=2026-09')
  await waitForHydration(page)
  await page.getByRole('button', { name: 'Schedule a check-in', exact: true }).click()
  await page.getByLabel('Client', { exact: true }).selectOption(client.id)
  await expect(page.getByLabel('Type', { exact: true })).toHaveValue('CHECK_IN')
  await page.getByLabel('Title', { exact: true }).fill('Recurring recovery check-in')
  await page.getByLabel('Date', { exact: true }).fill('2026-09-28')
  await page.getByLabel('Time (Los Angeles)').fill('09:15')
  await page.getByLabel('Repeats', { exact: true }).selectOption('WEEKLY')
  await page.getByLabel('Number of check-ins').fill('4')
  await expect(page.getByText(/Last check-in: 2026-10-19/)).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'test-results/recurring-checkin-mobile.png', fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const repeatRequestPromise = page.waitForRequest(
    (r) => r.method() === 'POST' && r.url().includes('/_serverFn/'),
  )
  await page.getByRole('button', { name: 'Save scheduled item' }).click()
  const repeatRequest = await repeatRequestPromise
  await expect(page.getByRole('dialog')).not.toBeVisible()
  const series = await db.scheduleEvent.findMany({
    where: { clientId: client.id, title: 'Recurring recovery check-in' },
    orderBy: { date: 'asc' },
  })
  expect(series.map((e) => e.date)).toEqual([
    '2026-09-28',
    '2026-10-05',
    '2026-10-12',
    '2026-10-19',
  ])
  expect(new Set(series.map((e) => e.seriesId)).size).toBe(1)
  expect(series[0].seriesId).not.toBeNull()
  expect(series.every((e) => e.time === '09:15' && e.completedAt === null)).toBe(true)
  await replay(clientContext, repeatRequest)
  await replay(anonymous, repeatRequest)
  expect(
    await db.scheduleEvent.count({
      where: { clientId: client.id, title: 'Recurring recovery check-in' },
    }),
  ).toBe(4)

  await clientPage.goto('/portal?tab=calendar&month=2026-10')
  await waitForHydration(clientPage)
  await expect(clientPage.getByText('Recurring recovery check-in', { exact: true })).toHaveCount(3)
  await otherPage.goto('/portal?tab=calendar&month=2026-10')
  await waitForHydration(otherPage)
  await expect(otherPage.getByText('Recurring recovery check-in')).toHaveCount(0)

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/coach?tab=calendar&month=2026-09')
  await waitForHydration(page)
  await page.getByRole('button', { name: /Sep 28, 2026,/ }).click()
  await page.getByRole('button', { name: /Recurring recovery check-in/ }).click()
  await page.getByRole('button', { name: 'Mark as done', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  expect(
    await db.scheduleEvent.count({
      where: { seriesId: series[0].seriesId, completedAt: { not: null } },
    }),
  ).toBe(1)
  await page.goto('/coach?tab=calendar&month=2026-10')
  await waitForHydration(page)
  await page.getByRole('button', { name: /Oct 5, 2026,/ }).click()
  await page
    .getByRole('button', { name: /Recurring recovery check-in/ })
    .first()
    .click()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(page.getByText(/this check-in only/)).toBeVisible()
  await page.getByLabel('Title', { exact: true }).fill('Adjusted recovery check-in')
  await page.getByRole('button', { name: 'Save scheduled item' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  expect(await db.scheduleEvent.count({ where: { seriesId: series[0].seriesId } })).toBe(4)
  expect(
    await db.scheduleEvent.count({
      where: { seriesId: series[0].seriesId, title: 'Recurring recovery check-in' },
    }),
  ).toBe(3)
  await page.getByRole('button', { name: /Oct 12, 2026,/ }).click()
  await page
    .getByRole('button', { name: /Recurring recovery check-in/ })
    .first()
    .click()
  await page.getByRole('button', { name: 'Delete scheduled item' }).click()
  await page.getByRole('button', { name: 'Remove item', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  expect(await db.scheduleEvent.count({ where: { seriesId: series[0].seriesId } })).toBe(3)
  // Completed occurrences remain even when they fall after the selected cutoff.
  await db.scheduleEvent.update({ where: { id: series[3].id }, data: { completedAt: new Date() } })
  await page.getByRole('button', { name: /Oct 5, 2026,/ }).click()
  await page.getByRole('button', { name: /Adjusted recovery check-in/ }).click()
  await page.getByRole('button', { name: 'Remove this and future check-ins' }).click()
  await page.getByRole('button', { name: 'Remove remaining check-ins', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  expect(
    (
      await db.scheduleEvent.findMany({
        where: { seriesId: series[0].seriesId },
        orderBy: { date: 'asc' },
      })
    ).map((e) => e.id),
  ).toEqual([series[0].id, series[3].id])
  await clientPage.reload()
  await waitForHydration(clientPage)
  await expect(clientPage.getByText('Recurring recovery check-in', { exact: true })).toHaveCount(1)
  await expect(clientPage.getByText('Adjusted recovery check-in', { exact: true })).toHaveCount(0)

  // Turning a one-time check-in into a series retains its identity and completion.
  const once = await db.scheduleEvent.create({
    data: {
      clientId: client.id,
      coachId: coach.id,
      title: 'Monthly recovery review',
      kind: 'CHECK_IN',
      date: '2028-01-31',
      time: '10:00',
      completedAt: new Date(),
    },
  })
  await page.goto('/coach?tab=calendar&month=2028-01')
  await waitForHydration(page)
  await page.getByRole('button', { name: /Jan 31, 2028,/ }).click()
  await page.getByRole('button', { name: /Monthly recovery review/ }).click()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByLabel('Repeats', { exact: true }).selectOption('MONTHLY')
  await page.getByLabel('Number of check-ins').fill('3')
  const convertPromise = page.waitForRequest(
    (r) => r.method() === 'POST' && r.url().includes('/_serverFn/'),
  )
  await page.getByRole('button', { name: 'Save scheduled item' }).click()
  const convertRequest = await convertPromise
  await expect(page.getByRole('dialog')).not.toBeVisible()
  const converted = await db.scheduleEvent.findMany({
    where: { clientId: client.id, title: once.title },
    orderBy: { date: 'asc' },
  })
  expect(converted.map((e) => e.date)).toEqual(['2028-01-31', '2028-02-29', '2028-03-31'])
  expect(converted[0].id).toBe(once.id)
  expect(converted[0].completedAt).not.toBeNull()
  expect(converted.slice(1).every((e) => e.completedAt === null)).toBe(true)
  await replay(coachContext, convertRequest)
  expect(await db.scheduleEvent.count({ where: { seriesId: converted[0].seriesId } })).toBe(3)

  // Revocation takes effect immediately even with an existing authenticated session.
  await db.user.update({ where: { id: coach.id }, data: { role: 'CLIENT' } })
  await replay(coachContext, programRequest)
  expect(await db.program.count({ where: { clientId: client.id } })).toBe(2)
  expect(errors).toEqual([])
})
