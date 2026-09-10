import { describe, expect, it } from 'vitest'
import { checkInSchema, enquirySchema, weekStart, workoutSchema } from '../src/lib/validation'

describe('server input boundaries', () => {
  it('rejects invalid calendar dates and impossible workout durations', () => {
    const workout = { title: 'Strength', date: '2026-02-29', durationMinutes: 45 }
    expect(workoutSchema.safeParse(workout).success).toBe(false)
    expect(
      workoutSchema.safeParse({ ...workout, date: '2026-09-07', durationMinutes: -1 }).success,
    ).toBe(false)
    expect(
      workoutSchema.safeParse({ ...workout, date: '2026-09-07', durationMinutes: 601 }).success,
    ).toBe(false)
    expect(
      workoutSchema.parse({ ...workout, date: '2028-02-29', durationMinutes: '45' })
        .durationMinutes,
    ).toBe(45)
  })

  it('permits omitted weight without coercing it to zero', () => {
    const checkIn = {
      energy: '3',
      sleepHours: '7.5',
      weightKg: '',
      notes: 'A steady week of training.',
    }
    expect(checkInSchema.parse(checkIn).weightKg).toBeUndefined()
    expect(checkInSchema.safeParse({ ...checkIn, energy: 6 }).success).toBe(false)
    expect(checkInSchema.safeParse({ ...checkIn, sleepHours: 25 }).success).toBe(false)
    expect(checkInSchema.safeParse({ ...checkIn, weightKg: 0 }).success).toBe(false)
  })

  it('normalizes enquiry identities and rejects arbitrary interests', () => {
    const enquiry = {
      name: '  Alex Morgan  ',
      email: 'ALEX@example.com',
      interest: 'In-person coaching',
    }
    expect(enquirySchema.parse(enquiry)).toMatchObject({
      name: 'Alex Morgan',
      email: 'alex@example.com',
    })
    for (const interest of [
      'Online programming',
      'Hybrid coaching',
      'Nutrition coaching',
      'Accountability',
      'invalid',
    ]) {
      expect(enquirySchema.safeParse({ ...enquiry, interest }).success).toBe(false)
    }
    expect(enquirySchema.safeParse({ ...enquiry, notes: 'a'.repeat(2001) }).success).toBe(false)
  })
})

describe('weekly check-in boundaries', () => {
  it('uses the same UTC Monday for the whole week, including Sunday', () => {
    expect(weekStart(new Date('2026-09-07T00:00:00Z'))).toBe('2026-09-07')
    expect(weekStart(new Date('2026-09-13T23:59:59Z'))).toBe('2026-09-07')
    expect(weekStart(new Date('2026-09-14T00:00:00Z'))).toBe('2026-09-14')
  })
  it('handles year boundaries', () => {
    expect(weekStart(new Date('2027-01-01T01:00:00Z'))).toBe('2026-12-28')
  })
})
