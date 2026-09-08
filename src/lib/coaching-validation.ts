import { z } from 'zod'
import { calendarDate } from './validation'
import { recurrenceDates } from './recurrence'

const text = z.string().trim().max(5000)
const optionalInt = (max: number) =>
  z.preprocess(
    (value) => (value === '' || value == null ? undefined : value),
    z.coerce.number().int().min(0).max(max).optional(),
  )
export const exerciseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sets: z.coerce.number().int().min(1).max(30),
  reps: z.string().trim().min(1).max(60),
  notes: text.default(''),
})
export const programSchema = z
  .object({
    id: z.string().optional(),
    clientId: z.string().min(1),
    kind: z.enum(['FITNESS', 'NUTRITION']),
    title: z.string().trim().min(2).max(120),
    description: text.default(''),
    startDate: calendarDate,
    endDate: z.union([calendarDate, z.literal('')]).default(''),
    calories: optionalInt(10000),
    proteinGrams: optionalInt(1000),
    carbsGrams: optionalInt(2000),
    fatsGrams: optionalInt(1000),
    exercises: z.array(exerciseSchema).max(40).default([]),
  })
  .superRefine((value, context) => {
    if (value.endDate && value.endDate < value.startDate)
      context.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'End date must follow the start date.',
      })
    if (value.kind === 'FITNESS' && !value.exercises.length)
      context.addIssue({
        code: 'custom',
        path: ['exercises'],
        message: 'Add at least one exercise.',
      })
    if (value.kind === 'NUTRITION' && !value.description.trim())
      context.addIssue({
        code: 'custom',
        path: ['description'],
        message: 'Add nutrition guidance or a meal plan.',
      })
  })

export const eventSchema = z
  .object({
    id: z.string().optional(),
    clientId: z.string().min(1),
    title: z.string().trim().min(2).max(120),
    kind: z.enum(['WORKOUT', 'CHECK_IN', 'NUTRITION', 'COACH_TASK']),
    date: calendarDate,
    time: z.union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), z.literal('')]).default(''),
    durationMinutes: z.coerce.number().int().min(5).max(480),
    notes: text.default(''),
    programId: z.string().default(''),
    repeatEvery: z.enum(['NONE', 'WEEKLY', 'BIWEEKLY', 'MONTHLY']).default('NONE'),
    occurrences: z.coerce.number().int().min(2).max(52).default(12),
  })
  .superRefine((value, context) => {
    if (value.repeatEvery !== 'NONE' && value.kind !== 'CHECK_IN') {
      context.addIssue({
        code: 'custom',
        path: ['repeatEvery'],
        message: 'Only client check-ins can repeat.',
      })
    }
    if (
      calendarDate.safeParse(value.date).success &&
      value.repeatEvery !== 'NONE' &&
      Number.isInteger(value.occurrences) &&
      value.occurrences >= 2 &&
      value.occurrences <= 52
    ) {
      const dates = recurrenceDates(value.date, value.repeatEvery, value.occurrences)
      if (!calendarDate.safeParse(dates.at(-1)).success) {
        context.addIssue({
          code: 'custom',
          path: ['date'],
          message: 'Choose an earlier start date.',
        })
      }
    }
  })
export const nutritionSchema = z.object({
  date: calendarDate,
  calories: z.coerce.number().int().min(0).max(15000),
  proteinGrams: z.coerce.number().int().min(0).max(1000),
  carbsGrams: z.coerce.number().int().min(0).max(2000),
  fatsGrams: z.coerce.number().int().min(0).max(1000),
  waterLitres: z.coerce.number().min(0).max(20),
  notes: text.default(''),
})
export const periodSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  clientId: z.string().optional(),
})
export function monthBounds(month: string) {
  return { gte: `${month}-01`, lte: `${month}-31` }
}
export function localDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}
