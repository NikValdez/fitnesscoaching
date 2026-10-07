import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { getAuth } from '../../../lib/auth.server'
import { db } from '../../../lib/db.server'

export const Route = createFileRoute('/api/admin/live')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        if (request.headers.get('Origin') !== url.origin)
          return new Response('Forbidden', { status: 403 })
        if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
          return new Response('WebSocket required', { status: 426 })
        const session = await getAuth().api.getSession({ headers: request.headers })
        if (!session) return new Response('Sign in required', { status: 401 })
        const user = await db.user.findUnique({
          where: { id: session.user.id },
          select: { role: true, name: true },
        })
        if (user?.role !== 'ADMIN') return new Response('Admin access required', { status: 403 })
        const headers = new Headers(request.headers)
        headers.set('X-Studio-Session', session.session.id)
        headers.set('X-Studio-Name', encodeURIComponent(user.name))
        headers.set('X-Studio-Client', url.searchParams.get('client') ?? '')
        headers.set(
          'X-Studio-Channel',
          ['board', 'library', 'media'].includes(url.searchParams.get('channel') ?? '')
            ? url.searchParams.get('channel')!
            : 'pad',
        )
        return env.ADMIN_STUDIO.getByName('main').fetch(new Request(request, { headers }))
      },
    },
  },
})
