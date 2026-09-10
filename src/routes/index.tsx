import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Menu,
  X,
  Monitor,
  CalendarCheck,
} from 'lucide-react'
import { Brand } from '../components/brand'
import { IntroForm } from '../components/intro-form'
import { interests } from '../lib/validation'

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): { plan?: string } => ({
    plan: interests.includes(search.plan as (typeof interests)[number])
      ? String(search.plan)
      : undefined,
  }),
  component: Landing,
})

const services = [
  {
    type: 'In-person · Los Angeles',
    title: '1:1 coaching with Steve.',
    text: 'In the LA area? Get in touch about training one-on-one. Tell Steve about your goals and schedule, and he’ll get back to you about working together.',
    items: ['Individual attention', 'Hands-on technique coaching', 'Training around your goals'],
    comingSoon: false,
  },
  {
    type: 'Online coaching · Coming soon',
    title: 'Your program. Anywhere.',
    text: 'Personal online coaching is on the way. It isn’t available to book yet. In the meantime, explore the 69 Easy plan at your own pace.',
    items: [],
    comingSoon: true,
  },
  {
    type: 'Accountability · Coming soon',
    title: 'Support to stay consistent.',
    text: 'Dedicated accountability services are coming soon. Check-ins and ongoing support aren’t open for signups yet.',
    items: [],
    comingSoon: true,
  },
]

function Landing() {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <Brand />
          <nav className={menuOpen ? 'main-nav is-open' : 'main-nav'} aria-label="Main navigation">
            {['Services', 'Process'].map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`} onClick={() => setMenuOpen(false)}>
                {item}
              </a>
            ))}
            <Link to="/program" onClick={() => setMenuOpen(false)}>
              69 Easy
            </Link>
          </nav>
          <a className="button button-small header-cta" href="#book">
            Contact Steve <ArrowUpRight size={14} />
          </a>
          <button
            className="icon-button menu-toggle"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main id="main">
        <section className="container hero">
          <div className="hero-copy">
            <div className="eyebrow hero-eyebrow">
              Coaching In Los Angeles <span className="status-dot" /> online everywhere
            </div>
            <h1>
              Personal coaching, built around <span>you.</span>
            </h1>
            <p className="hero-description">
              Real, one-to-one coaching. Steve personally writes your training and nutrition plan
              around your goals, schedule, experience, and progress.
            </p>
            <div className="button-row">
              <Link className="button" to="/program">
                Explore 69 Easy free <ArrowUpRight size={18} />
              </Link>
              <a className="button button-outline" href="#book">
                Contact Steve <ArrowRight size={16} />
              </a>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-image-wrap">
              <img
                className="hero-image"
                src="/images/steve-rossiter-hero.png"
                alt="AI-generated portrait of Steve Rossiter in a strength-training gym"
                fetchPriority="high"
              />
              <div className="photo-topline">
                <span className="eyebrow">Built around real life</span>
                <span className="image-cross">+</span>
              </div>
              <div className="photo-caption">
                <span className="caption-dot" /> The work is personal.
                <br />
                <span className="caption-indent">The progress is yours.</span>
              </div>
            </div>
            <div className="hero-photo-foot">
              <span className="eyebrow">One-on-one coaching in Los Angeles</span>
              <span>↗</span>
            </div>
          </div>
        </section>
        <section id="services" className="section section-tinted">
          <div className="container">
            <SectionHeading
              number="01"
              label="Services"
              title="Train with Steve in LA."
              description="Get in touch for in-person coaching. More ways to work together are coming soon."
            />
            <div className="services-grid">
              {services.map((service, index) => (
                <article className="service-card" key={service.type}>
                  <div className={`service-art service-art-${index}`}>
                    {index === 0 ? (
                      <>
                        <img
                          src="/images/coaching-hero.png"
                          alt="Barbell coaching in the studio"
                          loading="lazy"
                        />
                        <span className="art-label">On the floor. In your corner.</span>
                      </>
                    ) : index === 1 ? (
                      <div className="training-preview">
                        <div className="mini-label">
                          ONLINE COACHING / COMING SOON <Monitor size={13} />
                        </div>
                        <div className="preview-title">A little stronger, every week.</div>
                        {[
                          ['Back squat', '3 × 8', true],
                          ['Romanian deadlift', '3 × 10', true],
                          ['Split squat', '3 × 12', false],
                        ].map(([name, sets, done]) => (
                          <div className="preview-row" key={String(name)}>
                            <span className={done ? 'mini-check done' : 'mini-check'}>
                              {done && <Check size={9} />}
                            </span>
                            <span>{name}</span>
                            <span>{sets}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="nutrition-preview">
                        <div className="mini-label">ACCOUNTABILITY / COMING SOON</div>
                        <div className="nutrition-rings">
                          <div className="nutrition-ring">
                            <CalendarCheck size={25} />
                            <span>Build your rhythm</span>
                          </div>
                          <div className="macro-key">
                            <span>
                              <i />
                              Habits
                            </span>
                            <span>
                              <i />
                              Check-ins
                            </span>
                            <span>
                              <i />
                              Consistency
                            </span>
                          </div>
                        </div>
                        <div className="mini-label">SMALL HABITS. LASTING CHANGE.</div>
                      </div>
                    )}
                  </div>
                  <div className="service-body">
                    <span className="eyebrow">{service.type}</span>
                    <h3>{service.title}</h3>
                    <p>{service.text}</p>
                    <ul className="check-list">
                      {service.items.map((item) => (
                        <li key={item}>
                          <Check size={14} />
                          {item}
                        </li>
                      ))}
                    </ul>
                    {service.comingSoon ? (
                      <span className="eyebrow service-coming-soon">Coming soon</span>
                    ) : (
                      <a className="text-link" href="#book">
                        Contact Steve <ArrowUpRight size={16} />
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section id="process" className="section">
          <div className="container">
            <SectionHeading
              number="02"
              label="Coaching in Los Angeles"
              title="Start with a conversation."
            />
            <div className="process-grid">
              {[
                [
                  'An honest conversation',
                  'Send Steve a message about your goals, training experience, and availability in the LA area.',
                ],
                [
                  'Hear back from Steve',
                  'Steve will get back to you to discuss what you need and whether in-person coaching is a good fit.',
                ],
                [
                  'A program that fits',
                  'Talk through your goals and the kind of hands-on training that works for you.',
                ],
                [
                  'Train together',
                  'If you decide to train together, work with Steve in person and build from your starting point.',
                ],
              ].map(([title, text], index) => (
                <article className="process-step" key={title}>
                  <div className="step-number">
                    0{index + 1}
                    <ArrowRight size={20} />
                  </div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section id="book" className="booking-section section">
          <div className="container booking-grid">
            <div className="booking-copy">
              <span className="eyebrow">03 / Get in touch</span>
              <h2>
                In LA? Let’s train.
                <br />
                Get in touch with Steve.
              </h2>
              <p>
                Interested in one-on-one coaching in the Los Angeles area? Tell Steve a little about
                yourself, your goals, and where you train. He’ll get back to you to discuss next
                steps.
              </p>
              <ul className="booking-list">
                <li>
                  <ArrowRight size={16} /> One-on-one, in-person coaching in Los Angeles
                </li>
                <li>
                  <ArrowRight size={16} /> Share your goals, location, and availability
                </li>
                <li>
                  <ArrowRight size={16} /> Steve will follow up with you by email
                </li>
              </ul>
              <div className="booking-foot">
                <span className="status-dot" /> One small step. A stronger direction.
              </div>
            </div>
            <IntroForm />
          </div>
        </section>
        <section className="section program-cta" aria-labelledby="program-cta-title">
          <div className="container">
            <div className="program-cta-copy">
              <span className="eyebrow">04 / Your next step</span>
              <h2 id="program-cta-title">Meet 69 Easy.</h2>
              <p>
                A little structure, at your own pace. Explore Steve’s free PDF plan and download the
                sample to keep on your phone, tablet, or laptop. No account needed.
              </p>
            </div>
            <Link className="button" to="/program">
              Explore the 69 Easy plan <ArrowUpRight size={18} />
            </Link>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="container footer-inner">
          <Brand />
          <span className="eyebrow">One-on-one coaching in Los Angeles</span>
          <div>
            <a href="#services">Services</a>
            <Link to="/program">69 Easy plan</Link>
            <a href="#book">Get in touch</a>
            <Link to="/privacy">Privacy</Link>
            <span>© 2026 Steve Rossiter Coaching</span>
          </div>
        </div>
      </footer>
    </>
  )
}

function SectionHeading({
  number,
  label,
  title,
  description,
}: {
  number: string
  label: string
  title: string
  description?: string
}) {
  return (
    <div className="section-heading">
      <div>
        <span className="eyebrow">
          {number} / {label}
        </span>
        <h2>{title}</h2>
      </div>
      {description && <p>{description}</p>}
    </div>
  )
}
