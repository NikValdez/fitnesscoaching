import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Client generation needs no database access; only migration commands use this.
  datasource: { url: process.env.DIRECT_URL },
})
