import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/program')({
  beforeLoad: ({ location }) => {
    throw redirect({ to: '/69-easy', hash: location.hash, statusCode: 301 })
  },
})
