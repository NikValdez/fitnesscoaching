import type { AdminStudio } from './lib/studio-room.server'
declare global {
  interface CloudflareEnv {
    ADMIN_STUDIO: DurableObjectNamespace<AdminStudio>
  }
  namespace Cloudflare {
    interface Env extends CloudflareEnv {
      CONTACT_EMAIL: SendEmail
    }
  }
}
