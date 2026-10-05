import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { blogPosts, blogReadingMinutes } from '../content/blog'

export const Route = createFileRoute('/blog/')({
  component: BlogPage,
})

function BlogPage() {
  return (
    <div className="container blog-index">
      <header className="blog-index-heading">
        <span className="eyebrow">The blog / Notes from Steve</span>
        <h1>
          Better days,
          <br />
          one thought at a time.
        </h1>
        <p>Thoughts on training, presence, and enjoying the process.</p>
      </header>
      <section className="blog-posts" aria-label="Blog posts">
        {blogPosts.map((post, index) => (
          <article className="blog-card" key={post.slug} aria-labelledby={`post-${post.slug}`}>
            <div className="blog-card-copy">
              <span className="eyebrow">
                Note {String(index + 1).padStart(2, '0')} / Training &amp; perspective
              </span>
              <h2 id={`post-${post.slug}`}>
                <Link to="/blog/$slug" params={{ slug: post.slug }}>
                  {post.title}
                </Link>
              </h2>
              <p>{post.excerpt}</p>
              <div className="blog-meta">
                <span>{post.author}</span>
                <span>{blogReadingMinutes(post)} min read</span>
              </div>
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
              <span className="eyebrow">A thought to take into your next set</span>
              <p>“{post.featuredQuote}”</p>
              <span className="blog-card-attribution">— {post.quoteAuthor}</span>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
