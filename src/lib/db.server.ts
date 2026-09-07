import 'dotenv/config'
import { AsyncLocalStorage } from 'node:async_hooks'
import { PrismaClient } from '../generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

const requests = new AsyncLocalStorage<{ client?: PrismaClient }>()

function createClient() {
  return new PrismaClient({
    adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
  })
}

export function getDb() {
  const scope = requests.getStore()
  if (!scope) throw new Error('Database access requires an active request.')
  return (scope.client ??= createClient())
}

export async function withDatabaseRequest<T>(handler: () => Promise<T>): Promise<T> {
  if (requests.getStore()) return handler()
  return requests.run({}, async () => {
    try {
      return await handler()
    } finally {
      await requests.getStore()?.client?.$disconnect()
    }
  })
}

// Resolve the client at query time, never sharing WebSocket connections between
// Cloudflare requests. Existing query and transaction call sites stay unchanged.
export const db = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getDb()
    const value = Reflect.get(client, property)
    return typeof value === 'function' ? value.bind(client) : value
  },
})
