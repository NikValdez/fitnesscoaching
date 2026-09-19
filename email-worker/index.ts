import { CONTACT_RECIPIENTS } from './recipients'

interface IncomingEmail {
  to: string
  forward(address: string): Promise<void>
  setReject(reason: string): void
}

export default {
  async email(message: IncomingEmail) {
    if (message.to.toLowerCase() !== 'info@steverossiter.com') {
      message.setReject('Unknown recipient')
      return
    }

    // Attempt every destination even when one recipient rejects delivery.
    const results = await Promise.allSettled(
      CONTACT_RECIPIENTS.map((address) => message.forward(address)),
    )
    const failures = results.filter((result) => result.status === 'rejected')
    if (failures.length) {
      console.error('Email forwarding failed', { failed: failures.length, total: results.length })
      if (failures.length === results.length) {
        throw new Error('Could not forward to any destination.')
      }
    }
  },
}
