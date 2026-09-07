import { redirect } from '@tanstack/react-router'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { getAuth } from './auth.server'
import { db } from './db.server'

export async function requireAccount() {
  const session = await getAuth().api.getSession({ headers: getRequestHeaders() })
  if (!session) throw redirect({ to: '/login' })
  // Read the live database role on every request, including after a role change.
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, intake: { select: { userId: true } } },
  })
  if (!user) throw redirect({ to: '/login' })
  return user
}

export async function requireCoach() {
  const user = await requireAccount()
  if (user.role !== 'ADMIN') throw new Error('Coach access required.')
  return user
}

export async function requireClient({
  allowIncomplete = false,
}: { allowIncomplete?: boolean } = {}) {
  const user = await requireAccount()
  if (user.role !== 'CLIENT') throw redirect({ to: '/coach' })
  if (!allowIncomplete && !user.intake) throw redirect({ to: '/onboarding' })
  return user
}

export async function findClient(id: string) {
  const client = await db.user.findFirst({
    where: { id, role: 'CLIENT' },
    select: { id: true, name: true, email: true },
  })
  if (!client) throw new Error('Client not found.')
  return client
}
