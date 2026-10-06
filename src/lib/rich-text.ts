// Store a restricted JSON document, never arbitrary HTML. Plain-text pads are
// converted as text nodes so existing angle brackets and whitespace stay literal.
export type RichNode = {
  type: string
  attrs?: Record<string, unknown>
  text?: string
  marks?: { type: string; attrs?: Record<string, unknown> }[]
  content?: RichNode[]
}

export function plainTextDocument(body: string): RichNode {
  return {
    type: 'doc',
    content: body.split('\n').map((line) => ({
      type: 'paragraph',
      ...(line ? { content: [{ type: 'text', text: line }] } : {}),
    })),
  }
}

export function padDocument(pad: { body: string; document: string | null }): string {
  return pad.document ?? JSON.stringify(plainTextDocument(pad.body))
}

export function richTextPlainText(node: RichNode): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return '\n'
  const separator = ['paragraph', 'heading', 'codeBlock'].includes(node.type) ? '' : '\n'
  return (node.content ?? []).map(richTextPlainText).join(separator)
}

export function safeLink(value: string): boolean {
  if (value.length > 2048 || /[\u0000-\u0020\u007f]/.test(value)) return false
  try {
    const url = new URL(value)
    return ['https:', 'http:', 'mailto:'].includes(url.protocol)
  } catch {
    return false
  }
}

const blocks = [
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'taskList',
  'blockquote',
  'codeBlock',
  'horizontalRule',
]
const inline = ['text', 'hardBreak']
const keysOnly = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).every((key) => keys.includes(key))
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

export function validRichDocument(value: unknown): value is RichNode {
  let count = 0
  function visit(node: unknown, depth: number, allowed: string[]): boolean {
    if (
      ++count > 20000 ||
      depth > 32 ||
      !record(node) ||
      !keysOnly(node, ['type', 'attrs', 'text', 'marks', 'content']) ||
      typeof node.type !== 'string' ||
      !allowed.includes(node.type)
    )
      return false
    const attrs = node.attrs ?? {}
    if (!record(attrs)) return false
    let attrKeys: string[] = []
    if (['paragraph', 'heading'].includes(node.type)) {
      attrKeys = ['textAlign', ...(node.type === 'heading' ? ['level'] : [])]
      if (attrs.textAlign != null && !['left', 'center', 'right'].includes(String(attrs.textAlign)))
        return false
      if (node.type === 'heading' && ![1, 2, 3].includes(Number(attrs.level))) return false
    } else if (node.type === 'orderedList') {
      attrKeys = ['start', 'type']
      if (
        attrs.start != null &&
        (!Number.isInteger(attrs.start) || Number(attrs.start) < 1 || Number(attrs.start) > 100000)
      )
        return false
      if (attrs.type != null && !['1', 'a', 'A', 'i', 'I'].includes(String(attrs.type)))
        return false
    } else if (node.type === 'taskItem') {
      attrKeys = ['checked']
      if (typeof attrs.checked !== 'boolean') return false
    } else if (node.type === 'codeBlock') {
      attrKeys = ['language']
      if (
        attrs.language != null &&
        (typeof attrs.language !== 'string' || !/^[\w+-]{1,40}$/.test(attrs.language))
      )
        return false
    }
    if (!keysOnly(attrs, attrKeys)) return false
    if (node.type === 'text') {
      if (typeof node.text !== 'string' || !node.text || node.content !== undefined) return false
    } else if (node.text !== undefined) return false
    if (node.marks !== undefined) {
      if (node.type !== 'text' || !Array.isArray(node.marks) || node.marks.length > 8) return false
      for (const mark of node.marks) {
        if (!record(mark) || !keysOnly(mark, ['type', 'attrs'])) return false
        if (
          ['bold', 'italic', 'underline', 'strike', 'code', 'highlight'].includes(String(mark.type))
        ) {
          if (mark.attrs != null && (!record(mark.attrs) || Object.keys(mark.attrs).length))
            return false
        } else if (mark.type === 'link') {
          if (
            !record(mark.attrs) ||
            !keysOnly(mark.attrs, ['href', 'target', 'rel', 'class', 'title']) ||
            typeof mark.attrs.href !== 'string' ||
            !safeLink(mark.attrs.href) ||
            (mark.attrs.target != null &&
              !['_blank', '_self'].includes(String(mark.attrs.target))) ||
            (mark.attrs.rel != null && mark.attrs.rel !== 'noopener noreferrer nofollow') ||
            mark.attrs.class != null ||
            (mark.attrs.title != null &&
              (typeof mark.attrs.title !== 'string' || mark.attrs.title.length > 160))
          )
            return false
        } else return false
      }
    }
    if (['text', 'hardBreak', 'horizontalRule'].includes(node.type))
      return node.content === undefined
    const children = node.content ?? []
    if (!Array.isArray(children)) return false
    const childTypes = ['paragraph', 'heading'].includes(node.type)
      ? inline
      : node.type === 'codeBlock'
        ? ['text']
        : ['bulletList', 'orderedList'].includes(node.type)
          ? ['listItem']
          : node.type === 'taskList'
            ? ['taskItem']
            : blocks
    if (
      [
        'doc',
        'bulletList',
        'orderedList',
        'taskList',
        'blockquote',
        'listItem',
        'taskItem',
      ].includes(node.type) &&
      !children.length
    )
      return false
    if (
      ['listItem', 'taskItem'].includes(node.type) &&
      (!record(children[0]) || children[0].type !== 'paragraph')
    )
      return false
    return children.every((child) => visit(child, depth + 1, childTypes))
  }
  return visit(value, 0, ['doc'])
}
