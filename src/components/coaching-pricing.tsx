import type { ReactNode } from 'react'
import {
  coachingBillingPlans,
  coachingPriceLabel,
  onlineCoachingPlan,
  yearlyCoachingDiscount,
  yearlyCoachingSavings,
  type CoachingBillingCadence,
} from '../lib/coaching-offering'

export function CoachingPricing({
  billing,
  price,
  onBillingChange,
  showBillingOptions = true,
  showMembershipBadge = true,
  disabled = false,
  manageOnline = false,
  action,
  note,
}: {
  billing: CoachingBillingCadence
  price?: { amountCents: number; currency: string }
  onBillingChange?: (billing: CoachingBillingCadence) => void
  showBillingOptions?: boolean
  showMembershipBadge?: boolean
  disabled?: boolean
  manageOnline?: boolean
  action?: ReactNode
  note?: string
}) {
  const plan = coachingBillingPlans[billing]
  const amount = price?.amountCents ?? plan.amountCents
  const currency = price?.currency ?? onlineCoachingPlan.currency
  // While choosing a plan, yearly is shown per month so both options compare like for like.
  const perMonth = showBillingOptions && billing === 'yearly'

  return (
    <>
      <div className="coaching-plan-heading">
        <span className="eyebrow">{onlineCoachingPlan.name}</span>
        {showMembershipBadge && (
          <span className="coaching-plan-badge">{plan.label} membership</span>
        )}
      </div>
      {showBillingOptions && (
        <div className="coaching-billing-options" role="group" aria-label="Billing frequency">
          {(['monthly', 'yearly'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={billing === option}
              disabled={disabled}
              onClick={() => onBillingChange?.(option)}
            >
              {coachingBillingPlans[option].label}
              {option === 'yearly' && <span>Save {yearlyCoachingDiscount}%</span>}
            </button>
          ))}
        </div>
      )}
      <p className="coaching-plan-price">
        {coachingPriceLabel(perMonth ? amount / 12 : amount, currency)}
        <span> / {perMonth ? coachingBillingPlans.monthly.interval : plan.interval}</span>
      </p>
      {perMonth && (
        <p className="coaching-plan-savings">
          {coachingPriceLabel(amount, currency)} billed once a year. Save{' '}
          {coachingPriceLabel(yearlyCoachingSavings, currency)}.
        </p>
      )}
      {action}
      <p className="coaching-plan-terms">
        {note && <span className="coaching-plan-note">{note} </span>}
        {billing === 'yearly'
          ? 'Renews annually until you cancel.'
          : 'Billed monthly until you cancel.'}
        {manageOnline && ' Manage your subscription online.'}
      </p>
    </>
  )
}
