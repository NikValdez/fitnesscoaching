import { createFileRoute } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { IntroForm } from '../components/intro-form'
import { SiteLayout } from '../components/site-layout'

export const Route = createFileRoute('/work-with-me')({
  head: () => ({
    meta: [
      { title: 'Work With Me — Steve Rossiter Coaching' },
      {
        name: 'description',
        content: 'Get in touch with Steve Rossiter about one-on-one coaching in Los Angeles. Share your goals and Steve will follow up by email.',
      },
    ],
  }),
  component: WorkWithMePage,
})

function WorkWithMePage() {
  return (
    <SiteLayout className="marketing-page">
      <section className="booking-section work-contact" aria-labelledby="work-title">
        <div className="container booking-grid">
          <div className="booking-copy">
            <span className="eyebrow">Work With Me / Los Angeles</span>
            <h1 id="work-title">Let’s start where you are.</h1>
            <p>
              Interested in one-on-one coaching? Tell Steve about your goals, where you’re based in
              LA, and what kind of support you’re looking for. He’ll get back to you by email.
            </p>
            <ul className="booking-list">
              <li>
                <ArrowRight size={16} aria-hidden="true" /> Training built around you
              </li>
              <li>
                <ArrowRight size={16} aria-hidden="true" /> In-person coaching in Los Angeles
              </li>
              <li>
                <ArrowRight size={16} aria-hidden="true" /> Start with a conversation
              </li>
            </ul>
          </div>
          <IntroForm />
        </div>
      </section>
    </SiteLayout>
  )
}
