import { Buffer } from 'node:buffer'
import { CONTACT_RECIPIENTS } from '../../email-worker/recipients'

export const CONTACT_EMAIL = 'info@steverossiter.com'
export const CONTACT_SENDER = 'website@steverossiter.com'

interface EnquiryEmail {
  id: string
  name: string
  email: string
  interest: string
  notes: string | null
  createdAt: Date
}

export function formatEnquiryEmail(
  enquiry: EnquiryEmail,
  recipient: (typeof CONTACT_RECIPIENTS)[number] = CONTACT_RECIPIENTS[0],
) {
  // The visitor's address is a Reply-To, never the authenticated sender.
  if (/[\r\n]/.test(enquiry.email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(enquiry.email)) {
    throw new Error('Invalid reply address')
  }
  const body = [
    'New coaching enquiry',
    '',
    `Name: ${enquiry.name}`,
    `Email: ${enquiry.email}`,
    `Interest: ${enquiry.interest}`,
    `Received: ${enquiry.createdAt.toISOString()}`,
    `Reference: ${enquiry.id}`,
    '',
    'Message:',
    enquiry.notes || '(No additional message)',
    '',
    'Reply to this email to respond directly to the person who contacted Steve.',
  ].join('\n')
  // Base64 preserves Unicode and keeps all visitor content out of MIME headers.
  const encoded = Buffer.from(body, 'utf8')
    .toString('base64')
    .match(/.{1,76}/g)!
    .join('\r\n')
  return [
    `From: Steve Rossiter Website <${CONTACT_SENDER}>`,
    `To: ${recipient}`,
    `Reply-To: ${enquiry.email}`,
    'Subject: New coaching enquiry - Steve Rossiter',
    `Message-ID: <${crypto.randomUUID()}@steverossiter.com>`,
    `Date: ${enquiry.createdAt.toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    encoded,
    '',
  ].join('\r\n')
}

export async function notifyEnquiryEmail(
  enquiry: EnquiryEmail,
  send: (raw: string, recipient: (typeof CONTACT_RECIPIENTS)[number]) => Promise<unknown>,
) {
  const results = await Promise.allSettled(
    CONTACT_RECIPIENTS.map(async (recipient) =>
      send(formatEnquiryEmail(enquiry, recipient), recipient),
    ),
  )
  const failedRecipients = CONTACT_RECIPIENTS.filter(
    (_, index) => results[index].status === 'rejected',
  )
  if (failedRecipients.length) {
    // Report which configured inbox failed without logging visitor content.
    console.error('Enquiry email notification failed', { enquiryId: enquiry.id, failedRecipients })
  }
  // One accepted notification is enough to acknowledge receipt; log partial failures
  // for the site operator instead of prompting the visitor to submit duplicates.
  return results.some((result) => result.status === 'fulfilled')
}
