import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import { pdfProgram } from '../src/lib/product'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  retrieve: vi.fn(),
  expire: vi.fn(),
  dbCreate: vi.fn(),
  findUnique: vi.fn(),
  updateMany: vi.fn(),
}))
vi.mock('../src/lib/db.server', () => ({
  db: {
    purchase: {
      create: mocks.dbCreate,
      findUnique: mocks.findUnique,
      updateMany: mocks.updateMany,
    },
  },
}))
vi.mock('stripe', async () => {
  const actual = await vi.importActual<typeof import('stripe')>('stripe')
  return {
    default: class {
      checkout = {
        sessions: { create: mocks.create, retrieve: mocks.retrieve, expire: mocks.expire },
      }
      webhooks = new actual.default('sk_test_local_fixture').webhooks
    },
  }
})

import StripeClient from 'stripe'
import {
  checkoutConfiguration,
  checkoutResponse,
  downloadResponse,
  fulfillPurchase,
  webhookResponse,
} from '../src/lib/commerce.server'

const sessionId = 'cs_test_1234567890abcdef'
const secret = 'whsec_local_test_fixture'
const request = (body = '') =>
  new Request('http://localhost:3000/api/checkout', {
    method: 'POST',
    headers: { Origin: 'http://localhost:3000' },
    body,
  })
let order: {
  id: string
  stripeSessionId: string
  productId: string
  amountCents: number
  currency: string
  livemode: boolean
  paidAt: Date | null
}
let session: Stripe.Checkout.Session

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_local_fixture')
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', secret)
  vi.stubEnv('APP_URL', 'http://localhost:3000')
  order = {
    id: 'order-1',
    stripeSessionId: sessionId,
    productId: pdfProgram.id,
    amountCents: 4900,
    currency: 'usd',
    livemode: false,
    paidAt: null,
  }
  session = {
    id: sessionId,
    mode: 'payment',
    status: 'complete',
    payment_status: 'paid',
    amount_total: 4900,
    currency: 'usd',
    livemode: false,
    metadata: { productId: pdfProgram.id, store: 'rossiter' },
    url: 'https://checkout.stripe.com/c/pay/fixture',
    customer_details: { email: 'buyer@example.com' },
  } as unknown as Stripe.Checkout.Session
  mocks.create.mockImplementation(async () => session)
  mocks.retrieve.mockImplementation(async () => session)
  mocks.expire.mockResolvedValue({})
  mocks.dbCreate.mockResolvedValue(order)
  mocks.findUnique.mockImplementation(async ({ where }) =>
    where.stripeSessionId === sessionId ? order : null,
  )
  mocks.updateMany.mockImplementation(async ({ where, data }) => {
    if (where.id === order.id && where.paidAt === null && !order.paidAt) {
      order.paidAt = data.paidAt
      return { count: 1 }
    }
    return { count: 0 }
  })
})
afterEach(() => vi.unstubAllEnvs())

describe('Stripe PDF purchase', () => {
  it('uses only the server price and guest checkout despite forged form fields', async () => {
    const response = await checkoutResponse(
      request('amount=1&currency=eur&success_url=https://evil.example'),
    )
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(session.url)
    const input = mocks.create.mock.calls[0][0]
    expect(input.line_items[0].price_data.unit_amount).toBe(4900)
    expect(input.line_items[0].price_data.currency).toBe('usd')
    expect(input.success_url).toBe(
      'http://localhost:3000/purchase/success?session_id={CHECKOUT_SESSION_ID}',
    )
    expect(input.customer).toBeUndefined()
    expect(mocks.dbCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ stripeSessionId: sessionId, amountCents: 4900 }),
    })
  })
  it('rejects cross-origin creation and never starts Stripe checkout', async () => {
    expect(
      (
        await checkoutResponse(
          new Request('http://localhost:3000/api/checkout', {
            method: 'POST',
            headers: { Origin: 'https://elsewhere.example' },
          }),
        )
      ).status,
    ).toBe(403)
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('keeps missing keys and live purchases of the placeholder disabled', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '')
    expect(checkoutConfiguration().enabled).toBe(false)
    expect((await checkoutResponse(request())).headers.get('location')).toContain(
      'checkout=unavailable',
    )
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_live_local_fixture')
    expect(checkoutConfiguration().enabled).toBe(false)
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('expires the Stripe session if the order cannot be saved', async () => {
    mocks.dbCreate.mockRejectedValueOnce(new Error('Database unavailable'))
    expect((await checkoutResponse(request())).headers.get('location')).toContain('checkout=error')
    expect(mocks.expire).toHaveBeenCalledWith(sessionId)
  })
  it('does not accept a session ID as proof of purchase', async () => {
    expect(await fulfillPurchase('cs_test_unknown123456')).toBe('invalid')
    expect(mocks.retrieve).not.toHaveBeenCalled()
    expect(
      (
        await downloadResponse(
          new Request('http://localhost:3000/api/program/download?session_id=forged'),
        )
      ).status,
    ).toBe(403)
  })
  it.each([
    { amount_total: 1 },
    { currency: 'eur' },
    { livemode: true },
    { mode: 'subscription' },
    { metadata: { store: 'rossiter', productId: 'another-product' } },
    { metadata: { store: 'another-store', productId: pdfProgram.id } },
  ])('rejects mismatched Stripe payment details: %j', async (patch) => {
    Object.assign(session, patch)
    expect(await fulfillPurchase(sessionId)).toBe('invalid')
    expect(mocks.updateMany).not.toHaveBeenCalled()
  })
  it('blocks an unpaid download even if a prior request marked the order paid', async () => {
    order.paidAt = new Date()
    session.payment_status = 'unpaid'
    expect(await fulfillPurchase(sessionId)).toBe('pending')
    const result = await downloadResponse(
      new Request(`http://localhost:3000/api/program/download?session_id=${sessionId}`),
    )
    expect(result.status).toBe(403)
    expect(result.headers.get('cache-control')).toContain('no-store')
  })
  it('returns the real PDF only after verifying payment with Stripe', async () => {
    const response = await downloadResponse(
      new Request(`http://localhost:3000/api/program/download?session_id=${sessionId}`),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(response.headers.get('content-disposition')).toContain('69-easy.pdf')
    const bytes = Buffer.from(await response.arrayBuffer())
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-')
    expect(bytes.length).toBeGreaterThan(1000)
    expect(order.paidAt).toBeInstanceOf(Date)
  })
  it('rejects unsigned webhooks', async () => {
    const result = await webhookResponse(
      new Request('http://localhost:3000/api/stripe/webhook', { method: 'POST', body: '{}' }),
    )
    expect(result.status).toBe(400)
    expect(mocks.retrieve).not.toHaveBeenCalled()
  })
  it('verifies signed events and fulfills duplicate deliveries idempotently', async () => {
    const payload = JSON.stringify({
      id: 'evt_local_fixture',
      type: 'checkout.session.completed',
      data: { object: session },
    })
    const signature = new StripeClient('sk_test_local_fixture').webhooks.generateTestHeaderString({
      payload,
      secret,
    })
    const eventRequest = () =>
      new Request('http://localhost:3000/api/stripe/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': signature },
        body: payload,
      })
    expect((await webhookResponse(eventRequest())).status).toBe(200)
    const paidAt = order.paidAt
    expect(paidAt).toBeInstanceOf(Date)
    expect((await webhookResponse(eventRequest())).status).toBe(200)
    expect(order.paidAt).toBe(paidAt)
    mocks.retrieve.mockRejectedValueOnce(new Error('Stripe unavailable'))
    expect((await webhookResponse(eventRequest())).status).toBe(503)
  })
})
