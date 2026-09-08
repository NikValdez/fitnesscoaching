export const repeatOptions = {
  NONE: 'Does not repeat',
  WEEKLY: 'Weekly',
  BIWEEKLY: 'Every two weeks',
  MONTHLY: 'Monthly',
} as const

export type RepeatEvery = keyof typeof repeatOptions

// Work with calendar dates, preserving the separately stored Los Angeles time
// across daylight-saving changes. Monthly dates stay anchored to the first day
// chosen, clamping to the last day of shorter months without subsequent drift.
export function recurrenceDates(date: string, repeat: RepeatEvery, count: number): string[] {
  const start = new Date(`${date}T12:00:00Z`)
  return Array.from({ length: repeat === 'NONE' ? 1 : count }, (_, index) => {
    const next = new Date(start)
    if (repeat === 'MONTHLY') {
      next.setUTCDate(1)
      next.setUTCMonth(start.getUTCMonth() + index)
      const end = new Date(next)
      end.setUTCMonth(end.getUTCMonth() + 1)
      end.setUTCDate(0)
      next.setUTCDate(Math.min(start.getUTCDate(), end.getUTCDate()))
    } else {
      next.setUTCDate(start.getUTCDate() + index * (repeat === 'BIWEEKLY' ? 14 : 7))
    }
    return next.toISOString().slice(0, 10)
  })
}
