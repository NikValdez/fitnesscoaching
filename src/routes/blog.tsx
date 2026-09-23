import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { SiteLayout } from '../components/site-layout'

export const Route = createFileRoute('/blog')({
  head: () => ({
    meta: [
      { title: 'Blog — Steve Rossiter Coaching' },
      {
        name: 'description',
        content: 'The Steve Rossiter Coaching blog is coming soon. Explore the free 69 easy plan while Steve prepares notes on training, habits, and feeling great.',
      },
    ],
  }),
  component: BlogPage,
})

function BlogPage() {
  return (
    <SiteLayout className="marketing-page">
      <section className="blog-coming container" aria-labelledby="blog-title">
        <div className="blog-coming-copy">
          <span className="eyebrow">The blog / Coming soon</span>
          <h1 id="blog-title">
            Better days,
            <br />
            one thought at a time.
          </h1>
          <p>
            Steve’s notes on training, nutrition, and the small habits that help you feel great are
            on their way.
          </p>
          <div className="button-row">
            <Link className="button" to="/69-easy">
              Read 69 easy <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
            <Link className="button button-outline" to="/work-with-me">
              Work With Me <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
        <div className="blog-preview" aria-hidden="true">
          <span className="blog-preview-top">Notes from Steve / Vol. 01</span>
          <span className="blog-preview-mark">S·R</span>
          <div>
            <span>Strength is a practice.</span>
            <strong>More soon.</strong>
          </div>
          <span className="blog-preview-bottom">Helping you feel great.</span>
        </div>
      </section>
    </SiteLayout>
  )
}
