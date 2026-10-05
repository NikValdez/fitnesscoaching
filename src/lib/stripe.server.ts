import 'dotenv/config'
import Stripe from 'stripe'

export const privateBillingHeaders = {
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
}

export function stripeConfiguration() {
  const key = process.env.STRIPE_SECRET_KEY || ''
  const testMode = key.startsWith('sk_test_')
  return { enabled: testMode || key.startsWith('sk_live_'), testMode }
}

export function stripeClient() {
  if (!stripeConfiguration().enabled) throw new Error('Stripe unavailable')
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    maxNetworkRetries: 2,
    timeout: 15000,
    httpClient: Stripe.createFetchHttpClient(),
  })
}

export function storeOrigin() {
  const url = new URL(process.env.APP_URL || process.env.BETTER_AUTH_URL || 'http://localhost:3000')
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
  )
    throw new Error('Configure an HTTPS APP_URL')
  return url.origin
}
