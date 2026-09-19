import { describe, expect, it, vi } from 'vitest'
import worker from '../email-worker'
import { CONTACT_RECIPIENTS } from '../email-worker/recipients'

describe('info email forwarding', () => {
  it('forwards the original message to both configured recipients', async () => {
    const message = {
      to: 'info@steverossiter.com',
      forward: vi.fn().mockResolvedValue(undefined),
      setReject: vi.fn(),
    }
    await worker.email(message)
    expect(message.forward.mock.calls).toEqual(CONTACT_RECIPIENTS.map((email) => [email]))
  })

  it('still attempts the second destination if the first fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const message = {
      to: 'info@steverossiter.com',
      forward: vi
        .fn()
        .mockRejectedValueOnce(new Error('Unavailable'))
        .mockResolvedValueOnce(undefined),
      setReject: vi.fn(),
    }
    try {
      await expect(worker.email(message)).resolves.toBeUndefined()
      expect(message.forward).toHaveBeenCalledWith('rossiter.steve@gmail.com')
    } finally {
      log.mockRestore()
    }
  })

  it('rejects mail addressed to any other alias', async () => {
    const message = { to: 'other@steverossiter.com', forward: vi.fn(), setReject: vi.fn() }
    await worker.email(message)
    expect(message.setReject).toHaveBeenCalledWith('Unknown recipient')
    expect(message.forward).not.toHaveBeenCalled()
  })

  it('raises an error if neither destination accepts the email', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const message = {
        to: 'info@steverossiter.com',
        forward: vi.fn().mockRejectedValue(new Error('Unavailable')),
        setReject: vi.fn(),
      }
      await expect(worker.email(message)).rejects.toThrow('any destination')
      expect(message.forward).toHaveBeenCalledTimes(2)
    } finally {
      log.mockRestore()
    }
  })
})
