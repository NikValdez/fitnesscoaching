import type Stripe from 'stripe'
import {
  coachingBillingPlans,
  onlineCoachingPlan,
  type CoachingBillingCadence,
} from './coaching-offering'

export const coachingOffering = 'online-coaching'
export const hasCoachingAccess = (status: string) => status === 'active' || status === 'trialing'
export const blocksNewSubscription = (status: string) =>
  !['canceled', 'incomplete_expired'].includes(status)

export function validCoachingPrice(
  price: Stripe.Price,
  livemode: boolean,
  billing: CoachingBillingCadence = 'monthly',
) {
  const plan = coachingBillingPlans[billing]
  return (
    price.active &&
    price.livemode === livemode &&
    price.type === 'recurring' &&
    price.recurring?.interval === plan.interval &&
    price.recurring.interval_count === 1 &&
    price.recurring.usage_type === 'licensed' &&
    price.billing_scheme === 'per_unit' &&
    price.unit_amount === plan.amountCents &&
    price.currency === onlineCoachingPlan.currency
  )
}

export function stripeId(value: string | { id: string } | null | undefined) {
  return typeof value === 'string' ? value : value?.id
}

export function matchesCoachingSubscription(
  subscription: Stripe.Subscription,
  account: { id: string; userId: string; stripeCustomerId: string | null; livemode: boolean },
) {
  return (
    subscription.metadata.store === 'rossiter' &&
    subscription.metadata.offering === coachingOffering &&
    subscription.metadata.billingAccountId === account.id &&
    subscription.metadata.userId === account.userId &&
    stripeId(subscription.customer) === account.stripeCustomerId &&
    subscription.livemode === account.livemode
  )
}

export function matchesCoachingCheckout(
  session: Stripe.Checkout.Session,
  account: { id: string; userId: string; stripeCustomerId: string | null; livemode: boolean },
) {
  return (
    session.mode === 'subscription' &&
    session.metadata?.store === 'rossiter' &&
    session.metadata.offering === coachingOffering &&
    session.metadata.billingAccountId === account.id &&
    session.metadata.userId === account.userId &&
    session.client_reference_id === account.userId &&
    stripeId(session.customer) === account.stripeCustomerId &&
    session.livemode === account.livemode
  )
}
