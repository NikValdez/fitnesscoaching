import { createMiddleware, createStart } from '@tanstack/react-start'

const databaseRequest = createMiddleware().server(async ({ next }) => {
  const { withDatabaseRequest } = await import('./lib/db.server')
  return withDatabaseRequest(async () => next())
})

export const startInstance = createStart(() => ({
  requestMiddleware: [databaseRequest],
}))
