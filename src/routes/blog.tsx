import { createFileRoute, Outlet } from '@tanstack/react-router'
import { SiteLayout } from '../components/site-layout'
import blogStyles from '../blog.css?url'

export const Route = createFileRoute('/blog')({
  head: () => ({
    links: [{ rel: 'stylesheet', href: blogStyles }],
    meta: [
      { title: 'Blog — Steve Rossiter' },
      {
        name: 'description',
        content: 'Notes from Steve Rossiter on training, presence, and enjoying the process.',
      },
    ],
  }),
  component: BlogLayout,
})

function BlogLayout() {
  return (
    <SiteLayout className="marketing-page">
      <Outlet />
    </SiteLayout>
  )
}
