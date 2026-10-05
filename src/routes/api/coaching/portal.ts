import { createFileRoute } from '@tanstack/react-router'
import { coachingPortalResponse } from '../../../lib/subscriptions.server'

export const Route = createFileRoute('/api/coaching/portal')({
  server: { handlers: { POST: ({ request }) => coachingPortalResponse(request) } },
})
