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
}: {
  billing: CoachingBillingCadence
  price?: { amountCents: number; currency: string }
  onBillingChange?: (billing: CoachingBillingCadence) => void
  showBillingOptions?: boolean
  showMembershipBadge?: boolean
  disabled?: boolean
  manageOnline?: boolean
}) {
  const plan = coachingBillingPlans[billing]
  const amount = price?.amountCents ?? plan.amountCents
  const currency = price?.currency ?? onlineCoachingPlan.currency

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
        {coachingPriceLabel(amount, currency)}
        <span> / {plan.interval}</span>
      </p>
      {showBillingOptions && billing === 'yearly' && (
        <p className="coaching-plan-savings">
          Equivalent to {coachingPriceLabel(amount / 12, currency)} / month. Save{' '}
          {coachingPriceLabel(yearlyCoachingSavings, currency)} per year.
        </p>
      )}
      <p className="coaching-plan-terms">
        {billing === 'yearly'
          ? 'Billed in full once a year. Renews annually until you cancel.'
          : 'Billed monthly until you cancel.'}
        {manageOnline && ' Manage your subscription online.'}
      </p>
    </>
  )
}
