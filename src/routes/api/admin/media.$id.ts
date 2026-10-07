import { createFileRoute } from '@tanstack/react-router'
import {
  authorizeMedia,
  mediaResponse,
  mediaPrivateHeaders,
  serveMedia,
} from '../../../lib/media-http.server'
import { saveMediaThumbnail, uploadMediaPart } from '../../../lib/media.server'
export const Route = createFileRoute('/api/admin/media/$id')({
  server: {
    handlers: {
      GET: ({ request, params }) => mediaResponse(() => serveMedia(request, params.id)),
      HEAD: ({ request, params }) => mediaResponse(() => serveMedia(request, params.id)),
      PUT: ({ request, params }) =>
        mediaResponse(async () => {
          await authorizeMedia(request, true)
          if (new URL(request.url).searchParams.has('thumbnail')) {
            await saveMediaThumbnail(params.id, request)
            return new Response(null, { status: 204, headers: mediaPrivateHeaders })
          }
          const part = Number(new URL(request.url).searchParams.get('part'))
          return Response.json(await uploadMediaPart(params.id, part, request), {
            headers: mediaPrivateHeaders,
          })
        }),
    },
  },
})
