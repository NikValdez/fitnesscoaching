import type Stripe from 'stripe'

export const validSessionId = (value: string) => /^cs_(test_|live_)?[A-Za-z0-9]{8,240}$/.test(value)

export function matchesPurchase(
  session: Stripe.Checkout.Session,
  purchase: {
    stripeSessionId: string
    productId: string
    amountCents: number
    currency: string
    livemode: boolean
  },
) {
  return (
    session.id === purchase.stripeSessionId &&
    session.mode === 'payment' &&
    session.metadata?.productId === purchase.productId &&
    session.metadata?.store === 'rossiter' &&
    session.amount_total === purchase.amountCents &&
    session.currency === purchase.currency &&
    session.livemode === purchase.livemode
  )
}
