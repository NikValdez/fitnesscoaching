import { redirect } from '@tanstack/react-router'
import { setResponseHeader } from '@tanstack/react-start/server'
import type { Prisma } from '../generated/prisma/client'
import { requireAccount } from './access.server'
import { db } from './db.server'

export async function requireContentAdmin() {
  setResponseHeader('Cache-Control', 'private, no-store')
  const user = await requireAccount({ loginTo: '/admin/login' })
  if (user.role !== 'ADMIN') throw redirect({ to: '/portal' })
  return user
}

const boardQuery = {
  where: { id: 'main' },
  include: {
    ideas: {
      orderBy: [
        { position: 'asc' as const },
        { createdAt: 'asc' as const },
        { id: 'asc' as const },
      ],
    },
  },
}

export async function readContentBoard() {
  return db.$transaction((tx) => tx.contentBoard.findUniqueOrThrow(boardQuery), {
    isolationLevel: 'RepeatableRead',
  })
}

export async function updateContentBoard(
  revision: number,
  change: (tx: Prisma.TransactionClient) => Promise<unknown>,
) {
  const result = await db.$transaction(
    async (tx) => {
      // Updating the singleton row also serializes concurrent writes. A stale tab
      // must reload instead of overwriting another admin's edits or card order.
      const lock = await tx.contentBoard.updateMany({
        where: { id: 'main', revision },
        data: { revision: { increment: 1 } },
      })
      if (!lock.count)
        throw new Error(
          'The board changed in another tab. Refresh the board and try again; your draft is still here.',
        )
      await change(tx)
      return tx.contentBoard.findUniqueOrThrow(boardQuery)
    },
    { timeout: 15000 },
  )
  try {
    const { env } = await import('cloudflare:workers')
    await env.ADMIN_STUDIO.getByName('main').fetch('https://studio/board-changed', {
      method: 'POST',
    })
  } catch (error) {
    // The database change is already committed; reconnect/focus polling recovers.
    console.error('Could not broadcast the board update.', error)
  }
  return result
}
