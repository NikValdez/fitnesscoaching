import { createCsrfMiddleware, createMiddleware, createStart } from '@tanstack/react-start'

const csrfProtection = createCsrfMiddleware({
  filter: (context) => context.handlerType === 'serverFn',
})

const databaseRequest = createMiddleware().server(async ({ next }) => {
  const { withDatabaseRequest } = await import('./lib/db.server')
  return withDatabaseRequest(async () => next())
})

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfProtection, databaseRequest],
}))
