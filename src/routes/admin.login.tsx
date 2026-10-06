import { createFileRoute, type SearchSchemaInput } from '@tanstack/react-router'
import { AuthForm } from '../components/auth-form'
import { getAuthOptions } from '../lib/functions'

export const Route = createFileRoute('/admin/login')({
  head: () => ({
    meta: [
      { title: 'Admin sign in — Steve Rossiter' },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
  }),
  headers: () => ({ 'Cache-Control': 'private, no-store' }),
  loader: () => getAuthOptions(),
  validateSearch: (search: { error?: unknown } & SearchSchemaInput) => ({
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  component: () => (
    <AuthForm
      admin
      key={Route.useSearch().error}
      googleEnabled={Route.useLoaderData().googleEnabled}
      oauthError={Route.useSearch().error}
    />
  ),
})
