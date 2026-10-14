import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma-node/client'
import { configureLocalNeon } from '../src/lib/neon-local'
import { PrismaNeon } from '@prisma/adapter-neon'

configureLocalNeon(process.env.DATABASE_URL, process.env.NEON_LOCAL_PROXY)

// Node-only client for administrative scripts and browser test fixtures.
export const db = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
})
