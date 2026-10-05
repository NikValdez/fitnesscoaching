import { useState } from 'react'
import { createFileRoute, type SearchSchemaInput } from '@tanstack/react-router'
import { ArrowDown, ArrowRight } from 'lucide-react'
import { IntroForm } from '../components/intro-form'
import { SiteLayout } from '../components/site-layout'
import { CoachingPricing } from '../components/coaching-pricing'
import { getCoachingOffering } from '../lib/subscriptions'
import { coachingBillingCadence } from '../lib/coaching-offering'
import { wellthDefinition, wellthParagraphs } from '../content/wellth'

export const Route = createFileRoute('/work-with-me')({
  head: () => ({
    meta: [
      { title: 'Work With Me — Steve Rossiter' },
      {
        name: 'description',
        content:
          'Online coaching with Steve Rossiter is $1,000 per month or $9,600 per year. Save $2,400 with yearly billing. Also offering one-on-one coaching in Los Angeles.',
      },
    ],
  }),
  headers: () => ({ 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }),
  validateSearch: (
    search: {
      coaching?: unknown
      session_id?: unknown
      error?: unknown
      billing?: unknown
    } & SearchSchemaInput,
  ) => ({
    coaching: typeof search.coaching === 'string' ? search.coaching.slice(0, 40) : undefined,
    session_id: typeof search.session_id === 'string' ? search.session_id.slice(0, 255) : undefined,
    error: typeof search.error === 'string' ? search.error.slice(0, 100) : undefined,
    billing: coachingBillingCadence(search.billing) || 'monthly',
  }),
  loaderDeps: ({ search }) => ({ sessionId: search.session_id, result: search.coaching }),
  loader: ({ deps }) => getCoachingOffering({ data: { sessionId: deps.sessionId, refresh: true } }),
  staleTime: 0,
  component: WorkWithMePage,
})

const coachingSteps = [
  {
    title: 'Apply.',
    description:
      'Fill out the short form below. Tell me about yourself. The more detail the better.',
  },
  {
    title: 'Phone Call.',
    description:
      'A free, no-pressure, 30-minute call to make sure we’re a great fit for each other.',
  },
  {
    title: 'Wellth Audit.',
    description:
      'A 60-minute comprehensive intake. We cover everything health & wellness; your goals, current lifestyle, nervous system, stress, sleep, recovery, nutrition, training… The whole shebang.',
  },
  {
    title: 'Your Personalized Wellth Strategy.',
    description:
      'Within one week of your audit, I create a personalized plan that’s built specifically around you, your life, and where you want to go.',
  },
  {
    title: 'Ongoing Management & Support.',
    description:
      "As your life changes, your strategy changes with it. Weekly 60-minute calls, daily text and voice access, real-time adjustments. I'm in your corner for as long as we're working together. There is no finish line.",
  },
] as const

function WorkWithMePage() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const [interest, setInterest] = useState('')
  return (
    <SiteLayout className="marketing-page">
      <section className="work-intro" aria-labelledby="work-intro-title">
        <div className="container work-story-grid">
          <div className="work-intro-heading">
            <p className="eyebrow">
              <em>NOT YOUR MOTHER’S PERSONAL TRAINING.</em>
            </p>
            <h1 id="work-intro-title">
              This is <span>Wellth Management.</span>
            </h1>
          </div>
          <div className="work-story-copy">
            <p>
              A wealth manager manages your money so you don’t have to stress about it. They don’t
              hand you a list of stonks and say, <em>“good luck, bro! …and BUY THE DIP!”</em> They
              listen, consult, build a strategy, and manage your portfolio over time. They check in,
              adjust, and give you access to their expertise whenever you need it.
            </p>
            <p>
              As your wellth manager, I do the same but for your body and your life. I don’t hand
              you a cookie-cutter workout template and say, “good luck, bro!” I listen, consult,
              build a strategy, and manage your wellness portfolio over time. I check in, adjust,
              and give you access to my expertise whenever you need it.
            </p>
          </div>
        </div>
      </section>
      <section className="work-wellth" aria-labelledby="work-wellth-title">
        <div className="container work-story-grid">
          <div className="work-story-heading">
            <h2 id="work-wellth-title">What is wellth?</h2>
            <p className="work-wellth-definition">{wellthDefinition}</p>
          </div>
          <div className="work-story-copy">
            {wellthParagraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>
      <section className="work-fit" aria-labelledby="work-fit-title">
        <div className="container work-story-grid">
          <div className="work-story-heading">
            <h2 id="work-fit-title">Wellth Management is for you if…</h2>
          </div>
          <div className="work-story-copy">
            <ul className="work-fit-list">
              {[
                'Your health has taken a back seat to everything else in your life.',
                "You've tried programs, challenges, and apps. They worked for a bit. Then “life happened” and you stopped.",
                "You don't want to be told to eat cold chicken and raw broccoli for 12 weeks. (I haven’t eaten a vegatable in 2 years other than my daily carrot).",
                'You want to actually understand your body— not just follow a plan.',
                'You want a real person in your corner. Not a template. Not AI. Me (a real human bean).',
                "You're ready to play the long game and enjoy the process.",
              ].map((reason) => (
                <li key={reason}>
                  <ArrowRight size={16} aria-hidden="true" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
            <p className="work-fit-note">
              If you're looking for a quick fix or a 30-day shred, this ain’t it, chief. What I do
              requires your honesty, your engagement, and your willingness to slow down and do this
              right.
            </p>
          </div>
        </div>
      </section>
      <section className="work-process" aria-labelledby="work-process-title">
        <div className="container work-process-grid">
          <div className="work-process-heading">
            <h2 id="work-process-title">
              <em>Ok, buddy, how does it work?</em>
            </h2>
          </div>
          <ol className="work-process-steps">
            {coachingSteps.map((step, index) => (
              <li key={step.title}>
                <span className="work-process-number" aria-hidden="true">
                  {index + 1}.
                </span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
          <section
            className="coaching-pricing-panel"
            id="online-coaching"
            aria-label="Online coaching pricing"
          >
            <CoachingPricing
              billing={search.billing}
              showMembershipBadge={false}
              price={data.prices[search.billing] ?? undefined}
              onBillingChange={(billing) => {
                void navigate({
                  search: { ...search, billing },
                  hash: 'online-coaching',
                  replace: true,
                  resetScroll: false,
                  hashScrollIntoView: false,
                })
              }}
              action={
                <a
                  className="button coaching-pricing-apply"
                  href="#work-title"
                  onClick={() => setInterest('Online coaching')}
                >
                  Apply for coaching <ArrowDown size={17} aria-hidden="true" />
                </a>
              }
              note="Starts with a free 30-minute call."
            />
          </section>
        </div>
      </section>
      <section className="booking-section work-contact" aria-labelledby="work-title">
        <div className="container booking-grid">
          <div className="booking-copy">
            <span className="eyebrow">Work With Me</span>
            <h2 id="work-title">Wellth Management</h2>
            <p>
              Interested in working with me online or in person in Los Angeles? Fill out the form
              and let’s chat!
            </p>
          </div>
          <IntroForm interest={interest} onInterestChange={setInterest} />
        </div>
      </section>
    </SiteLayout>
  )
}
