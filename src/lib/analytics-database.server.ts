import { AsyncLocalStorage } from 'node:async_hooks'
import { db } from './db.server'
import type { Prisma } from '../generated/prisma/client'

const transactions = new AsyncLocalStorage<Prisma.TransactionClient>()
export class AnalyticsDatabase {
  async query<T = Record<string, unknown>>(sql: string, ...values: unknown[]): Promise<T[]> {
    const client = transactions.getStore() ?? db
    // Query text is fixed application SQL; user values always use placeholders.
    if (/^\s*(SELECT|WITH)|\bRETURNING\b/i.test(sql))
      return client.$queryRawUnsafe<T[]>(sql, ...values)
    await client.$executeRawUnsafe(sql, ...values)
    return []
  }
  async transaction<T>(operation: () => Promise<T>, readOnly = false): Promise<T> {
    if (transactions.getStore()) return operation()
    return db.$transaction(
      (tx) =>
        transactions.run(tx, async () => {
          if (!readOnly)
            await this.query('SELECT id FROM rossiter_analytics_settings WHERE id = 1 FOR UPDATE')
          return operation()
        }),
      { timeout: 20000, isolationLevel: readOnly ? 'RepeatableRead' : 'ReadCommitted' },
    )
  }
}
