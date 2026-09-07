import { describe, it, expect } from 'vitest'
import { intakeSchema } from '../src/lib/intake-validation'

const base = {
  interests: [{ service: 'FITNESS', tier: 'ESSENTIAL' }],
  channels: ['EMAIL'],
  phone: '',
  goals: '',
}

describe('client questionnaire validation', () => {
  it('allows multiple services, independent tiers and several contact methods', () => {
    const result = intakeSchema.parse({
      ...base,
      interests: [
        { service: 'FITNESS', tier: 'IN_PERSON' },
        { service: 'NUTRITION', tier: 'ESSENTIAL' },
        { service: 'ACCOUNTABILITY', tier: 'ONGOING' },
        { service: 'LIFESTYLE', tier: 'ESSENTIAL' },
      ],
      channels: ['VOICE_CALL', 'TEXT_MESSAGE', 'EMAIL'],
      phone: '+1 (555) 123-4567',
    })
    expect(result.phone).toBe('+15551234567')
    expect(result.interests).toHaveLength(4)
  })
  it('requires at least one service and a tier for every service', () => {
    expect(intakeSchema.safeParse({ ...base, interests: [] }).success).toBe(false)
    expect(
      intakeSchema.safeParse({ ...base, interests: [{ service: 'FITNESS', tier: null }] }).success,
    ).toBe(false)
  })
  it('rejects duplicate services, duplicate channels and unsupported options', () => {
    expect(
      intakeSchema.safeParse({ ...base, interests: [base.interests[0], base.interests[0]] })
        .success,
    ).toBe(false)
    expect(intakeSchema.safeParse({ ...base, channels: ['EMAIL', 'EMAIL'] }).success).toBe(false)
    expect(
      intakeSchema.safeParse({ ...base, interests: [{ service: 'FITNESS', tier: 'VIP' }] }).success,
    ).toBe(false)
  })
  it('requires contact details only for calls or texts and removes stale phone data', () => {
    expect(intakeSchema.safeParse({ ...base, channels: [] }).success).toBe(false)
    expect(intakeSchema.safeParse({ ...base, channels: ['TEXT_MESSAGE'] }).success).toBe(false)
    expect(
      intakeSchema.safeParse({ ...base, channels: ['VOICE_CALL'], phone: '5551234567' }).success,
    ).toBe(false)
    expect(intakeSchema.parse({ ...base, phone: '+15551234567' }).phone).toBe('')
  })
  it('rejects attempts to select another user or change role', () => {
    expect(intakeSchema.safeParse({ ...base, userId: 'another-user' }).success).toBe(false)
    expect(intakeSchema.safeParse({ ...base, role: 'ADMIN' }).success).toBe(false)
  })
})
