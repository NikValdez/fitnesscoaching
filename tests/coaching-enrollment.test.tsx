import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { CoachingOfferingData } from '../src/lib/subscriptions'
import type { CoachingBillingCadence } from '../src/lib/coaching-offering'

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: vi.fn() }),
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) =>
    createElement('a', { href: to, ...props }, children),
}))
import { CoachingEnrollment } from '../src/components/coaching-enrollment'

const offering: CoachingOfferingData = {
  enabled: true,
  testMode: false,
  googleEnabled: true,
  user: null,
  prices: {
    monthly: { id: 'price_coaching1000', amountCents: 100000, currency: 'usd' },
    yearly: { id: 'price_coaching9600', amountCents: 960000, currency: 'usd' },
  },
  verification: null,
  subscription: null,
  canManageBilling: false,
}
const client = {
  id: 'client-1',
  name: 'Alex Athlete',
  email: 'alex@example.com',
  role: 'CLIENT' as const,
}
const render = (data: CoachingOfferingData, result?: string, billing?: CoachingBillingCadence) =>
  renderToStaticMarkup(createElement(CoachingEnrollment, { data, result, billing }))

describe('coaching offering UI', () => {
  it('displays $1,000 monthly with inline signup and Google returning to the work page', () => {
    const html = render(offering)
    expect(html).toContain('$1,000')
    expect(html).toContain('/ month')
    expect(html).not.toContain('USD')
    expect(html).toContain('Create account &amp; continue')
    expect(html).toContain('name="password"')
    expect(html).toContain('action="/api/coaching/checkout"')
  })
  it('shows a checkout button for a signed-in client', () => {
    const html = render({ ...offering, user: client })
    expect(html).toContain('Subscribe &amp; start coaching')
    expect(html).toContain('alex@example.com')
    expect(html).not.toContain('name="password"')
  })
  it('keeps checkout disabled with an explanation when Stripe is unconfigured', () => {
    const html = render({ ...offering, enabled: false, prices: { monthly: null, yearly: null } })
    expect(html).toContain('Monthly signup is opening soon')
    expect(html).toContain('disabled=""')
    expect(html).toContain('$1,000')
  })
  it('shows the annual charge, effective monthly price and 20% savings', () => {
    const html = render(offering, undefined, 'yearly')
    expect(html).toContain('$9,600')
    expect(html).toContain('/ year')
    expect(html).toContain('Save 20%')
    expect(html).toContain('Equivalent to $800 / month.')
    expect(html).toContain('Save $2,400 per year.')
    expect(html).toContain('Billed in full once a year. Renews annually until you cancel.')
    expect(html).toContain('name="billing" value="yearly"')
    expect(html).not.toContain('USD')
  })
  it('keeps the subscriber’s historical annual price even with the monthly option in the URL', () => {
    const html = render({
      ...offering,
      user: client,
      canManageBilling: true,
      subscription: {
        status: 'active',
        hasAccess: true,
        blocksCheckout: true,
        amountCents: 384000,
        currency: 'usd',
        interval: 'year',
        intervalCount: 1,
        currentPeriodEnd: '2027-10-04T00:00:00.000Z',
        cancelAtPeriodEnd: false,
      },
    })
    expect(html).toContain('Yearly membership')
    expect(html).toContain('$3,840')
    expect(html).not.toContain('Billing frequency')
    expect(html).not.toContain('$1,000')
  })
  it('does not claim a subscription is confirmed based only on the success query', () => {
    const html = render(offering, 'success')
    expect(html).not.toContain('Your coaching subscription is confirmed')
    expect(html).toContain('Sign in with the account you used at checkout')
  })
  it.each(['active', 'past_due', 'paused'])(
    'shows billing management and blocks a new checkout for %s',
    (status) => {
      const html = render({
        ...offering,
        user: client,
        canManageBilling: true,
        subscription: {
          status,
          hasAccess: status === 'active',
          blocksCheckout: true,
          amountCents: 40000,
          currency: 'usd',
          interval: 'month',
          intervalCount: 1,
          currentPeriodEnd: '2026-11-04T00:00:00.000Z',
          cancelAtPeriodEnd: false,
        },
      })
      expect(html).toContain('Manage billing &amp; subscription')
      expect(html).not.toContain('Subscribe &amp; start coaching')
      if (status === 'active') expect(html).toContain('Continue to your client space')
      if (status === 'past_due') expect(html).toContain('Payment needs attention')
    },
  )
})
