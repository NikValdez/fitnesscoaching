import { db } from './db'

const email = process.argv[2]?.trim().toLowerCase()
if (!email || !email.includes('@'))
  throw new Error('Usage: npm run admin:grant -- email@example.com')
try {
  const user = await db.user.findUnique({ where: { email } })
  if (!user)
    throw new Error('Create this account through sign-up first, then run this command again.')
  await db.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } })
  console.log(`Coach access granted to ${email}. Sign in and open /coach.`)
} finally {
  await db.$disconnect()
}
