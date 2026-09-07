import { createFileRoute } from '@tanstack/react-router'
import { downloadResponse } from '../../../lib/commerce.server'

export const Route = createFileRoute('/api/program/download')({
  server: { handlers: { GET: ({ request }) => downloadResponse(request) } },
})
