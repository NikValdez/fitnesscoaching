import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { recurrenceDates } from './recurrence'
import {
  eventSchema,
  programSchema,
  nutritionSchema,
  periodSchema,
  monthBounds,
  localDate,
} from './coaching-validation'

export const getClientPortal = createServerFn({ method: 'GET' })
  .validator(periodSchema)
  .handler(async ({ data }) => {
    const { requireClient } = await import('./access.server')
    const user = await requireClient()
    const { db } = await import('./db.server')
    const dates = monthBounds(data.month)
    const [programs, events, workouts, nutritionLogs, checkIns, intake] = await Promise.all([
      db.program.findMany({
        where: { clientId: user.id, archived: false },
        include: { exercises: { orderBy: { position: 'asc' } } },
        orderBy: { startDate: 'desc' },
      }),
      db.scheduleEvent.findMany({
        where: { clientId: user.id, kind: { not: 'COACH_TASK' }, date: dates },
        include: { program: { select: { title: true } } },
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
      }),
      db.workout.findMany({ where: { userId: user.id, date: dates }, orderBy: { date: 'desc' } }),
      db.nutritionLog.findMany({
        where: { userId: user.id, date: dates },
        orderBy: { date: 'desc' },
      }),
      db.checkIn.findMany({ where: { userId: user.id }, orderBy: { weekOf: 'desc' }, take: 12 }),
      db.clientIntake.findUnique({ where: { userId: user.id }, include: { interests: true } }),
    ])
    return { user, programs, events, workouts, nutritionLogs, checkIns, intake, today: localDate() }
  })

export const getCoachWorkspace = createServerFn({ method: 'GET' })
  .validator(periodSchema)
  .handler(async ({ data }) => {
    const { requireAccount } = await import('./access.server')
    const user = await requireAccount()
    if (user.role !== 'ADMIN') throw redirect({ to: '/portal' })
    const { db } = await import('./db.server')
    const clients = await db.user.findMany({
      where: { role: 'CLIENT' },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        intake: { include: { interests: true } },
        _count: {
          select: {
            programs: { where: { archived: false } },
            workouts: true,
            checkIns: { where: { reviewedAt: null } },
          },
        },
      },
      orderBy: { name: 'asc' },
    })
    const clientId = data.clientId || undefined
    if (clientId && !clients.some((client) => client.id === clientId))
      throw new Error('Client not found.')
    const [events, programs, checkIns, recentWorkouts, nutritionLogs] = await Promise.all([
      db.scheduleEvent.findMany({
        where: { clientId, date: monthBounds(data.month) },
        include: {
          client: { select: { id: true, name: true } },
          program: { select: { title: true } },
        },
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
      }),
      db.program.findMany({
        where: { clientId, archived: false },
        include: {
          client: { select: { name: true } },
          exercises: { orderBy: { position: 'asc' } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      db.checkIn.findMany({
        where: { userId: clientId },
        include: { user: { select: { name: true } } },
        orderBy: [{ reviewedAt: { sort: 'asc', nulls: 'first' } }, { weekOf: 'desc' }],
        take: 100,
      }),
      clientId
        ? db.workout.findMany({ where: { userId: clientId }, orderBy: { date: 'desc' }, take: 30 })
        : Promise.resolve([]),
      clientId
        ? db.nutritionLog.findMany({
            where: { userId: clientId },
            orderBy: { date: 'desc' },
            take: 30,
          })
        : Promise.resolve([]),
    ])
    return {
      user,
      clients,
      events,
      programs,
      checkIns,
      recentWorkouts,
      nutritionLogs,
      today: localDate(),
    }
  })

export const saveProgram = createServerFn({ method: 'POST' })
  .validator(programSchema)
  .handler(async ({ data }) => {
    const { requireCoach, findClient } = await import('./access.server')
    const coach = await requireCoach()
    await findClient(data.clientId)
    const { db } = await import('./db.server')
    if (
      data.id &&
      !(await db.program.findFirst({ where: { id: data.id, clientId: data.clientId } }))
    )
      throw new Error('Program not found for this client.')
    const values = {
      title: data.title,
      kind: data.kind,
      description: data.description,
      startDate: data.startDate,
      endDate: data.endDate || null,
      calories: data.kind === 'NUTRITION' ? (data.calories ?? null) : null,
      proteinGrams: data.kind === 'NUTRITION' ? (data.proteinGrams ?? null) : null,
      carbsGrams: data.kind === 'NUTRITION' ? (data.carbsGrams ?? null) : null,
      fatsGrams: data.kind === 'NUTRITION' ? (data.fatsGrams ?? null) : null,
    }
    const exercises =
      data.kind === 'FITNESS'
        ? data.exercises.map((exercise, position) => ({ ...exercise, position }))
        : []
    if (data.id)
      return db.program.update({
        where: { id: data.id },
        data: { ...values, exercises: { deleteMany: {}, create: exercises } },
      })
    return db.program.create({
      data: {
        ...values,
        clientId: data.clientId,
        coachId: coach.id,
        exercises: { create: exercises },
      },
    })
  })

export const archiveProgram = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { requireCoach } = await import('./access.server')
    await requireCoach()
    const { db } = await import('./db.server')
    await db.program.update({ where: { id: data.id }, data: { archived: true } })
    return { ok: true }
  })

export const saveEvent = createServerFn({ method: 'POST' })
  .validator(eventSchema)
  .handler(async ({ data }) => {
    const { requireCoach, findClient } = await import('./access.server')
    const coach = await requireCoach()
    await findClient(data.clientId)
    const { db } = await import('./db.server')
    const existing = data.id
      ? await db.scheduleEvent.findFirst({ where: { id: data.id, clientId: data.clientId } })
      : null
    if (data.id && !existing) throw new Error('Scheduled item not found for this client.')
    if (existing?.seriesId && (data.repeatEvery !== 'NONE' || data.kind !== 'CHECK_IN'))
      throw new Error('Edit this check-in individually or remove the remaining series.')
    if (data.programId) {
      const program = await db.program.findFirst({
        where: { id: data.programId, clientId: data.clientId, archived: false },
      })
      if (
        !program ||
        (data.kind === 'WORKOUT' && program.kind !== 'FITNESS') ||
        (data.kind === 'NUTRITION' && program.kind !== 'NUTRITION')
      )
        throw new Error('Choose a matching plan belonging to this client.')
    }
    const { id, repeatEvery, occurrences, ...input } = data
    const values = { ...input, time: data.time || null, programId: data.programId || null }
    if (repeatEvery !== 'NONE') {
      const seriesId = crypto.randomUUID()
      const dates = recurrenceDates(data.date, repeatEvery, occurrences)
      // Commit the entire series together; converting an existing item keeps its
      // identity and completion history and cannot create a second series on retry.
      await db.$transaction(async (tx) => {
        if (id) {
          const changed = await tx.scheduleEvent.updateMany({
            where: { id, clientId: data.clientId, seriesId: null },
            data: { ...values, seriesId, repeatEvery },
          })
          if (!changed.count) throw new Error('This check-in already belongs to a series.')
        }
        await tx.scheduleEvent.createMany({
          data: (id ? dates.slice(1) : dates).map((date) => ({
            ...values,
            date,
            seriesId,
            repeatEvery,
            coachId: coach.id,
          })),
        })
      })
      return { ok: true }
    }
    if (id) return db.scheduleEvent.update({ where: { id }, data: values })
    return db.scheduleEvent.create({ data: { ...values, coachId: coach.id } })
  })

export const setEventDone = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().min(1), done: z.boolean() }))
  .handler(async ({ data }) => {
    const { requireAccount } = await import('./access.server')
    const user = await requireAccount()
    const { db } = await import('./db.server')
    // An ownership predicate is included in the write, not just checked in the UI.
    const result = await db.scheduleEvent.updateMany({
      where: {
        id: data.id,
        ...(user.role === 'ADMIN'
          ? {}
          : {
              clientId: user.id,
              kind: { in: ['WORKOUT', 'NUTRITION'] as ('WORKOUT' | 'NUTRITION')[] },
            }),
      },
      data: { completedAt: data.done ? new Date() : null },
    })
    if (!result.count) throw new Error('This scheduled item cannot be changed by your account.')
    return { ok: true }
  })

export const deleteEvent = createServerFn({ method: 'POST' })
  .validator(
    z.object({ id: z.string().min(1), scope: z.enum(['ONE', 'FOLLOWING']).default('ONE') }),
  )
  .handler(async ({ data }) => {
    const { requireCoach } = await import('./access.server')
    await requireCoach()
    const { db } = await import('./db.server')
    if (data.scope === 'FOLLOWING') {
      const event = await db.scheduleEvent.findUniqueOrThrow({ where: { id: data.id } })
      if (!event.seriesId) throw new Error('This item does not belong to a repeating series.')
      await db.scheduleEvent.deleteMany({
        where: {
          seriesId: event.seriesId,
          clientId: event.clientId,
          date: { gte: event.date },
          completedAt: null,
        },
      })
    } else {
      await db.scheduleEvent.delete({ where: { id: data.id } })
    }
    return { ok: true }
  })

export const reviewCheckIn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      id: z.string().min(1),
      reviewed: z.boolean(),
      coachNote: z.string().trim().max(5000).default(''),
    }),
  )
  .handler(async ({ data }) => {
    const { requireCoach } = await import('./access.server')
    await requireCoach()
    const { db } = await import('./db.server')
    await db.checkIn.update({
      where: { id: data.id },
      data: { reviewedAt: data.reviewed ? new Date() : null, coachNote: data.coachNote },
    })
    return { ok: true }
  })

export const saveNutritionLog = createServerFn({ method: 'POST' })
  .validator(nutritionSchema)
  .handler(async ({ data }) => {
    const { requireClient } = await import('./access.server')
    const user = await requireClient()
    const { db } = await import('./db.server')
    return db.nutritionLog.upsert({
      where: { userId_date: { userId: user.id, date: data.date } },
      create: { ...data, userId: user.id },
      update: data,
    })
  })
