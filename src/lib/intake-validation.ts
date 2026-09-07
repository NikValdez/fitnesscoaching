import { z } from 'zod'

export const serviceOptions = [
  {
    id: 'FITNESS',
    label: 'Fitness coaching',
    description: 'Training shaped around your goals, experience, and equipment.',
  },
  {
    id: 'NUTRITION',
    label: 'Nutrition',
    description: 'Practical support with food choices and eating habits.',
  },
  {
    id: 'ACCOUNTABILITY',
    label: 'Accountability',
    description: 'Regular check-ins to help you stay consistent.',
  },
  {
    id: 'LIFESTYLE',
    label: 'Lifestyle',
    description: 'Support with routines, recovery, and fitting it all into your life.',
  },
] as const
export const tierOptions = [
  {
    id: 'ESSENTIAL',
    label: 'Essential',
    subtitle: 'A clear starting point',
    description: 'Personal guidance and a plan to work through at your own pace.',
  },
  {
    id: 'ONGOING',
    label: 'Ongoing support',
    subtitle: 'Stay connected',
    description: 'Regular remote check-ins and adjustments as your needs change.',
  },
  {
    id: 'IN_PERSON',
    label: 'In person',
    subtitle: 'The highest level of support',
    description: 'Face-to-face coaching with Steve in Los Angeles, alongside ongoing support.',
  },
] as const
export const channelOptions = [
  { id: 'VOICE_CALL', label: 'Voice call', description: 'Talk things through.' },
  { id: 'TEXT_MESSAGE', label: 'Text message', description: 'A quick check-in on your phone.' },
  { id: 'EMAIL', label: 'Email', description: 'A little more room to reflect.' },
] as const

export type CoachingService = (typeof serviceOptions)[number]['id']
export type CoachingTier = (typeof tierOptions)[number]['id']
export type ContactChannel = (typeof channelOptions)[number]['id']
export const needsPhone = (channels: readonly ContactChannel[]) =>
  channels.some((c) => c === 'VOICE_CALL' || c === 'TEXT_MESSAGE')

export const intakeSchema = z
  .object({
    interests: z
      .array(
        z
          .object({
            service: z.enum(['FITNESS', 'NUTRITION', 'ACCOUNTABILITY', 'LIFESTYLE']),
            tier: z.enum(['ESSENTIAL', 'ONGOING', 'IN_PERSON']),
          })
          .strict(),
      )
      .min(1, 'Choose at least one service.')
      .max(4)
      .refine(
        (items) => new Set(items.map((i) => i.service)).size === items.length,
        'Choose each service only once.',
      ),
    channels: z
      .array(z.enum(['VOICE_CALL', 'TEXT_MESSAGE', 'EMAIL']))
      .min(1, 'Choose at least one way to stay in touch.')
      .max(3)
      .refine(
        (items) => new Set(items).size === items.length,
        'Choose each contact method only once.',
      ),
    phone: z
      .string()
      .trim()
      .max(40)
      .default('')
      .transform((value) => value.replace(/[\s().-]/g, '')),
    goals: z
      .string()
      .trim()
      .max(2000, 'Please keep your notes under 2,000 characters.')
      .default(''),
  })
  .strict()
  .superRefine((value, context) => {
    if (needsPhone(value.channels) && !/^\+[1-9]\d{6,14}$/.test(value.phone))
      context.addIssue({
        code: 'custom',
        path: ['phone'],
        message: 'Enter a phone number with its country code, for example +1 555 123 4567.',
      })
  })
  .transform((value) => ({ ...value, phone: needsPhone(value.channels) ? value.phone : '' }))

export type IntakeValues = z.infer<typeof intakeSchema>
