import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { blogPosts } from '../content/blog'

export const Route = createFileRoute('/blog/')({
  component: BlogPage,
})

function BlogPage() {
  return (
    <div className="container blog-index">
      <header className="blog-index-heading">
        <span className="eyebrow">The blog</span>
        <h1>Helping you feel great.</h1>
        <p>Hinged thoughts about wellness and life.</p>
      </header>
      <section className="blog-posts" aria-label="Blog posts">
        {blogPosts.map((post) => (
          <article className="blog-card" key={post.slug} aria-labelledby={`post-${post.slug}`}>
            <div className="blog-card-copy">
              <h2 id={`post-${post.slug}`}>
                <Link to="/blog/$slug" params={{ slug: post.slug }}>
                  {post.title}
                </Link>
              </h2>
              <p>{post.excerpt}</p>
              <Link
                className="button"
                to="/blog/$slug"
                params={{ slug: post.slug }}
                aria-label={`Read ${post.title}`}
              >
                Read the post <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
            <div className="blog-card-quote" aria-hidden="true">
              <p>“{post.featuredQuote}”</p>
              {post.quoteAuthor && (
                <span className="blog-card-attribution">— {post.quoteAuthor}</span>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
