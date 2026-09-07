import { createFileRoute } from '@tanstack/react-router'
import { webhookResponse } from '../../../lib/commerce.server'

export const Route = createFileRoute('/api/stripe/webhook')({
  server: { handlers: { POST: ({ request }) => webhookResponse(request) } },
})
