import { z } from 'zod'

export const interests = [
  'Online programming',
  'Hybrid coaching',
  'In-person coaching',
  'Nutrition coaching',
  'Not sure yet',
] as const
export const enquirySchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name.').max(100),
  email: z.email('Please enter a valid email.').trim().toLowerCase().max(254),
  interest: z.enum(interests),
  notes: z.string().trim().max(2000).default(''),
  website: z.string().max(200).default(''),
})

export const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T12:00:00Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  }, 'Please choose a valid date.')

export const workoutSchema = z.object({
  title: z.string().trim().min(2, 'Give your workout a name.').max(100),
  date: calendarDate,
  durationMinutes: z.coerce.number().int().min(1).max(600),
  notes: z.string().trim().max(2000).default(''),
})

export const checkInSchema = z.object({
  energy: z.coerce.number().int().min(1).max(5),
  sleepHours: z.coerce.number().min(0).max(24),
  weightKg: z.preprocess(
    (value) => (value === '' || value === undefined ? undefined : value),
    z.coerce.number().min(20).max(500).optional(),
  ),
  notes: z.string().trim().min(5, 'Tell us a little about your week.').max(2000),
})

export function weekStart(date = new Date()) {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  utc.setUTCDate(utc.getUTCDate() - ((utc.getUTCDay() + 6) % 7))
  return utc.toISOString().slice(0, 10)
}
