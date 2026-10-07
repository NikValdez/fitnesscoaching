import { z } from 'zod'

export const contentStages = [
  {
    id: 'CONCEPTS',
    label: 'Concepts',
    description: 'Capture the spark.',
    empty: 'Your next idea starts here.',
  },
  {
    id: 'PRE_PRODUCTION',
    label: 'Pre production',
    description: 'Give the idea a plan.',
    empty: 'Ready to plan something good?',
  },
  {
    id: 'FILMING',
    label: 'Filming',
    description: 'Bring it to life.',
    empty: 'The stage is yours.',
  },
  {
    id: 'DONE',
    label: 'Done',
    description: 'A little more out in the world.',
    empty: 'Good work will land here.',
  },
] as const

export const contentFormats = [
  { id: 'VIDEO', label: 'Video / Reel' },
  { id: 'POST', label: 'Post / Carousel' },
  { id: 'STORY', label: 'Story' },
  { id: 'ARTICLE', label: 'Article / Email' },
  { id: 'OTHER', label: 'Other' },
] as const

export type ContentStage = (typeof contentStages)[number]['id']
export type ContentFormat = (typeof contentFormats)[number]['id']

export const contentPlatforms = [
  { id: 'INSTAGRAM', label: 'Instagram' },
  { id: 'TIKTOK', label: 'TikTok' },
  { id: 'FACEBOOK', label: 'Facebook' },
  { id: 'YOUTUBE', label: 'YouTube' },
  { id: 'TWITTER', label: 'Twitter' },
  { id: 'LINKEDIN', label: 'LinkedIn' },
  { id: 'BLOG', label: 'Website blog' },
] as const
export type ContentPlatform = (typeof contentPlatforms)[number]['id']

const revision = z.number().int().nonnegative()
const id = z.string().min(1).max(100)
const stage = z.enum(['CONCEPTS', 'PRE_PRODUCTION', 'FILMING', 'DONE'])

export const saveContentIdeaSchema = z
  .object({
    id: id.optional(),
    expectedUpdatedAt: z.string().datetime().optional(),
    revision,
    title: z.string().trim().min(1, 'Give your idea a title.').max(160),
    notes: z.string().trim().max(10000),
    format: z.enum(['VIDEO', 'POST', 'STORY', 'ARTICLE', 'OTHER']),
    stage,
    platforms: z
      .array(z.enum(['INSTAGRAM', 'TIKTOK', 'FACEBOOK', 'YOUTUBE', 'TWITTER', 'LINKEDIN', 'BLOG']))
      .max(7)
      .refine((values) => new Set(values).size === values.length, 'Choose each platform once.')
      .optional(),
  })
  .strict()

export const moveContentIdeaSchema = z
  .object({
    id,
    revision,
    stage,
    beforeId: id.nullable(),
  })
  .strict()
  .refine((data) => data.id !== data.beforeId, {
    message: 'An idea cannot be moved before itself.',
  })

export const deleteContentIdeaSchema = z.object({ id, revision }).strict()
