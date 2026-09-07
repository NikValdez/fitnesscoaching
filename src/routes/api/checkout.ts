import { createFileRoute } from '@tanstack/react-router'
import { checkoutResponse } from '../../lib/commerce.server'

export const Route = createFileRoute('/api/checkout')({
  server: { handlers: { POST: ({ request }) => checkoutResponse(request) } },
})
