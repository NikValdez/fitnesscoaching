import { createFileRoute } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { IntroForm } from '../components/intro-form'
import { SiteLayout } from '../components/site-layout'

export const Route = createFileRoute('/work-with-me')({
  head: () => ({
    meta: [
      { title: 'Work With Me — Steve Rossiter' },
      {
        name: 'description',
        content: 'Get in touch with Steve Rossiter about one-on-one coaching in Los Angeles. Share your goals and Steve will follow up by email.',
      },
    ],
  }),
  component: WorkWithMePage,
})

const wellthComparisons = [
  ['Initial consultation & financial audit', 'Initial Wellth Audit — the full picture'],
  ['Personalized investment strategy', 'Personalized Wellth Strategy'],
  ['Portfolio construction', 'Training + nutrition + recovery + lifestyle'],
  ['Ongoing management & adjustments', 'Ongoing management & adjustments'],
  ['Regular check-ins & reviews', 'Weekly check-ins & reviews'],
  ['Market intelligence & recommendations', 'Wellness intelligence & recommendations'],
  ['Access to expertise when you need it', 'Access to Steve when you need it'],
  ['Builds long-term wealth', 'Builds long-term Wellth'],
] as const

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
      <section className="work-comparison" aria-labelledby="wellth-comparison-title">
        <div className="container">
          <div className="work-comparison-heading">
            <span className="eyebrow">The Wellth Manager approach</span>
            <h2 id="wellth-comparison-title">Build long-term wellth.</h2>
            <p>
              The same care you’d give your finances, applied to how you feel, move, and live.
            </p>
          </div>
          <div className="work-comparison-table-wrap">
            <table className="work-comparison-table" aria-labelledby="wellth-comparison-title">
              <thead>
                <tr>
                  <th scope="col">Wealth Manager</th>
                  <th scope="col">Wellth Manager</th>
                </tr>
              </thead>
              <tbody>
                {wellthComparisons.map(([wealth, wellth]) => (
                  <tr key={wealth}>
                    <td>{wealth}</td>
                    <td>{wellth}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </SiteLayout>
  )
}
