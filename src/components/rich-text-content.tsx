import { createElement, Fragment, type CSSProperties, type ReactNode } from 'react'
import { validRichDocument, type RichNode } from '../lib/rich-text'

function renderNode(node: RichNode, key: number): ReactNode {
  const children = node.content?.map(renderNode)
  if (node.type === 'text') {
    let text: ReactNode = node.text
    for (const mark of node.marks ?? []) {
      if (mark.type === 'link') {
        text = (
          <a href={String(mark.attrs?.href)} target="_blank" rel="noopener noreferrer nofollow">
            {text}
          </a>
        )
      } else {
        const tags: Record<string, string> = {
          bold: 'strong',
          italic: 'em',
          underline: 'u',
          strike: 's',
          code: 'code',
          highlight: 'mark',
        }
        text = createElement(tags[mark.type], null, text)
      }
    }
    return <Fragment key={key}>{text}</Fragment>
  }
  if (node.type === 'taskItem') {
    return (
      <li key={key} data-type="taskItem" data-checked={String(node.attrs?.checked)}>
        <input
          type="checkbox"
          checked={Boolean(node.attrs?.checked)}
          disabled
          aria-label="Task completed"
        />
        <div>{children}</div>
      </li>
    )
  }
  if (node.type === 'codeBlock')
    return (
      <pre key={key}>
        <code>{children}</code>
      </pre>
    )
  const tags: Record<string, string> = {
    paragraph: 'p',
    heading: `h${node.attrs?.level}`,
    bulletList: 'ul',
    orderedList: 'ol',
    taskList: 'ul',
    listItem: 'li',
    blockquote: 'blockquote',
    horizontalRule: 'hr',
    hardBreak: 'br',
  }
  return createElement(
    tags[node.type],
    {
      key,
      ...(node.attrs?.textAlign
        ? { style: { textAlign: node.attrs.textAlign as CSSProperties['textAlign'] } }
        : {}),
      ...(node.type === 'orderedList' ? { start: node.attrs?.start, type: node.attrs?.type } : {}),
      ...(node.type === 'taskList' ? { 'data-type': 'taskList' } : {}),
    },
    children,
  )
}

export function RichTextContent({
  document,
  fallback,
}: {
  document: string | null
  fallback: string
}) {
  let content: ReactNode = <p>{fallback}</p>
  if (document) {
    try {
      const parsed: unknown = JSON.parse(document)
      if (validRichDocument(parsed)) content = parsed.content?.map(renderNode)
    } catch {
      // Retain the readable notes if an older record contains an invalid document.
    }
  }
  return <div className="content-card-notes">{content}</div>
}
