import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { enquirySchema, workoutSchema, checkInSchema, weekStart } from './validation'

async function session() {
  const { getAuth } = await import('./auth.server')
  return getAuth().api.getSession({ headers: getRequestHeaders() })
}

async function requireUser() {
  const { requireClient } = await import('./access.server')
  return requireClient()
}

export const getAuthOptions = createServerFn({ method: 'GET' }).handler(async () => {
  const { isGoogleEnabled } = await import('./auth.server')
  return { googleEnabled: isGoogleEnabled() }
})

export const getDashboard = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await requireUser()
  const { db } = await import('./db.server')
  const currentWeek = weekStart()
  const [workouts, checkIns, enquiries, workoutCount, minutes, weeklyWorkoutCount] =
    await Promise.all([
      db.workout.findMany({
        where: { userId: user.id },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 50,
      }),
      db.checkIn.findMany({ where: { userId: user.id }, orderBy: { weekOf: 'desc' }, take: 12 }),
      db.enquiry.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 10 }),
      db.workout.count({ where: { userId: user.id } }),
      db.workout.aggregate({ where: { userId: user.id }, _sum: { durationMinutes: true } }),
      db.workout.count({
        where: {
          userId: user.id,
          date: { gte: currentWeek, lte: new Date().toISOString().slice(0, 10) },
        },
      }),
    ])
  return {
    user: { name: user.name, email: user.email },
    workouts,
    checkIns,
    enquiries,
    workoutCount,
    weeklyWorkoutCount,
    totalMinutes: minutes._sum.durationMinutes ?? 0,
    currentWeek,
  }
})

export const saveWorkout = createServerFn({ method: 'POST' })
  .validator(workoutSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    const { db } = await import('./db.server')
    return db.workout.create({ data: { ...data, userId: user.id } })
  })

export const deleteWorkout = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const user = await requireUser()
    const { db } = await import('./db.server')
    await db.workout.deleteMany({ where: { id: data.id, userId: user.id } })
    return { ok: true }
  })

export const saveCheckIn = createServerFn({ method: 'POST' })
  .validator(checkInSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    const { db } = await import('./db.server')
    const weekOf = weekStart()
    const values = { ...data, weightKg: data.weightKg ?? null, reviewedAt: null, coachNote: null }
    return db.checkIn.upsert({
      where: { userId_weekOf: { userId: user.id, weekOf } },
      create: { ...values, userId: user.id, weekOf },
      update: values,
    })
  })

export const requestIntro = createServerFn({ method: 'POST' })
  .validator(enquirySchema)
  .handler(async ({ data }) => {
    if (data.website) return { ok: true }
    const { db } = await import('./db.server')
    const current = await session()
    // Attach enquiries only to the active session. Never match by a submitted email.
    const recent = await db.enquiry.count({
      where: { email: data.email, createdAt: { gte: new Date(Date.now() - 3_600_000) } },
    })
    if (recent >= 3)
      throw new Error('You already have a recent request. Please try again in an hour.')
    await db.enquiry.create({
      data: {
        name: data.name,
        email: data.email,
        interest: data.interest,
        notes: data.notes,
        userId: current?.user.id,
      },
    })
    return { ok: true }
  })
