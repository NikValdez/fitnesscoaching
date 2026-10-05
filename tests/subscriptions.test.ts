import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import { onlineCoachingPlan } from '../src/lib/coaching-offering'
import {
  blocksNewSubscription,
  hasCoachingAccess,
  validCoachingPrice,
} from '../src/lib/subscription-validation'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  user: vi.fn(),
  price: vi.fn(),
  customer: vi.fn(),
  createCheckout: vi.fn(),
  retrieveCheckout: vi.fn(),
  listCheckouts: vi.fn(),
  expireCheckout: vi.fn(),
  portal: vi.fn(),
  retrieveSubscription: vi.fn(),
  listSubscriptions: vi.fn(),
  accountUpsert: vi.fn(),
  accountFind: vi.fn(),
  accountFindOrThrow: vi.fn(),
  accountUpdate: vi.fn(),
  accountUpdateMany: vi.fn(),
  subscriptionUpsert: vi.fn(),
  subscriptionFind: vi.fn(),
  subscriptionFindMany: vi.fn(),
}))
vi.mock('../src/lib/db.server', () => ({
  db: {
    user: { findUnique: mocks.user },
    coachingBillingAccount: {
      upsert: mocks.accountUpsert,
      findUnique: mocks.accountFind,
      findUniqueOrThrow: mocks.accountFindOrThrow,
      update: mocks.accountUpdate,
      updateMany: mocks.accountUpdateMany,
    },
    coachingSubscription: {
      upsert: mocks.subscriptionUpsert,
      findFirst: mocks.subscriptionFind,
      findMany: mocks.subscriptionFindMany,
    },
  },
}))
vi.mock('../src/lib/auth.server', () => ({
  getAuth: () => ({ api: { getSession: mocks.auth } }),
  isGoogleEnabled: () => true,
}))
vi.mock('stripe', async () => {
  const actual = await vi.importActual<typeof import('stripe')>('stripe')
  return {
    default: class extends actual.default {
      prices = { retrieve: mocks.price } as unknown as Stripe['prices']
      customers = { create: mocks.customer } as unknown as Stripe['customers']
      checkout = {
        sessions: {
          create: mocks.createCheckout,
          retrieve: mocks.retrieveCheckout,
          list: mocks.listCheckouts,
          expire: mocks.expireCheckout,
        },
      } as unknown as Stripe['checkout']
      subscriptions = {
        list: mocks.listSubscriptions,
        retrieve: mocks.retrieveSubscription,
      } as unknown as Stripe['subscriptions']
      billingPortal = { sessions: { create: mocks.portal } } as unknown as Stripe['billingPortal']
    },
  }
})

import StripeClient from 'stripe'
import {
  coachingCheckoutResponse,
  coachingConfiguration,
  coachingPageData,
  coachingPortalResponse,
  handleCoachingEvent,
  syncCoachingSubscription,
} from '../src/lib/subscriptions.server'
import { webhookResponse } from '../src/lib/commerce.server'

const secret = 'whsec_coaching_fixture'
const sessionId = 'cs_test_coaching123456789'
const request = (body = 'price=price_forged&userId=someone-else&amount=1') =>
  new Request('http://localhost:3000/api/coaching/checkout', {
    method: 'POST',
    headers: { Origin: 'http://localhost:3000' },
    body: new URLSearchParams(body),
  })
let account: {
  id: string
  userId: string
  livemode: boolean
  stripeCustomerId: string | null
  stripeCheckoutSessionId: string | null
  checkoutAttemptId: string | null
  checkoutLockUntil: Date | null
}
let subscription: Stripe.Subscription
let checkoutSession: Stripe.Checkout.Session
let price: Stripe.Price
let yearlyPrice: Stripe.Price
let saved: any[]

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_coaching_fixture')
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', secret)
  vi.stubEnv('STRIPE_COACHING_PRICE_ID', 'price_coaching1000')
  vi.stubEnv('STRIPE_COACHING_YEARLY_PRICE_ID', '')
  vi.stubEnv('APP_URL', 'http://localhost:3000')
  account = {
    id: 'billing-1',
    userId: 'client-1',
    livemode: false,
    stripeCustomerId: 'cus_coaching1',
    stripeCheckoutSessionId: null,
    checkoutAttemptId: null,
    checkoutLockUntil: null,
  }
  price = {
    id: 'price_coaching1000',
    active: true,
    livemode: false,
    type: 'recurring',
    recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' },
    billing_scheme: 'per_unit',
    unit_amount: onlineCoachingPlan.amountCents,
    currency: 'usd',
  } as Stripe.Price
  yearlyPrice = {
    ...price,
    id: 'price_coaching9600',
    unit_amount: onlineCoachingPlan.yearlyAmountCents,
    recurring: { ...price.recurring!, interval: 'year' },
  }
  const metadata = {
    store: 'rossiter',
    offering: 'online-coaching',
    userId: 'client-1',
    billingAccountId: 'billing-1',
    priceId: price.id,
  }
  subscription = {
    id: 'sub_coaching1',
    metadata,
    customer: 'cus_coaching1',
    livemode: false,
    status: 'active',
    cancel_at_period_end: false,
    cancel_at: null,
    created: 1791120000,
    items: { data: [{ price, quantity: 1, current_period_end: 1793798400 }] },
  } as unknown as Stripe.Subscription
  checkoutSession = {
    id: sessionId,
    mode: 'subscription',
    metadata,
    customer: 'cus_coaching1',
    client_reference_id: 'client-1',
    livemode: false,
    status: 'open',
    payment_status: 'unpaid',
    subscription: null,
    url: 'https://checkout.stripe.com/c/pay/coaching_fixture',
  } as unknown as Stripe.Checkout.Session
  saved = []
  mocks.auth.mockResolvedValue({ user: { id: 'client-1' } })
  mocks.user.mockResolvedValue({
    id: 'client-1',
    name: 'Alex Athlete',
    email: 'alex@example.com',
    role: 'CLIENT',
  })
  mocks.price.mockImplementation(async (id) => (id === yearlyPrice.id ? yearlyPrice : price))
  mocks.customer.mockResolvedValue({ id: 'cus_coaching1' })
  mocks.accountUpsert.mockImplementation(async () => ({ ...account }))
  mocks.accountFind.mockImplementation(async ({ where }) =>
    where.id && where.id !== account.id ? null : { ...account },
  )
  mocks.accountFindOrThrow.mockImplementation(async () => ({ ...account }))
  mocks.accountUpdate.mockImplementation(async ({ data }) => {
    Object.assign(account, data)
    return { ...account }
  })
  mocks.accountUpdateMany.mockImplementation(async ({ where, data }) => {
    if (where.OR && account.checkoutLockUntil && account.checkoutLockUntil > new Date())
      return { count: 0 }
    if (
      where.checkoutLockUntil &&
      account.checkoutLockUntil?.getTime() !== where.checkoutLockUntil.getTime()
    )
      return { count: 0 }
    Object.assign(account, data)
    return { count: 1 }
  })
  mocks.listSubscriptions.mockImplementation(() => (async function* () {})())
  mocks.listCheckouts.mockImplementation(() => (async function* () {})())
  mocks.retrieveSubscription.mockImplementation(async () => subscription)
  mocks.subscriptionUpsert.mockImplementation(async ({ create, update, where }) => {
    const existing = saved.find((item) => item.stripeSubscriptionId === where.stripeSubscriptionId)
    if (existing) {
      Object.assign(existing, update)
      return existing
    }
    const item = { id: 'membership-1', ...create }
    saved.push(item)
    return item
  })
  mocks.subscriptionFind.mockImplementation(
    async () => saved.find((item) => blocksNewSubscription(item.status)) || null,
  )
  mocks.subscriptionFindMany.mockImplementation(async () => saved)
  mocks.createCheckout.mockImplementation(async () => checkoutSession)
  mocks.retrieveCheckout.mockImplementation(async () => checkoutSession)
  mocks.expireCheckout.mockResolvedValue({})
  mocks.portal.mockResolvedValue({ url: 'https://billing.stripe.com/p/session/fixture' })
})
afterEach(() => vi.unstubAllEnvs())

describe('coaching checkout and billing ownership', () => {
  it('uses the server $1,000 monthly Stripe price and authenticated account despite forged fields', async () => {
    const response = await coachingCheckoutResponse(request())
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(checkoutSession.url)
    expect(mocks.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        customer: 'cus_coaching1',
        client_reference_id: 'client-1',
        line_items: [{ price: 'price_coaching1000', quantity: 1 }],
        subscription_data: {
          metadata: expect.objectContaining({ userId: 'client-1', offering: 'online-coaching' }),
        },
        success_url:
          'http://localhost:3000/work-with-me?coaching=success&billing=monthly&session_id={CHECKOUT_SESSION_ID}#online-coaching',
      }),
      { idempotencyKey: expect.stringContaining('coaching-checkout:billing-1:') },
    )
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(account.checkoutLockUntil).toBeNull()
  })
  it('requires matching origin before authentication or Stripe calls', async () => {
    const response = await coachingCheckoutResponse(
      new Request('http://localhost:3000/api/coaching/checkout', {
        method: 'POST',
        headers: { Origin: 'https://evil.example' },
      }),
    )
    expect(response.status).toBe(403)
    expect(mocks.auth).not.toHaveBeenCalled()
    expect(mocks.createCheckout).not.toHaveBeenCalled()
  })
  it('charges the annual $9,600 price and preserves the selected cadence on return', async () => {
    vi.stubEnv('STRIPE_COACHING_YEARLY_PRICE_ID', yearlyPrice.id)
    const response = await coachingCheckoutResponse(
      request('billing=yearly&amount=1&price=price_forged'),
    )
    expect(response.status).toBe(303)
    expect(mocks.price).toHaveBeenCalledWith('price_coaching9600')
    expect(mocks.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: 'price_coaching9600', quantity: 1 }],
        metadata: expect.objectContaining({ billing: 'yearly' }),
        cancel_url:
          'http://localhost:3000/work-with-me?coaching=cancelled&billing=yearly#online-coaching',
        success_url:
          'http://localhost:3000/work-with-me?coaching=success&billing=yearly&session_id={CHECKOUT_SESSION_ID}#online-coaching',
      }),
      expect.anything(),
    )
  })
  it.each(['billing=weekly', 'billing=year', 'billing=yearly&billing=monthly'])(
    'rejects invalid or ambiguous billing choices: %s',
    async (body) => {
      expect((await coachingCheckoutResponse(request(body))).headers.get('location')).toContain(
        'coaching=invalid-plan',
      )
      expect(mocks.createCheckout).not.toHaveBeenCalled()
    },
  )
  it('keeps monthly checkout available when yearly is not configured', async () => {
    const data = await coachingPageData(new Headers())
    expect(data.prices.monthly?.amountCents).toBe(100000)
    expect(data.prices.yearly).toBeNull()
    expect(data.enabled).toBe(true)
    expect(
      (await coachingCheckoutResponse(request('billing=yearly'))).headers.get('location'),
    ).toContain('coaching=unavailable&billing=yearly')
    expect(mocks.createCheckout).not.toHaveBeenCalled()
    await coachingCheckoutResponse(request('billing=monthly'))
    expect(mocks.createCheckout).toHaveBeenCalledTimes(1)
  })
  it('keeps yearly checkout available when monthly is not configured', async () => {
    vi.stubEnv('STRIPE_COACHING_PRICE_ID', '')
    vi.stubEnv('STRIPE_COACHING_YEARLY_PRICE_ID', yearlyPrice.id)
    const data = await coachingPageData(new Headers())
    expect(data.prices.monthly).toBeNull()
    expect(data.prices.yearly?.amountCents).toBe(960000)
    await coachingCheckoutResponse(request('billing=yearly'))
    expect(mocks.createCheckout).toHaveBeenCalledTimes(1)
  })
  it.each([100000, 384000, 1000000])(
    'rejects annual prices with mismatched amounts (%i) or intervals',
    async (amount) => {
      vi.stubEnv('STRIPE_COACHING_YEARLY_PRICE_ID', yearlyPrice.id)
      yearlyPrice.unit_amount = amount
      expect(validCoachingPrice(yearlyPrice, false, 'yearly')).toBe(false)
      expect(
        (await coachingCheckoutResponse(request('billing=yearly'))).headers.get('location'),
      ).toContain('coaching=error&billing=yearly')
      yearlyPrice.unit_amount = 960000
      yearlyPrice.recurring!.interval = 'month'
      expect(validCoachingPrice(yearlyPrice, false, 'yearly')).toBe(false)
      expect(mocks.createCheckout).not.toHaveBeenCalled()
    },
  )
  it('expires a monthly checkout before opening the annual checkout', async () => {
    await coachingCheckoutResponse(request('billing=monthly'))
    vi.stubEnv('STRIPE_COACHING_YEARLY_PRICE_ID', yearlyPrice.id)
    await coachingCheckoutResponse(request('billing=yearly'))
    expect(mocks.expireCheckout).toHaveBeenCalledWith(sessionId)
    expect(mocks.createCheckout).toHaveBeenLastCalledWith(
      expect.objectContaining({
        line_items: [{ price: yearlyPrice.id, quantity: 1 }],
      }),
      expect.anything(),
    )
    expect(mocks.createCheckout.mock.calls[0][1]).not.toEqual(mocks.createCheckout.mock.calls[1][1])
  })
  it('recovers and expires an unsaved monthly checkout before switching to annual', async () => {
    account.checkoutAttemptId = 'attempt-with-lost-response'
    mocks.listCheckouts.mockImplementation(() =>
      (async function* () {
        yield checkoutSession
      })(),
    )
    vi.stubEnv('STRIPE_COACHING_YEARLY_PRICE_ID', yearlyPrice.id)
    await coachingCheckoutResponse(request('billing=yearly'))
    expect(mocks.expireCheckout).toHaveBeenCalledWith(sessionId)
    expect(mocks.createCheckout).toHaveBeenCalledTimes(1)
  })
  it('recovers an unsaved checkout of the selected cadence without another creation', async () => {
    account.checkoutAttemptId = 'attempt-with-lost-response'
    mocks.listCheckouts.mockImplementation(() =>
      (async function* () {
        yield checkoutSession
      })(),
    )
    const response = await coachingCheckoutResponse(request('billing=monthly'))
    expect(response.headers.get('location')).toBe(checkoutSession.url)
    expect(account.stripeCheckoutSessionId).toBe(sessionId)
    expect(mocks.createCheckout).not.toHaveBeenCalled()
  })
  it('requires authentication and the live CLIENT role', async () => {
    mocks.auth.mockResolvedValueOnce(null)
    expect((await coachingCheckoutResponse(request())).headers.get('location')).toContain(
      'coaching=signin',
    )
    mocks.user.mockResolvedValueOnce({ id: 'client-1', role: 'ADMIN' })
    expect((await coachingCheckoutResponse(request())).headers.get('location')).toContain(
      'coaching=client-only',
    )
    expect(mocks.createCheckout).not.toHaveBeenCalled()
  })
  it('requires a key, webhook secret and price ID; live coaching is independent of the sample PDF', () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '')
    expect(coachingConfiguration().enabled).toBe(false)
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', secret)
    vi.stubEnv('STRIPE_COACHING_PRICE_ID', '')
    expect(coachingConfiguration().enabled).toBe(false)
    vi.stubEnv('STRIPE_COACHING_PRICE_ID', 'price_coaching1000')
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_live_coaching_fixture')
    expect(coachingConfiguration()).toEqual({ enabled: true, testMode: false })
  })
  it.each([
    { unit_amount: 100 },
    { unit_amount: 40000 },
    { currency: 'cad' },
    { active: false },
    { livemode: true },
    { recurring: { interval: 'year', interval_count: 1, usage_type: 'licensed' } },
    { recurring: { interval: 'month', interval_count: 2, usage_type: 'licensed' } },
    { type: 'one_time', recurring: null },
    { unit_amount: null },
  ])('rejects a misconfigured price before creating checkout: %j', async (change) => {
    Object.assign(price, change)
    expect(validCoachingPrice(price, false)).toBe(false)
    expect((await coachingCheckoutResponse(request())).headers.get('location')).toContain(
      'coaching=error',
    )
    expect(mocks.createCheckout).not.toHaveBeenCalled()
  })
  it('creates and saves an idempotent Stripe customer for a new client', async () => {
    account.stripeCustomerId = null
    await coachingCheckoutResponse(request())
    expect(mocks.customer).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'alex@example.com' }),
      {
        idempotencyKey: 'coaching-customer:billing-1',
      },
    )
    expect(account.stripeCustomerId).toBe('cus_coaching1')
  })
  it('reuses an open session after cancellation or a repeat click', async () => {
    await coachingCheckoutResponse(request())
    const response = await coachingCheckoutResponse(request())
    expect(response.headers.get('location')).toBe(checkoutSession.url)
    expect(mocks.createCheckout).toHaveBeenCalledTimes(1)
  })
  it('serializes simultaneous checkouts and does not release another request’s lease', async () => {
    account.checkoutLockUntil = new Date(Date.now() + 60000)
    expect((await coachingCheckoutResponse(request())).headers.get('location')).toContain(
      'coaching=busy',
    )
    expect(mocks.createCheckout).not.toHaveBeenCalled()
    expect(account.checkoutLockUntil).not.toBeNull()
  })
  it('keeps an idempotency key through an ambiguous network failure', async () => {
    mocks.createCheckout.mockRejectedValueOnce(new Error('Network timeout'))
    expect((await coachingCheckoutResponse(request())).headers.get('location')).toContain(
      'coaching=error',
    )
    const attempt = account.checkoutAttemptId
    await coachingCheckoutResponse(request())
    expect(attempt).toBeTruthy()
    expect(mocks.createCheckout.mock.calls[0][1]).toEqual(mocks.createCheckout.mock.calls[1][1])
  })
  it.each(['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused'])(
    'prevents a second subscription when the existing plan is %s',
    async (status) => {
      subscription.status = status as Stripe.Subscription.Status
      mocks.listSubscriptions.mockImplementation(() =>
        (async function* () {
          yield subscription
        })(),
      )
      expect((await coachingCheckoutResponse(request())).headers.get('location')).toContain(
        'coaching=existing',
      )
      expect(mocks.createCheckout).not.toHaveBeenCalled()
    },
  )
  it('allows resubscribing after a canceled subscription with a completed old checkout', async () => {
    subscription.status = 'canceled'
    await syncCoachingSubscription(subscription.id)
    account.stripeCheckoutSessionId = sessionId
    checkoutSession.status = 'complete'
    checkoutSession.subscription = subscription.id
    mocks.createCheckout.mockResolvedValueOnce({
      ...checkoutSession,
      id: 'cs_test_second123456789',
      status: 'open',
    })
    expect((await coachingCheckoutResponse(request())).headers.get('location')).toContain(
      'checkout.stripe.com',
    )
    expect(mocks.createCheckout).toHaveBeenCalledTimes(1)
  })
  it('creates billing portal sessions only for the signed-in customer', async () => {
    const response = await coachingPortalResponse(request('customer=cus_someone_else'))
    expect(response.headers.get('location')).toContain('billing.stripe.com')
    expect(mocks.portal).toHaveBeenCalledWith({
      customer: 'cus_coaching1',
      return_url: 'http://localhost:3000/work-with-me?coaching=billing#online-coaching',
    })
    mocks.auth.mockResolvedValueOnce(null)
    expect((await coachingPortalResponse(request())).headers.get('location')).toContain(
      'coaching=signin',
    )
  })
})

describe('subscription confirmation and lifecycle', () => {
  it('confirms yearly payment and retains its yearly amount and renewal interval', async () => {
    subscription.items.data[0].price = yearlyPrice
    subscription.items.data[0].current_period_end = 1822656000
    checkoutSession.status = 'complete'
    checkoutSession.payment_status = 'paid'
    checkoutSession.subscription = subscription.id
    const data = await coachingPageData(new Headers(), sessionId)
    expect(data.verification).toBe('confirmed')
    expect(data.subscription).toMatchObject({
      amountCents: 960000,
      interval: 'year',
      intervalCount: 1,
      currentPeriodEnd: new Date(1822656000 * 1000).toISOString(),
    })
  })
  it('does not trust a success query or an unpaid checkout as payment confirmation', async () => {
    checkoutSession.status = 'complete'
    checkoutSession.subscription = subscription.id
    const data = await coachingPageData(new Headers(), sessionId)
    expect(data.verification).toBe('pending')
    expect(data.subscription?.status).toBe('active')
  })
  it('confirms a paid checkout for its signed-in owner', async () => {
    checkoutSession.status = 'complete'
    checkoutSession.payment_status = 'paid'
    checkoutSession.subscription = subscription.id
    expect((await coachingPageData(new Headers(), sessionId)).verification).toBe('confirmed')
    expect(saved).toHaveLength(1)
  })
  it('rejects another account’s return URL without synchronizing its subscription', async () => {
    checkoutSession.client_reference_id = 'another-client'
    expect((await coachingPageData(new Headers(), sessionId)).verification).toBe('invalid')
    expect(mocks.retrieveSubscription).not.toHaveBeenCalled()
  })
  it.each(['customer', 'livemode', 'userId', 'billingAccountId'])(
    'rejects subscription ownership mismatch: %s',
    async (field) => {
      if (field === 'customer') subscription.customer = 'cus_other'
      else if (field === 'livemode') subscription.livemode = true
      else subscription.metadata[field] = 'someone-else'
      await expect(syncCoachingSubscription(subscription.id)).rejects.toThrow('ownership mismatch')
      expect(saved).toHaveLength(0)
    },
  )
  it('upserts replayed events, retrieves current status, and preserves historical pricing', async () => {
    price.id = 'price_coaching400'
    price.unit_amount = 40000
    await syncCoachingSubscription(subscription.id)
    subscription.status = 'past_due'
    vi.stubEnv('STRIPE_COACHING_PRICE_ID', 'price_new_offering')
    const event = {
      type: 'customer.subscription.updated',
      data: { object: { ...subscription, status: 'active' } },
    } as Stripe.Event
    await handleCoachingEvent(event)
    await handleCoachingEvent(event)
    expect(saved).toHaveLength(1)
    expect(saved[0].status).toBe('past_due')
    expect(saved[0].stripePriceId).toBe('price_coaching400')
    expect(saved[0].amountCents).toBe(40000)
  })
  it.each(['invoice.paid', 'invoice.payment_failed', 'invoice.payment_action_required'])(
    'refreshes subscription state for %s',
    async (type) => {
      await handleCoachingEvent({
        type,
        data: {
          object: {
            parent: { subscription_details: { subscription: 'sub_coaching1' } },
          },
        },
      } as Stripe.Event)
      expect(mocks.retrieveSubscription).toHaveBeenCalledWith('sub_coaching1')
    },
  )
  it('records scheduled cancellation, then revokes active status after it ends', async () => {
    subscription.cancel_at_period_end = true
    await syncCoachingSubscription(subscription.id)
    expect(saved[0].cancelAtPeriodEnd).toBe(true)
    expect(hasCoachingAccess(saved[0].status)).toBe(true)
    subscription.status = 'canceled'
    await handleCoachingEvent({
      type: 'customer.subscription.deleted',
      data: { object: subscription },
    } as Stripe.Event)
    expect(hasCoachingAccess(saved[0].status)).toBe(false)
    expect(blocksNewSubscription(saved[0].status)).toBe(false)
  })
  it('does not expose subscription data to an anonymous visitor', async () => {
    mocks.auth.mockResolvedValueOnce(null)
    const data = await coachingPageData(new Headers(), sessionId)
    expect(data.user).toBeNull()
    expect(data.subscription).toBeNull()
    expect(mocks.retrieveCheckout).not.toHaveBeenCalled()
  })
  it('handles signed live subscription webhooks even while the legacy sample PDF is blocked', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_live_coaching_fixture')
    account.livemode = true
    subscription.livemode = true
    const payload = JSON.stringify({
      id: 'evt_fixture',
      type: 'customer.subscription.created',
      data: { object: subscription },
    })
    const header = new StripeClient('sk_test_fixture').webhooks.generateTestHeaderString({
      payload,
      secret,
    })
    const response = await webhookResponse(
      new Request('http://localhost:3000/api/stripe/webhook', {
        method: 'POST',
        body: payload,
        headers: { 'stripe-signature': header },
      }),
    )
    expect(response.status).toBe(200)
    expect(saved).toHaveLength(1)
  })
  it('rejects an unsigned webhook before applying any state', async () => {
    const response = await webhookResponse(
      new Request('http://localhost:3000/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(subscription),
      }),
    )
    expect(response.status).toBe(400)
    expect(mocks.retrieveSubscription).not.toHaveBeenCalled()
  })
  it('returns retryable errors when a verified subscription cannot be saved', async () => {
    mocks.subscriptionUpsert.mockRejectedValueOnce(new Error('Database unavailable'))
    const payload = JSON.stringify({
      id: 'evt_retry',
      type: 'customer.subscription.updated',
      data: { object: subscription },
    })
    const header = new StripeClient('sk_test_fixture').webhooks.generateTestHeaderString({
      payload,
      secret,
    })
    expect(
      (
        await webhookResponse(
          new Request('http://localhost:3000/api/stripe/webhook', {
            method: 'POST',
            body: payload,
            headers: { 'stripe-signature': header },
          }),
        )
      ).status,
    ).toBe(503)
  })
})
