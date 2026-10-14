import { AsyncLocalStorage } from 'node:async_hooks'
import { db } from './db.server'
type QueryClient = {
  $queryRawUnsafe<T>(query: string, ...values: unknown[]): PromiseLike<T>
  $executeRawUnsafe(query: string, ...values: unknown[]): PromiseLike<number>
}
type DatabaseClient = QueryClient & {
  $transaction<T>(
    operation: (client: QueryClient) => Promise<T>,
    options: { timeout: number; isolationLevel: 'RepeatableRead' | 'ReadCommitted' },
  ): Promise<T>
}

export class AnalyticsDatabase {
  private transactions = new AsyncLocalStorage<QueryClient>()
  constructor(private client: DatabaseClient = db) {}
  async query<T = Record<string, unknown>>(sql: string, ...values: unknown[]): Promise<T[]> {
    const client = this.transactions.getStore() ?? this.client
    // Query text is fixed application SQL; user values always use placeholders.
    if (/^\s*(SELECT|WITH)|\bRETURNING\b/i.test(sql))
      return client.$queryRawUnsafe<T[]>(sql, ...values)
    await client.$executeRawUnsafe(sql, ...values)
    return []
  }
  async transaction<T>(operation: () => Promise<T>, readOnly = false): Promise<T> {
    if (this.transactions.getStore()) return operation()
    return this.client.$transaction(
      (tx) =>
        this.transactions.run(tx, async () => {
          if (!readOnly)
            await this.query('SELECT id FROM rossiter_analytics_settings WHERE id = 1 FOR UPDATE')
          return operation()
        }),
      { timeout: 20000, isolationLevel: readOnly ? 'RepeatableRead' : 'ReadCommitted' },
    )
  }
}
