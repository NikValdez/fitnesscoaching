import { describe, expect, it, vi } from 'vitest'
import { formatEnquiryEmail, notifyEnquiryEmail } from '../src/lib/enquiry-email'

const enquiry = {
  id: 'test-enquiry',
  name: 'Zoë Example\r\nBcc: attacker@example.com',
  email: 'visitor@example.com',
  interest: 'In-person coaching',
  notes: 'I’d like help with strength training. 💪',
  createdAt: new Date('2026-09-15T12:00:00Z'),
}

describe('contact form emails', () => {
  it('sends to a configured inbox and lets the coach reply to the visitor', () => {
    const raw = formatEnquiryEmail(enquiry)
    const [headers, encoded] = raw.split('\r\n\r\n')
    expect(headers).toContain('To: nikcochran@gmail.com')
    expect(headers).toContain('From: Steve Rossiter Website <website@steverossiter.com>')
    expect(headers).toContain('Reply-To: visitor@example.com')
    expect(headers).toMatch(/Message-ID: <[a-f0-9-]+@steverossiter\.com>/)
    expect(headers).not.toContain('Bcc:')
    const body = Buffer.from(encoded, 'base64').toString('utf8')
    expect(body).toContain(enquiry.name)
    expect(body).toContain(enquiry.notes)
    expect(body).toContain(enquiry.id)
  })

  it('rejects email header injection', () => {
    expect(() =>
      formatEnquiryEmail({ ...enquiry, email: 'visitor@example.com\r\nBcc: attacker@example.com' }),
    ).toThrow('Invalid reply address')
  })

  it('reports success only after the email provider accepts the message', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    await expect(notifyEnquiryEmail(enquiry, send)).resolves.toBe(true)
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls.map((call) => call[1])).toEqual([
      'nikcochran@gmail.com',
      'rossiter.steve@gmail.com',
    ])
  })

  it('reports notification failure without throwing away a saved request or logging its content', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const send = vi.fn().mockRejectedValue(new Error('Provider unavailable'))
      await expect(notifyEnquiryEmail(enquiry, send)).resolves.toBe(false)
      expect(log).toHaveBeenCalledWith('Enquiry email notification failed', {
        enquiryId: enquiry.id,
        failedRecipients: ['nikcochran@gmail.com', 'rossiter.steve@gmail.com'],
      })
    } finally {
      log.mockRestore()
    }
  })

  it('delivers to Nik even when Steve has not verified his address', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const send = vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Unverified destination'))
      await expect(notifyEnquiryEmail(enquiry, send)).resolves.toBe(true)
      expect(log).toHaveBeenCalledWith('Enquiry email notification failed', {
        enquiryId: enquiry.id,
        failedRecipients: ['rossiter.steve@gmail.com'],
      })
    } finally {
      log.mockRestore()
    }
  })
})
