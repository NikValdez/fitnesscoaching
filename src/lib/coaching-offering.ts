export const onlineCoachingPlan = {
  name: 'Online coaching',
  amountCents: 100000,
  yearlyAmountCents: 960000,
  currency: 'usd',
  features: [
    'A training plan built around your goals',
    'Practical nutrition and lifestyle guidance',
    'Weekly check-ins and ongoing adjustments',
    'Your own client space to track progress',
  ],
} as const

export const coachingBillingPlans = {
  monthly: { amountCents: onlineCoachingPlan.amountCents, interval: 'month', label: 'Monthly' },
  yearly: { amountCents: onlineCoachingPlan.yearlyAmountCents, interval: 'year', label: 'Yearly' },
} as const

export type CoachingBillingCadence = keyof typeof coachingBillingPlans

export function coachingBillingCadence(value: unknown): CoachingBillingCadence | null {
  return value === 'monthly' || value === 'yearly' ? value : null
}

export const yearlyCoachingSavings =
  coachingBillingPlans.monthly.amountCents * 12 - coachingBillingPlans.yearly.amountCents
export const yearlyCoachingDiscount =
  Math.round((yearlyCoachingSavings / (coachingBillingPlans.monthly.amountCents * 12)) * 1000) / 10

export function coachingPriceLabel(amountCents: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amountCents / 100)
}
