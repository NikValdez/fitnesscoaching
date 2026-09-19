// Worker runtime modules used by the contact form's server-only handler.
declare module 'cloudflare:email' {
  export class EmailMessage {
    constructor(from: string, to: string, raw: string)
  }
}

declare module 'cloudflare:workers' {
  export const env: {
    CONTACT_EMAIL: {
      send(message: import('cloudflare:email').EmailMessage): Promise<unknown>
    }
  }
}
