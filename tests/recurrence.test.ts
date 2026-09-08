import { describe, expect, it } from 'vitest'
import { recurrenceDates } from '../src/lib/recurrence'
import { eventSchema } from '../src/lib/coaching-validation'

describe('recurring check-ins', () => {
  it('crosses months and years at weekly and fortnightly intervals', () => {
    expect(recurrenceDates('2026-12-28', 'WEEKLY', 3)).toEqual([
      '2026-12-28',
      '2027-01-04',
      '2027-01-11',
    ])
    expect(recurrenceDates('2026-09-28', 'BIWEEKLY', 3)).toEqual([
      '2026-09-28',
      '2026-10-12',
      '2026-10-26',
    ])
  })
  it('retains the original monthly day after shorter months, including leap years', () => {
    expect(recurrenceDates('2028-01-31', 'MONTHLY', 4)).toEqual([
      '2028-01-31',
      '2028-02-29',
      '2028-03-31',
      '2028-04-30',
    ])
    expect(recurrenceDates('2027-01-30', 'MONTHLY', 3)).toEqual([
      '2027-01-30',
      '2027-02-28',
      '2027-03-30',
    ])
  })
  it('keeps local calendar weekdays across daylight-saving boundaries', () => {
    expect(recurrenceDates('2026-10-25', 'WEEKLY', 3)).toEqual([
      '2026-10-25',
      '2026-11-01',
      '2026-11-08',
    ])
    expect(recurrenceDates('2026-03-01', 'WEEKLY', 3)).toEqual([
      '2026-03-01',
      '2026-03-08',
      '2026-03-15',
    ])
  })
  const event = {
    clientId: 'client',
    title: 'Weekly review',
    kind: 'CHECK_IN',
    date: '2026-09-07',
    durationMinutes: 15,
    repeatEvery: 'WEEKLY',
    occurrences: 12,
  }
  it('bounds series creation and permits recurrence only for check-ins', () => {
    expect(eventSchema.safeParse(event).success).toBe(true)
    for (const occurrences of [0, 1, 53, 2.5, 1e9]) {
      expect(eventSchema.safeParse({ ...event, occurrences }).success).toBe(false)
    }
    expect(eventSchema.safeParse({ ...event, kind: 'WORKOUT' }).success).toBe(false)
    expect(eventSchema.safeParse({ ...event, date: '2026-02-30' }).success).toBe(false)
    expect(eventSchema.safeParse({ ...event, date: '9999-12-31' }).success).toBe(false)
  })
  it('leaves existing one-time scheduling compatible', () => {
    const { repeatEvery: _, occurrences: __, ...once } = event
    expect(eventSchema.parse(once).repeatEvery).toBe('NONE')
    expect(recurrenceDates(once.date, 'NONE', 12)).toEqual([once.date])
  })
})
