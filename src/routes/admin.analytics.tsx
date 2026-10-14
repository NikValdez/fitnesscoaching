import { createFileRoute } from '@tanstack/react-router'
import Analytics from '../components/analytics-dashboard'
import { getAnalyticsWorkspace } from '../lib/analytics'
import adminStylesheet from '../admin.css?url'
import analyticsStylesheet from '../analytics.css?url'

export const Route = createFileRoute('/admin/analytics')({
  head: () => ({
    meta: [
      { title: 'Video analytics — Steve Rossiter' },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
    links: [
      { rel: 'stylesheet', href: adminStylesheet },
      { rel: 'stylesheet', href: analyticsStylesheet },
    ],
  }),
  headers: () => ({ 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, noarchive' }),
  staleTime: 0,
  gcTime: 0,
  loader: () => getAnalyticsWorkspace(),
  component: () => {
    const { user, analytics, board } = Route.useLoaderData()
    return <Analytics initial={analytics} userName={user.name} board={board} />
  },
})
