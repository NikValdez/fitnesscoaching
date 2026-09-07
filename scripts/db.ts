import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma-node/client'
import { PrismaNeon } from '@prisma/adapter-neon'

// Node-only client for administrative scripts and browser test fixtures.
export const db = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
})
