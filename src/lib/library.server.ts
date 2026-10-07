import type { Prisma } from '../generated/prisma/client'
import { db } from './db.server'
import { notifyStudioChange } from './content.server'

const query = {
  where: { id: 'main' },
  include: { entries: { orderBy: [{ createdAt: 'desc' as const }, { id: 'asc' as const }] } },
}

export function readContentLibrary() {
  return db.$transaction((tx) => tx.contentLibrary.findUniqueOrThrow(query), {
    isolationLevel: 'RepeatableRead',
  })
}

export async function updateContentLibrary(
  revision: number,
  change: (tx: Prisma.TransactionClient) => Promise<unknown>,
) {
  const result = await db.$transaction(
    async (tx) => {
      const lock = await tx.contentLibrary.updateMany({
        where: { id: 'main', revision },
        data: { revision: { increment: 1 } },
      })
      if (!lock.count)
        throw new Error('The library changed. Refresh and try again; your draft is still here.')
      await change(tx)
      return tx.contentLibrary.findUniqueOrThrow(query)
    },
    { timeout: 15000 },
  )
  await notifyStudioChange('library')
  return result
}
