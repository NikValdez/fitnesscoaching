import { describe, expect, it } from 'vitest'
import { saveScratchPadSchema, scratchPadLimit } from '../src/lib/scratch-validation'
import { plainTextDocument, richTextPlainText, validRichDocument } from '../src/lib/rich-text'

describe('continuous scratch pad inputs', () => {
  it('preserves exact writing, whitespace, and an intentionally cleared pad', () => {
    for (const body of ['', '  A thought\n\nKeep the detail.  ', '\n\n']) {
      expect(saveScratchPadSchema.parse({ body, revision: 0 }).body).toBe(body)
    }
  })
  it('requires a valid revision and enforces the size limit', () => {
    expect(
      saveScratchPadSchema.safeParse({ body: 'x'.repeat(scratchPadLimit), revision: 1 }).success,
    ).toBe(true)
    for (const change of [
      { body: 'x'.repeat(scratchPadLimit + 1) },
      { revision: -1 },
      { revision: 1.5 },
      { revision: undefined },
    ]) {
      expect(
        saveScratchPadSchema.safeParse({ body: 'A thought', revision: 0, ...change }).success,
      ).toBe(false)
    }
  })
  it('rejects forged pad identifiers, roles, and ownership', () => {
    for (const change of [
      { id: 'other' },
      { role: 'ADMIN' },
      { authorId: 'other' },
      { cardId: 'other' },
    ]) {
      expect(
        saveScratchPadSchema.safeParse({ body: 'A thought', revision: 0, ...change }).success,
      ).toBe(false)
    }
  })
  it('preserves legacy text literally and saves formatting independently of plain text', () => {
    const body = '  <script>not HTML</script>\n\nA thought  \n'
    const doc = plainTextDocument(body)
    expect(richTextPlainText(doc)).toBe(body)
    expect(validRichDocument(doc)).toBe(true)
    expect(
      saveScratchPadSchema.safeParse({ body, document: JSON.stringify(doc), revision: 0 }).success,
    ).toBe(true)
    const formatted = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  attrs: { textAlign: null },
                  content: [
                    {
                      type: 'text',
                      text: 'A thought',
                      marks: [{ type: 'bold' }, { type: 'underline' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }
    expect(
      saveScratchPadSchema.safeParse({
        body: 'A thought',
        document: JSON.stringify(formatted),
        revision: 2,
      }).success,
    ).toBe(true)
    expect(
      saveScratchPadSchema.safeParse({
        body: 'Different text',
        document: JSON.stringify(formatted),
        revision: 2,
      }).success,
    ).toBe(false)
  })
  it('rejects scripts, unsafe links, attributes, and oversized nesting', () => {
    const doc = (node: unknown) => JSON.stringify({ type: 'doc', content: [node] })
    const paragraph = (mark: unknown) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: 'Link', marks: [mark] }],
    })
    for (const document of [
      '{bad JSON',
      doc({ type: 'script', text: 'alert(1)' }),
      doc(paragraph({ type: 'link', attrs: { href: 'javascript:alert(1)' } })),
      doc(paragraph({ type: 'link', attrs: { href: 'data:text/html,<script>alert(1)</script>' } })),
      doc({ type: 'paragraph', attrs: { onclick: 'alert(1)' } }),
      doc({ type: 'heading', attrs: { level: 99 } }),
    ]) {
      expect(saveScratchPadSchema.safeParse({ body: 'Link', document, revision: 0 }).success).toBe(
        false,
      )
    }
    const link = paragraph({
      type: 'link',
      attrs: {
        href: 'https://example.com',
        target: '_blank',
        rel: 'noopener noreferrer nofollow',
        class: null,
        title: null,
      },
    })
    expect(
      saveScratchPadSchema.safeParse({ body: 'Link', document: doc(link), revision: 0 }).success,
    ).toBe(true)
    let nested = plainTextDocument('Deep').content![0]
    for (let i = 0; i < 40; i++) nested = { type: 'blockquote', content: [nested] }
    expect(validRichDocument({ type: 'doc', content: [nested] })).toBe(false)
  })
})
