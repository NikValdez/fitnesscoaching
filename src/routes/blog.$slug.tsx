import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { blogPosts } from '../content/blog'
import { BlogContent } from '../components/blog-content'

export const Route = createFileRoute('/blog/$slug')({
  loader: ({ params }) => {
    const post = blogPosts.find((post) => post.slug === params.slug)
    if (!post) throw notFound()
    return post
  },
  head: ({ loaderData: post }) => ({
    meta: post
      ? [
          { title: `${post.title} — Steve Rossiter` },
          { name: 'description', content: post.excerpt },
          { property: 'og:title', content: post.title },
          { property: 'og:description', content: post.excerpt },
          { property: 'og:type', content: 'article' },
          { name: 'author', content: post.author },
        ]
      : [],
  }),
  component: BlogPostPage,
  notFoundComponent: () => (
    <div className="container blog-not-found">
      <span className="eyebrow">Post not found</span>
      <h1>This page is a little off course.</h1>
      <Link className="button" to="/blog">
        Back to the blog
      </Link>
    </div>
  ),
})

function BlogPostPage() {
  const post = Route.useLoaderData()
  return (
    <div className="container blog-reading-page">
      <Link className="text-link blog-back" to="/blog">
        <ArrowLeft size={16} aria-hidden="true" /> Back to the blog
      </Link>
      <article className="blog-article" aria-labelledby="blog-post-title">
        <header className="blog-article-heading">
          <h1 id="blog-post-title">{post.title}</h1>
        </header>
        <div className="blog-article-body">
          <BlogContent blocks={post.body} />
          <footer className="blog-article-footer">
            <Link className="text-link" to="/blog">
              <ArrowLeft size={16} aria-hidden="true" /> All posts
            </Link>
          </footer>
        </div>
      </article>
    </div>
  )
}
