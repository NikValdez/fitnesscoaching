import { describe, expect, it } from 'vitest'
import {
  programSchema,
  eventSchema,
  nutritionSchema,
  localDate,
} from '../src/lib/coaching-validation'

describe('coaching data boundaries', () => {
  const program = {
    clientId: 'client-a',
    kind: 'FITNESS',
    title: 'Foundation strength',
    startDate: '2026-09-07',
    exercises: [{ name: 'Goblet squat', sets: 3, reps: '8–10' }],
  }
  it('requires exercises for fitness and guidance for nutrition', () => {
    expect(programSchema.safeParse(program).success).toBe(true)
    expect(programSchema.safeParse({ ...program, exercises: [] }).success).toBe(false)
    expect(
      programSchema.safeParse({ ...program, kind: 'NUTRITION', description: '' }).success,
    ).toBe(false)
    expect(programSchema.safeParse({ ...program, endDate: '2026-09-06' }).success).toBe(false)
    expect(programSchema.safeParse({ ...program, calories: 20000 }).success).toBe(false)
  })
  it('validates real dates and scheduling times', () => {
    const event = {
      clientId: 'client-a',
      title: 'Strength session',
      kind: 'WORKOUT',
      date: '2026-09-07',
      time: '09:30',
      durationMinutes: 45,
    }
    expect(eventSchema.safeParse(event).success).toBe(true)
    expect(eventSchema.safeParse({ ...event, time: '25:00' }).success).toBe(false)
    expect(eventSchema.safeParse({ ...event, date: '2026-02-30' }).success).toBe(false)
    expect(eventSchema.safeParse({ ...event, kind: 'ADMIN' }).success).toBe(false)
  })
  it('rejects negative nutrition intake and keeps Los Angeles dates at UTC midnight', () => {
    expect(
      nutritionSchema.safeParse({
        date: '2026-09-07',
        calories: -1,
        proteinGrams: 120,
        carbsGrams: 200,
        fatsGrams: 70,
        waterLitres: 2,
      }).success,
    ).toBe(false)
    expect(localDate(new Date('2026-09-07T01:00:00Z'))).toBe('2026-09-06')
  })
})
