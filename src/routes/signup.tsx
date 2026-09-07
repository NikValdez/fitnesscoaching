import { createFileRoute } from '@tanstack/react-router'
import { AuthForm } from '../components/auth-form'
import { getAuthOptions } from '../lib/functions'

export const Route = createFileRoute('/signup')({
  head: () => ({ meta: [{ title: 'Create account — Steve Rossiter Coaching' }] }),
  loader: () => getAuthOptions(),
  component: () => <AuthForm signup googleEnabled={Route.useLoaderData().googleEnabled} />,
})
