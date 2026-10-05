import type Stripe from 'stripe'
import { db } from './db.server'
import { getAuth, isGoogleEnabled } from './auth.server'
import { validSessionId } from './commerce-validation'
import { coachingBillingCadence, type CoachingBillingCadence } from './coaching-offering'
import {
  blocksNewSubscription,
  coachingOffering,
  hasCoachingAccess,
  matchesCoachingCheckout,
  matchesCoachingSubscription,
  stripeId,
  validCoachingPrice,
} from './subscription-validation'
import {
  privateBillingHeaders,
  storeOrigin,
  stripeClient,
  stripeConfiguration,
} from './stripe.server'

function coachingPriceId(billing: CoachingBillingCadence) {
  return billing === 'yearly'
    ? process.env.STRIPE_COACHING_YEARLY_PRICE_ID
    : process.env.STRIPE_COACHING_PRICE_ID
}

export function coachingConfiguration(billing: CoachingBillingCadence = 'monthly') {
  const config = stripeConfiguration()
  return {
    ...config,
    enabled:
      config.enabled &&
      Boolean(process.env.STRIPE_WEBHOOK_SECRET) &&
      /^price_[A-Za-z0-9]+$/.test(coachingPriceId(billing) || ''),
  }
}

async function coachingPrice(billing: CoachingBillingCadence) {
  const config = coachingConfiguration(billing)
  if (!config.enabled) return null
  const price = await stripeClient().prices.retrieve(coachingPriceId(billing)!)
  if (!validCoachingPrice(price, !config.testMode, billing))
    throw new Error('Invalid coaching price')
  return { id: price.id, amountCents: price.unit_amount!, currency: price.currency }
}

function backToCoaching(reason: string, billing?: CoachingBillingCadence) {
  return billingRedirect(
    `${storeOrigin()}/work-with-me?coaching=${reason}${billing ? `&billing=${billing}` : ''}#online-coaching`,
  )
}

function billingRedirect(url: string) {
  return new Response(null, {
    status: 303,
    headers: { ...privateBillingHeaders, Location: url },
  })
}

function checkoutRedirect(session: Stripe.Checkout.Session) {
  if (!session.url || new URL(session.url).origin !== 'https://checkout.stripe.com')
    throw new Error('Missing checkout URL')
  return billingRedirect(session.url)
}

async function billingUser(headers: Headers) {
  const session = await getAuth().api.getSession({ headers })
  if (!session) return null
  return db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true },
  })
}

// Webhooks and the return page both retrieve the current Stripe state. Replayed
// or delayed events therefore never apply an old event's subscription snapshot.
export async function syncCoachingSubscription(subscriptionId: string) {
  const subscription = await stripeClient().subscriptions.retrieve(subscriptionId)
  if (
    subscription.metadata.store !== 'rossiter' ||
    subscription.metadata.offering !== coachingOffering
  )
    return null
  const account = await db.coachingBillingAccount.findUnique({
    where: { id: subscription.metadata.billingAccountId || '' },
  })
  if (!account || !matchesCoachingSubscription(subscription, account))
    throw new Error('Subscription ownership mismatch')
  const item = subscription.items.data[0]
  if (
    subscription.items.data.length !== 1 ||
    !item?.price.recurring ||
    item.price.unit_amount === null
  )
    throw new Error('Unsupported coaching subscription')
  const data = {
    billingAccountId: account.id,
    stripePriceId: item.price.id,
    status: subscription.status,
    amountCents: item.price.unit_amount,
    currency: item.price.currency,
    interval: item.price.recurring.interval,
    intervalCount: item.price.recurring.interval_count,
    currentPeriodEnd: new Date(item.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end || subscription.cancel_at !== null,
    stripeCreatedAt: new Date(subscription.created * 1000),
  }
  return db.coachingSubscription.upsert({
    where: { stripeSubscriptionId: subscription.id },
    create: { ...data, stripeSubscriptionId: subscription.id },
    update: data,
  })
}

async function refreshSubscriptions(customerId: string) {
  // Include incomplete/past-due/paused subscriptions to avoid charging a client
  // for a second plan when their existing payment needs attention.
  for await (const subscription of stripeClient().subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 100,
  })) {
    if (
      subscription.metadata.store === 'rossiter' &&
      subscription.metadata.offering === coachingOffering
    )
      await syncCoachingSubscription(subscription.id)
  }
}

async function confirmCoachingCheckout(sessionId: string, userId: string) {
  if (!validSessionId(sessionId)) return 'invalid' as const
  const session = await stripeClient().checkout.sessions.retrieve(sessionId)
  // A checkout URL is not an account credential. Check the signed-in owner.
  if (session.client_reference_id !== userId) return 'invalid' as const
  const account = await db.coachingBillingAccount.findUnique({
    where: { id: session.metadata?.billingAccountId || '' },
  })
  if (!account || !matchesCoachingCheckout(session, account)) return 'invalid' as const
  const subscriptionId = stripeId(session.subscription)
  if (session.status !== 'complete' || !subscriptionId) return 'pending' as const
  const subscription = await syncCoachingSubscription(subscriptionId)
  return subscription &&
    hasCoachingAccess(subscription.status) &&
    ['paid', 'no_payment_required'].includes(session.payment_status)
    ? ('confirmed' as const)
    : ('pending' as const)
}

export async function coachingPageData(headers: Headers, sessionId?: string, refresh = false) {
  const config = coachingConfiguration()
  const user = await billingUser(headers)
  // Each cadence is configured independently; a missing annual price must not
  // prevent monthly signups, or vice versa.
  const priceResults = await Promise.allSettled([coachingPrice('monthly'), coachingPrice('yearly')])
  const prices = {
    monthly: priceResults[0].status === 'fulfilled' ? priceResults[0].value : null,
    yearly: priceResults[1].status === 'fulfilled' ? priceResults[1].value : null,
  }
  let verification: 'confirmed' | 'pending' | 'invalid' | 'error' | null = null
  if (user && stripeConfiguration().enabled && sessionId) {
    try {
      verification = await confirmCoachingCheckout(sessionId, user.id)
    } catch {
      verification = 'error'
    }
  }
  const account =
    user && stripeConfiguration().enabled
      ? await db.coachingBillingAccount.findUnique({
          where: { userId_livemode: { userId: user.id, livemode: !config.testMode } },
        })
      : null
  if (refresh && account?.stripeCustomerId) {
    try {
      await refreshSubscriptions(account.stripeCustomerId)
    } catch {
      verification = 'error'
    }
  }
  const subscriptions = account
    ? await db.coachingSubscription.findMany({
        where: { billingAccountId: account.id },
        orderBy: { stripeCreatedAt: 'desc' },
      })
    : []
  const subscription =
    subscriptions.find((item) => blocksNewSubscription(item.status)) || subscriptions[0]
  return {
    enabled: Boolean(prices.monthly || prices.yearly),
    testMode: config.testMode,
    googleEnabled: isGoogleEnabled(),
    user,
    prices,
    verification,
    subscription: subscription
      ? {
          status: subscription.status,
          hasAccess: hasCoachingAccess(subscription.status),
          blocksCheckout: blocksNewSubscription(subscription.status),
          amountCents: subscription.amountCents,
          currency: subscription.currency,
          interval: subscription.interval,
          intervalCount: subscription.intervalCount,
          currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        }
      : null,
    canManageBilling: Boolean(account?.stripeCustomerId) && stripeConfiguration().enabled,
  }
}

export async function coachingCheckoutResponse(request: Request) {
  if (request.headers.get('origin') !== storeOrigin())
    return new Response('Invalid request origin.', { status: 403, headers: privateBillingHeaders })
  let billing: CoachingBillingCadence
  try {
    const fields = request.headers.has('content-type') ? await request.formData() : new FormData()
    if (fields.getAll('billing').length > 1) return backToCoaching('invalid-plan')
    const selection = fields.get('billing')
    const cadence = selection === null ? 'monthly' : coachingBillingCadence(selection)
    if (!cadence) return backToCoaching('invalid-plan')
    billing = cadence
  } catch {
    return backToCoaching('invalid-plan')
  }
  const back = (reason: string) => backToCoaching(reason, billing)
  const user = await billingUser(request.headers)
  if (!user) return back('signin')
  if (user.role !== 'CLIENT') return back('client-only')
  if (!coachingConfiguration(billing).enabled) return back('unavailable')
  const stripe = stripeClient()
  let accountId: string | undefined
  let lockUntil: Date | undefined
  try {
    const price = await coachingPrice(billing)
    if (!price) return back('unavailable')
    let account = await db.coachingBillingAccount.upsert({
      where: { userId_livemode: { userId: user.id, livemode: !coachingConfiguration().testMode } },
      create: { userId: user.id, livemode: !coachingConfiguration().testMode },
      update: {},
    })
    // A database lease serializes double-clicks and requests from multiple tabs
    // without holding a database transaction during Stripe network calls.
    lockUntil = new Date(Date.now() + 5 * 60 * 1000)
    const claim = await db.coachingBillingAccount.updateMany({
      where: {
        id: account.id,
        OR: [{ checkoutLockUntil: null }, { checkoutLockUntil: { lt: new Date() } }],
      },
      data: { checkoutLockUntil: lockUntil },
    })
    if (!claim.count) return back('busy')
    accountId = account.id
    // Re-read after claiming; another request may have just saved a customer.
    account = await db.coachingBillingAccount.findUniqueOrThrow({ where: { id: account.id } })
    if (!account.stripeCustomerId) {
      const customer = await stripe.customers.create(
        { email: user.email, name: user.name, metadata: { store: 'rossiter', userId: user.id } },
        { idempotencyKey: `coaching-customer:${account.id}` },
      )
      account = await db.coachingBillingAccount.update({
        where: { id: account.id },
        data: { stripeCustomerId: customer.id },
      })
    }
    await refreshSubscriptions(account.stripeCustomerId!)
    const existing = await db.coachingSubscription.findFirst({
      where: {
        billingAccountId: account.id,
        status: { notIn: ['canceled', 'incomplete_expired'] },
      },
    })
    if (existing) return back('existing')
    if (!account.stripeCheckoutSessionId && account.checkoutAttemptId) {
      // Recover an open session when Stripe created it but the previous request
      // lost the response. Expire another cadence before opening a new one.
      for await (const open of stripe.checkout.sessions.list({
        customer: account.stripeCustomerId!,
        status: 'open',
        limit: 100,
      })) {
        if (!matchesCoachingCheckout(open, account)) continue
        if (open.metadata?.priceId !== price.id) {
          await stripe.checkout.sessions.expire(open.id)
        } else {
          account = await db.coachingBillingAccount.update({
            where: { id: account.id },
            data: { stripeCheckoutSessionId: open.id },
          })
          return checkoutRedirect(open)
        }
      }
    }
    if (account.stripeCheckoutSessionId) {
      const pending = await stripe.checkout.sessions.retrieve(account.stripeCheckoutSessionId)
      if (!matchesCoachingCheckout(pending, account)) throw new Error('Checkout ownership mismatch')
      if (pending.status === 'open' && pending.metadata?.priceId === price.id)
        return checkoutRedirect(pending)
      if (pending.status === 'complete') {
        const subscriptionId = stripeId(pending.subscription)
        const previous = subscriptionId ? await syncCoachingSubscription(subscriptionId) : null
        if (!previous || blocksNewSubscription(previous.status)) return back('pending')
      }
      if (pending.status === 'open') await stripe.checkout.sessions.expire(pending.id)
      account = await db.coachingBillingAccount.update({
        where: { id: account.id },
        data: { stripeCheckoutSessionId: null, checkoutAttemptId: null },
      })
    }
    if (!account.checkoutAttemptId) {
      account = await db.coachingBillingAccount.update({
        where: { id: account.id },
        data: { checkoutAttemptId: crypto.randomUUID() },
      })
    }
    const metadata = {
      store: 'rossiter',
      offering: coachingOffering,
      billingAccountId: account.id,
      userId: user.id,
      priceId: price.id,
      billing,
    }
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        customer: account.stripeCustomerId!,
        client_reference_id: user.id,
        line_items: [{ price: price.id, quantity: 1 }],
        metadata,
        subscription_data: { metadata },
        success_url: `${storeOrigin()}/work-with-me?coaching=success&billing=${billing}&session_id={CHECKOUT_SESSION_ID}#online-coaching`,
        cancel_url: `${storeOrigin()}/work-with-me?coaching=cancelled&billing=${billing}#online-coaching`,
      },
      {
        idempotencyKey: `coaching-checkout:${account.id}:${price.id}:${account.checkoutAttemptId}`,
      },
    )
    if (session.status === 'expired') {
      await db.coachingBillingAccount.update({
        where: { id: account.id },
        data: { stripeCheckoutSessionId: null, checkoutAttemptId: null },
      })
      return back('error')
    }
    await db.coachingBillingAccount.update({
      where: { id: account.id },
      data: { stripeCheckoutSessionId: session.id },
    })
    return checkoutRedirect(session)
  } catch {
    // Keep the attempt key after network/database failures. Retrying recovers
    // the same Stripe session rather than creating another subscription.
    return back('error')
  } finally {
    if (accountId && lockUntil)
      await db.coachingBillingAccount
        .updateMany({
          where: { id: accountId, checkoutLockUntil: lockUntil },
          data: { checkoutLockUntil: null },
        })
        .catch(() => undefined)
  }
}

export async function coachingPortalResponse(request: Request) {
  if (request.headers.get('origin') !== storeOrigin())
    return new Response('Invalid request origin.', { status: 403, headers: privateBillingHeaders })
  const user = await billingUser(request.headers)
  if (!user) return backToCoaching('signin')
  if (!stripeConfiguration().enabled) return backToCoaching('unavailable')
  try {
    const account = await db.coachingBillingAccount.findUnique({
      where: { userId_livemode: { userId: user.id, livemode: !stripeConfiguration().testMode } },
    })
    if (!account?.stripeCustomerId) return backToCoaching('no-subscription')
    const session = await stripeClient().billingPortal.sessions.create({
      customer: account.stripeCustomerId,
      return_url: `${storeOrigin()}/work-with-me?coaching=billing#online-coaching`,
    })
    if (new URL(session.url).origin !== 'https://billing.stripe.com')
      throw new Error('Missing portal URL')
    return billingRedirect(session.url)
  } catch {
    return backToCoaching('billing-error')
  }
}

export async function handleCoachingEvent(event: Stripe.Event) {
  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted' ||
    event.type === 'customer.subscription.paused' ||
    event.type === 'customer.subscription.resumed'
  ) {
    if (
      event.data.object.metadata.store === 'rossiter' &&
      event.data.object.metadata.offering === coachingOffering
    )
      await syncCoachingSubscription(event.data.object.id)
  } else if (
    event.type === 'invoice.paid' ||
    event.type === 'invoice.payment_failed' ||
    event.type === 'invoice.payment_action_required'
  ) {
    const subscriptionId = stripeId(event.data.object.parent?.subscription_details?.subscription)
    if (subscriptionId) await syncCoachingSubscription(subscriptionId)
  } else if (
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded' ||
    event.type === 'checkout.session.async_payment_failed'
  ) {
    const session = event.data.object
    if (session.metadata?.store !== 'rossiter' || session.metadata.offering !== coachingOffering)
      return
    const account = await db.coachingBillingAccount.findUnique({
      where: { id: session.metadata.billingAccountId || '' },
    })
    if (!account || !matchesCoachingCheckout(session, account))
      throw new Error('Checkout ownership mismatch')
    const subscriptionId = stripeId(session.subscription)
    if (subscriptionId) await syncCoachingSubscription(subscriptionId)
  }
}
