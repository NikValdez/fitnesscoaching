import { createFileRoute } from '@tanstack/react-router'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { ShopLayout, shopLinks } from '../components/shop-layout'
import plan from '../content/69-easy.json'
import programStyles from '../program.css?url'

export const Route = createFileRoute('/69-easy')({
  head: () => ({
    links: [...shopLinks, { rel: 'stylesheet', href: programStyles }],
    meta: [
      { title: '69 easy — Just 1% better every day | Steve Rossiter Coaching' },
      { name: 'description', content: plan.overview.intro },
    ],
  }),
  component: ProgramPage,
})

const sections = [
  ['what-is-69-easy', 'What is 69 easy?'],
  ['choosing-your-10', 'Choosing Your 10 Things'],
  ['example', '69 easy [EXAMPLE]'],
  ['mindset', 'Mindset, Tips, Quotes'],
  ['one-degree-shift', '1-Degree Shift'],
  ['warning', 'WARNING!'],
  ['what-people-say', 'What people are saying'],
]

function ProgramPage() {
  return (
    <ShopLayout>
      <div className="container easy-page" id="top">
        <article aria-labelledby="easy-title">
          <header className="easy-hero">
            <h1 id="easy-title">{plan.title}</h1>
            <div className="easy-hero-note">
              <p>{plan.tagline}</p>
              <a href="#what-is-69-easy" className="text-link">
                What is 69 easy? <ArrowDown size={16} aria-hidden="true" />
              </a>
            </div>
          </header>
          <div className="easy-layout">
            <aside className="easy-sidebar">
              <nav aria-label="Plan sections">
                <span className="eyebrow">On this page</span>
                <ol>
                  {sections.map(([id, label]) => (
                    <li key={id}>
                      <a href={`#${id}`}>{label}</a>
                    </li>
                  ))}
                </ol>
              </nav>
            </aside>
            <div className="easy-reading">
              <blockquote className="easy-introduction">
                {plan.introduction.paragraphs.map((text) => (
                  <p key={text}>{text}</p>
                ))}
                <footer>{plan.introduction.attribution}</footer>
              </blockquote>
              <section
                className="easy-section"
                id="what-is-69-easy"
                aria-labelledby="overview-title"
              >
                <h2 id="overview-title">{plan.overview.heading}</h2>
                <p className="easy-lead">{plan.overview.intro}</p>
                <ol className="easy-steps">
                  {plan.overview.steps.map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ol>
                {plan.overview.paragraphs.map((text) => (
                  <p key={text}>{text}</p>
                ))}
              </section>
              <section
                className="easy-section"
                id="choosing-your-10"
                aria-labelledby="choosing-title"
              >
                <h2 id="choosing-title">{plan.choosing.heading}</h2>
                <ul className="easy-choices">
                  {plan.choosing.items.map((item) => (
                    <li key={item.text}>
                      <p>{item.text}</p>
                      {'detail' in item && (
                        <ul>
                          <li>{item.detail}</li>
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
              <section className="easy-section" id="example" aria-labelledby="example-title">
                <h2 id="example-title">{plan.example.heading}</h2>
                <p className="easy-example-tagline">{plan.example.tagline}</p>
                <ol className="easy-examples">
                  {plan.example.items.map((text) => {
                    const split = text.indexOf('. ') + 1
                    return (
                      <li key={text}>
                        <s>{text.slice(0, split)}</s>{' '}
                        <strong>{text.slice(split).trimStart()}</strong>
                      </li>
                    )
                  })}
                </ol>
              </section>
              <section className="easy-section" id="mindset" aria-labelledby="mindset-title">
                <h2 id="mindset-title">{plan.mindset.heading}</h2>
                <ul className="easy-mindset">
                  {plan.mindset.items.map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ul>
              </section>
              <section
                className="easy-section easy-shift"
                id="one-degree-shift"
                aria-labelledby="shift-title"
              >
                <h2 id="shift-title">{plan.shift.heading}</h2>
                <blockquote>
                  {plan.shift.paragraphs.map((text) => (
                    <p key={text}>{text}</p>
                  ))}
                  <footer>{plan.shift.attribution}</footer>
                </blockquote>
              </section>
              <section
                className="easy-section easy-warning"
                id="warning"
                aria-labelledby="warning-title"
              >
                <h2 id="warning-title">{plan.warning.heading}</h2>
                <blockquote>{plan.warning.quote}</blockquote>
                {plan.warning.paragraphs.map((text) => (
                  <p key={text}>{text}</p>
                ))}
              </section>
              <section
                className="easy-section easy-testimonials"
                id="what-people-say"
                aria-labelledby="testimonials-title"
              >
                <h2 id="testimonials-title">{plan.testimonials.heading}</h2>
                {plan.testimonials.quotes.map((text) => (
                  <blockquote key={text}>{text}</blockquote>
                ))}
              </section>
            </div>
          </div>
        </article>
        <div className="easy-end">
          <a className="text-link" href="#top">
            Back to top <ArrowUp size={16} aria-hidden="true" />
          </a>
        </div>
      </div>
    </ShopLayout>
  )
}
