import { createFileRoute } from '@tanstack/react-router'
import { coachingCheckoutResponse } from '../../../lib/subscriptions.server'

export const Route = createFileRoute('/api/coaching/checkout')({
  server: { handlers: { POST: ({ request }) => coachingCheckoutResponse(request) } },
})
