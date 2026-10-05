import type { BlogBlock } from '../content/blog'

export function BlogContent({ blocks }: { blocks: BlogBlock[] }) {
  return (
    <div className="blog-prose">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'paragraph':
            return <p key={index}>{block.text}</p>
          case 'heading':
            return <h2 key={index}>{block.text}</h2>
          case 'list':
            return (
              <ul key={index}>
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{item}</li>
                ))}
              </ul>
            )
          case 'separator':
            return (
              <div className="blog-separator" role="separator" key={index}>
                {block.text}
              </div>
            )
          case 'quote':
            return (
              <figure className="blog-quotation" key={index}>
                {block.author && block.authorPosition === 'before' && (
                  <figcaption className="eyebrow">{block.author}</figcaption>
                )}
                <blockquote>
                  {block.paragraphs.map((paragraph, paragraphIndex) => (
                    <p key={paragraphIndex}>{paragraph}</p>
                  ))}
                </blockquote>
                {block.author && block.authorPosition !== 'before' && (
                  <figcaption className="eyebrow">— {block.author}</figcaption>
                )}
              </figure>
            )
        }
      })}
    </div>
  )
}
