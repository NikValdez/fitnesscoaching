import { createFileRoute } from '@tanstack/react-router'
import { authorizeMedia, mediaResponse, mediaPrivateHeaders } from '../../../lib/media-http.server'
import { mutateMedia } from '../../../lib/media.server'
import { mediaActionSchema } from '../../../lib/media-validation'
export const Route = createFileRoute('/api/admin/media')({
  server: {
    handlers: {
      POST: ({ request }) =>
        mediaResponse(async () => {
          await authorizeMedia(request, true)
          // Metadata is small; do not accept arbitrary binary bodies here.
          if (!request.headers.get('Content-Type')?.startsWith('application/json'))
            return Response.json(
              { error: 'Expected JSON metadata.' },
              { status: 415, headers: mediaPrivateHeaders },
            )
          const body = await request.text()
          if (body.length > 16000)
            return Response.json(
              { error: 'Metadata is too large.' },
              { status: 413, headers: mediaPrivateHeaders },
            )
          let parsed: unknown
          try {
            parsed = JSON.parse(body)
          } catch {
            parsed = null
          }
          const result = mediaActionSchema.safeParse(parsed)
          if (!result.success)
            return Response.json(
              { error: result.error.issues[0]?.message || 'Invalid request.' },
              { status: 400, headers: mediaPrivateHeaders },
            )
          return Response.json(await mutateMedia(result.data), { headers: mediaPrivateHeaders })
        }),
    },
  },
})
