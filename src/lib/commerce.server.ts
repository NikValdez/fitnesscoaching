import 'dotenv/config'
import Stripe from 'stripe'
import { db } from './db.server'
import { pdfProgram } from './product'
import { matchesPurchase, validSessionId } from './commerce-validation'
import programPdf from '../../output/pdf/69-easy-sample.pdf?inline'

const privateHeaders = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }

export function checkoutConfiguration() {
  const key = process.env.STRIPE_SECRET_KEY || ''
  const testMode = key.startsWith('sk_test_')
  const hasKey = testMode || key.startsWith('sk_live_')
  // The placeholder document can only be bought in Stripe test mode.
  return { enabled: hasKey && (testMode || !pdfProgram.isSample), testMode }
}

function stripeClient() {
  if (!checkoutConfiguration().enabled) throw new Error('Checkout unavailable')
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { maxNetworkRetries: 2, timeout: 15000 })
}

function storeOrigin() {
  const url = new URL(process.env.APP_URL || process.env.BETTER_AUTH_URL || 'http://localhost:3000')
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
  )
    throw new Error('Configure an HTTPS APP_URL')
  return url.origin
}

export async function checkoutResponse(request: Request) {
  const origin = storeOrigin()
  if (request.headers.get('origin') !== origin)
    return new Response('Invalid request origin.', { status: 403, headers: privateHeaders })
  const back = (reason: string) =>
    new Response(null, {
      status: 303,
      headers: { ...privateHeaders, Location: `${origin}/program?checkout=${reason}` },
    })
  if (!checkoutConfiguration().enabled) return back('unavailable')
  let session: Stripe.Checkout.Session | undefined
  const stripe = stripeClient()
  try {
    // Price and product are selected here; no price, URL, or product from the browser is trusted.
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: pdfProgram.currency,
            unit_amount: pdfProgram.amountCents,
            product_data: {
              name: pdfProgram.name,
              description: pdfProgram.isSample
                ? 'Sample PDF program - test purchase only'
                : 'Downloadable PDF program',
            },
          },
        },
      ],
      metadata: { store: 'rossiter', productId: pdfProgram.id },
      success_url: `${origin}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/program?checkout=cancelled`,
    })
    if (!session.url || new URL(session.url).origin !== 'https://checkout.stripe.com')
      throw new Error('Missing checkout URL')
    await db.purchase.create({
      data: {
        stripeSessionId: session.id,
        productId: pdfProgram.id,
        amountCents: pdfProgram.amountCents,
        currency: pdfProgram.currency,
        livemode: session.livemode,
      },
    })
    return new Response(null, {
      status: 303,
      headers: { ...privateHeaders, Location: session.url },
    })
  } catch {
    if (session) await stripe.checkout.sessions.expire(session.id).catch(() => undefined)
    return back('error')
  }
}

export async function fulfillPurchase(sessionId: string): Promise<'paid' | 'pending' | 'invalid'> {
  if (!validSessionId(sessionId)) return 'invalid'
  const purchase = await db.purchase.findUnique({ where: { stripeSessionId: sessionId } })
  if (!purchase || purchase.productId !== pdfProgram.id) return 'invalid'
  // Retrieve payment state from Stripe even when a prior request already marked this order paid.
  const session = await stripeClient().checkout.sessions.retrieve(sessionId)
  if (!matchesPurchase(session, purchase)) return 'invalid'
  if (session.status !== 'complete' || session.payment_status !== 'paid') return 'pending'
  await db.purchase.updateMany({
    where: { id: purchase.id, paidAt: null },
    data: { paidAt: new Date(), email: session.customer_details?.email || null },
  })
  return 'paid'
}

export async function webhookResponse(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret || !checkoutConfiguration().enabled)
    return new Response('Webhook unavailable.', { status: 503 })
  let event: Stripe.Event
  try {
    event = stripeClient().webhooks.constructEvent(
      await request.text(),
      request.headers.get('stripe-signature') || '',
      secret,
    )
  } catch {
    return new Response('Invalid webhook signature.', { status: 400 })
  }
  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded'
  ) {
    const session = event.data.object
    if (session.metadata?.store === 'rossiter' && session.metadata?.productId === pdfProgram.id) {
      try {
        const result = await fulfillPurchase(session.id)
        if (result !== 'paid')
          return new Response('Payment not ready for fulfillment.', { status: 503 })
      } catch {
        return new Response('Please retry delivery.', { status: 503 })
      }
    }
  }
  return Response.json({ received: true })
}

export async function downloadResponse(request: Request) {
  const sessionId = new URL(request.url).searchParams.get('session_id') || ''
  if (!validSessionId(sessionId))
    return new Response('A valid purchase is required.', { status: 403, headers: privateHeaders })
  try {
    if ((await fulfillPurchase(sessionId)) !== 'paid')
      return new Response('Payment has not been confirmed.', {
        status: 403,
        headers: privateHeaders,
      })
    const bytes = Buffer.from(programPdf.slice(programPdf.indexOf(',') + 1), 'base64')
    return new Response(bytes, {
      headers: {
        ...privateHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfProgram.filename}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return new Response('Could not verify payment. Please try again.', {
      status: 503,
      headers: privateHeaders,
    })
  }
}
