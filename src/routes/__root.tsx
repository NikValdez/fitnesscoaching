import { createRootRoute, HeadContent, Scripts, Outlet, Link, useHydrated } from '@tanstack/react-router'
import stylesheet from '../styles.css?url'
import workspaceStylesheet from '../workspace.css?url'
import intakeStylesheet from '../intake.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Steve Rossiter Coaching — 69 Easy & LA Coaching' },
      {
        name: 'description',
        content:
          'Explore the 69 Easy plan and contact Steve for one-on-one coaching in Los Angeles. Online coaching and accountability services are coming soon.',
      },
      { name: 'theme-color', content: '#fbfaf8' },
    ],
    links: [
      { rel: 'stylesheet', href: stylesheet },
      { rel: 'stylesheet', href: workspaceStylesheet },
      { rel: 'stylesheet', href: intakeStylesheet },
      { rel: 'icon', type: 'image/png', href: '/images/sr-monogram-v2.png' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Archivo:wght@400;450;500;550;600;650;700;750&family=IBM+Plex+Mono:wght@400;500&display=swap',
      },
    ],
  }),
  component: Root,
  notFoundComponent: () => (
    <main className="message-page">
      <p className="eyebrow">404 / Page not found</p>
      <h1>A little off course.</h1>
      <p>Let’s get you back to Steve Rossiter Coaching.</p>
      <Link className="button" to="/">
        Back home
      </Link>
    </main>
  ),
  errorComponent: ({ reset }) => (
    <main className="message-page">
      <p className="eyebrow">Something went wrong</p>
      <h1>Let’s try that again.</h1>
      <p>We couldn’t load this page. Please check your connection and retry.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
      <Link className="text-link" to="/">
        Back home
      </Link>
    </main>
  ),
})

function Root() {
  const hydrated = useHydrated()
  return (
    <html lang="en" data-hydrated={hydrated}>
      <head>
        <HeadContent />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
