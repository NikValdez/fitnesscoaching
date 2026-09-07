import { createFileRoute, type SearchSchemaInput } from '@tanstack/react-router'
import { AuthForm } from '../components/auth-form'
import { getAuthOptions } from '../lib/functions'

export const Route = createFileRoute('/login')({
  head: () => ({ meta: [{ title: 'Sign in — Steve Rossiter Coaching' }] }),
  loader: () => getAuthOptions(),
  validateSearch: (search: { error?: unknown } & SearchSchemaInput) => ({
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  component: () => (
    <AuthForm
      key={Route.useSearch().error}
      googleEnabled={Route.useLoaderData().googleEnabled}
      oauthError={Route.useSearch().error}
    />
  ),
})
