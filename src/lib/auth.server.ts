import 'dotenv/config'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { db } from './db.server'

export const isGoogleEnabled = () => Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
)

function createAuth() {
return betterAuth({
  appName: 'Steve Rossiter Coaching',
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  advanced: { ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] } },
  database: prismaAdapter(db, { provider: 'postgresql' }),
  user: {
    additionalFields: {
      role: { type: ['CLIENT', 'ADMIN'], defaultValue: 'CLIENT', input: false, required: false },
    },
  },
  emailAndPassword: { enabled: true, minPasswordLength: 10, maxPasswordLength: 128 },
  socialProviders: isGoogleEnabled()
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          prompt: 'select_account',
        },
      }
    : {},
  rateLimit: { enabled: true, window: 60, max: 60 },
  plugins: [tanstackStartCookies()],
})
}

// Auth configuration can be reused across requests. The database proxy still
// resolves every operation to the current request's own Prisma connection.
let instance: ReturnType<typeof createAuth> | undefined
export function getAuth() {
  return (instance ??= createAuth())
}
