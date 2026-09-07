import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Plus,
  Menu,
  X,
  Dumbbell,
  Monitor,
  Utensils,
  MoveUpRight,
} from 'lucide-react'
import { Brand } from '../components/brand'
import { IntroForm } from '../components/intro-form'
import { authClient } from '../lib/auth-client'
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
    type: 'In-person',
    title: '1:1 gym coaching',
    text: 'Hands-on sessions on our Los Angeles floor. Technique corrected in the moment, loads logged as you go, and a plan for the days you train alone.',
    items: ['Coaching built around you', 'Movement assessments & retests', 'A shared training log'],
    icon: Dumbbell,
  },
  {
    type: 'Online',
    title: 'Your program. Anywhere.',
    text: 'Training written for your equipment, schedule, and history. You film your sets, I review them, and your next block adapts to your progress.',
    items: [
      'New training blocks every 4 weeks',
      'Individual video form reviews',
      'Weekly written check-ins',
    ],
    icon: Monitor,
  },
  {
    type: 'Nutrition',
    title: 'Good food. Better habits.',
    text: 'No meal plans you’ll abandon. We set targets around food you already like, then look at intake, sleep, and the bigger picture together.',
    items: [
      'Practical macro & habit targets',
      'Grocery and eating-out guidance',
      'Progress beyond the scale',
    ],
    icon: Utensils,
  },
]

const plans = [
  {
    name: 'Online',
    price: '180',
    note: 'A plan that goes where you go.',
    interest: 'Online programming',
    items: [
      'Custom 4-week training blocks',
      'Video form reviews',
      'Weekly written check-in',
      'Nutrition targets included',
    ],
    button: 'Start online',
  },
  {
    name: 'Hybrid',
    price: '340',
    note: 'Online freedom. In-person feedback.',
    interest: 'Hybrid coaching',
    items: [
      'Everything in Online',
      '2 in-person sessions each month',
      'Movement screen & retest',
      'Monthly nutrition coaching call',
    ],
    button: 'Start hybrid',
    popular: true,
  },
  {
    name: 'Studio 1:1',
    price: '620',
    note: 'A coach beside you, every session.',
    interest: 'In-person coaching',
    items: [
      '8 coached sessions each month',
      'Individual nutrition coaching',
      'Priority messaging',
      'Regular progress assessments',
    ],
    button: 'Explore studio coaching',
  },
]

function Landing() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { plan } = Route.useSearch()
  const [interest, setInterest] = useState(plan ?? 'Not sure yet')
  useEffect(() => {
    if (plan) setInterest(plan)
  }, [plan])
  const { data: session } = authClient.useSession()
  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <Brand />
          <nav className={menuOpen ? 'main-nav is-open' : 'main-nav'} aria-label="Main navigation">
            {['Services', 'Process', 'Results', 'Pricing'].map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`} onClick={() => setMenuOpen(false)}>
                {item}
              </a>
            ))}
            <Link to="/program" onClick={() => setMenuOpen(false)}>
              69 easy
            </Link>
          </nav>
          <Link className="login-link" to={session ? '/portal' : '/login'}>
            {session ? 'My portal' : 'Client login'}
            <ArrowUpRight size={14} />
          </Link>
          <a className="button button-small header-cta" href="#book">
            Book intro call <ArrowUpRight size={14} />
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
              <span className="status-dot" /> In-person · Online · Nutrition
            </div>
            <h1>
              Personal coaching, built around <span>you.</span>
            </h1>
            <p className="hero-description">
              Real, one-to-one coaching. Steve personally writes your training and nutrition plan
              around your goals, schedule, experience, and progress.
            </p>
            <div className="button-row">
              <a className="button" href="#book">
                Book a free intro call <ArrowUpRight size={18} />
              </a>
              <a className="button button-outline" href="#pricing">
                Find your plan <ArrowRight size={16} />
              </a>
            </div>
            <div className="hero-stats">
              <div>
                <strong>
                  340<span>+</span>
                </strong>
                <span className="eyebrow">Clients coached</span>
              </div>
              <div>
                <strong>
                  92<span>%</span>
                </strong>
                <span className="eyebrow">12-week retention</span>
              </div>
              <div>
                <strong>
                  9 <span>yrs</span>
                </strong>
                <span className="eyebrow">Coaching practice</span>
              </div>
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
              <span className="eyebrow">Los Angeles, everywhere online</span>
              <span>↗</span>
            </div>
          </div>
        </section>
        <section id="services" className="section section-tinted">
          <div className="container">
            <SectionHeading
              number="01"
              label="Services"
              title="Three ways to work together."
              description="Different starting points. The same individual attention."
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
                          YOUR TRAINING / WEEK 04 <Monitor size={13} />
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
                        <div className="mini-label">SMALL HABITS. LASTING CHANGE.</div>
                        <div className="nutrition-rings">
                          <div className="nutrition-ring">
                            <Utensils size={25} />
                            <span>Find your balance</span>
                          </div>
                          <div className="macro-key">
                            <span>
                              <i />
                              Protein
                            </span>
                            <span>
                              <i />
                              Carbs
                            </span>
                            <span>
                              <i />
                              Fats
                            </span>
                          </div>
                        </div>
                        <div className="mini-label">NOURISH YOUR TRAINING. ENJOY YOUR FOOD.</div>
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
                    <Link
                      className="text-link"
                      to="/"
                      hash="book"
                      search={{
                        plan:
                          index === 0
                            ? 'In-person coaching'
                            : index === 1
                              ? 'Online programming'
                              : 'Nutrition coaching',
                      }}
                    >
                      Let’s talk <ArrowUpRight size={16} />
                    </Link>
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
              label="The process"
              title="A clear plan. A steady rhythm."
            />
            <div className="process-grid">
              {[
                [
                  'An honest conversation',
                  'Fifteen free minutes about your history, your schedule, and what you want out of the next year.',
                ],
                [
                  'Find your starting point',
                  'A movement assessment, a strength baseline, and a look at your habits. We start where you are.',
                ],
                [
                  'A program that fits',
                  'Training blocks and nutrition targets built together, with a clear reason behind every part.',
                ],
                [
                  'Review. Adjust. Repeat.',
                  'A weekly check-in on what got done, what changed, and one useful adjustment for the week ahead.',
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
        <section id="results" className="section section-tinted">
          <div className="container">
            <SectionHeading
              number="03"
              label="Real progress"
              title="In their words. In their numbers."
            />
            <div className="results-grid">
              <Testimonial
                quote="First coach who asked what my week looked like before writing anything. I’ve trained through two work trips and a move without falling off."
                name="Dana R."
                initials="DR"
                detail="Online · 14 months"
                stat1="+38 kg"
                label1="Deadlift"
                stat2="−9 kg"
                label2="Body weight"
              />
              <Testimonial
                quote="The nutrition side was the surprise. Nothing was banned—we just fixed protein and my breakfast, and the rest followed."
                name="Marcus O."
                initials="MO"
                detail="Nutrition + in-person · 8 months"
                stat1="148 g"
                label1="Daily protein"
                stat2="6.9 h"
                label2="Average sleep"
              />
              <article className="results-summary">
                <span className="eyebrow">The bigger picture / 2025</span>
                <div>
                  <strong>
                    86<span>%</span>
                  </strong>
                  <p>hit their 12-week strength target</p>
                </div>
                <div>
                  <strong>4.1</strong>
                  <p>sessions logged per week, on average</p>
                </div>
                <div>
                  <strong>0</strong>
                  <p>crash diets. Ever.</p>
                </div>
              </article>
            </div>
          </div>
        </section>
        <section id="pricing" className="section">
          <div className="container">
            <SectionHeading
              number="04"
              label="Your investment"
              title="A plan for your kind of life."
              description="Month to month. Clear pricing. Nutrition included."
            />
            <div className="pricing-grid">
              {plans.map((plan) => (
                <article
                  className={`price-card ${plan.popular ? 'price-popular' : ''}`}
                  key={plan.name}
                >
                  <div className="price-heading">
                    <h3>{plan.name}</h3>
                    {plan.popular && <span className="badge">Most popular</span>}
                  </div>
                  <p>{plan.note}</p>
                  <div className="price">
                    ${plan.price}
                    <span>/ month</span>
                  </div>
                  <ul className="check-list">
                    {plan.items.map((item) => (
                      <li key={item}>
                        <Check size={15} />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/"
                    hash="book"
                    search={{ plan: plan.interest }}
                    className={`button ${plan.popular ? '' : 'button-outline'}`}
                  >
                    {plan.button}
                    <ArrowUpRight size={16} />
                  </Link>
                </article>
              ))}
            </div>
            <p className="pricing-footnote">
              <span>No long-term contracts</span>
              <span>Pause any month</span>
              <span>Nutrition-only coaching from $120/mo</span>
            </p>
          </div>
        </section>
        <section id="book" className="booking-section section">
          <div className="container booking-grid">
            <div className="booking-copy">
              <span className="eyebrow">05 / Your next chapter</span>
              <h2>
                Fifteen free minutes.
                <br />A real conversation.
              </h2>
              <p>
                We’ll talk about where you are, where you want to go, and what’s been getting in the
                way. Let’s find out if we’re a good fit.
              </p>
              <ul className="booking-list">
                <li>
                  <ArrowRight size={16} /> Video or phone, whatever works for you
                </li>
                <li>
                  <ArrowRight size={16} /> Talk through your goals and your schedule
                </li>
                <li>
                  <ArrowRight size={16} /> Leave with a clearer next step
                </li>
              </ul>
              <div className="booking-foot">
                <span className="status-dot" /> One small step. A stronger direction.
              </div>
            </div>
            <IntroForm interest={interest} onInterestChange={setInterest} />
          </div>
        </section>
        <section className="section faq-section">
          <div className="container faq-grid">
            <div>
              <span className="eyebrow">06 / A few things to know</span>
              <h2>
                Good questions.
                <br />
                Straight answers.
              </h2>
              <a className="text-link" href="#book">
                Something else on your mind? <ArrowUpRight size={16} />
              </a>
            </div>
            <div className="faq-list">
              {[
                [
                  'I’ve never lifted before. Is it too soon?',
                  'Not at all. Your first block focuses on technique and consistency, with a program that starts at your experience level.',
                ],
                [
                  'Do I need a full gym for online coaching?',
                  'Your program is written around your equipment. Home setups, hotel gyms, and commercial floors all work.',
                ],
                [
                  'Is my program generated by AI?',
                  'No. Steve writes and adjusts every plan himself, based on your goals, schedule, experience, feedback, and progress.',
                ],
                [
                  'Is nutrition a separate cost?',
                  'Nutrition targets are included in every coaching plan. Nutrition-only coaching is available if you already have a training program you like.',
                ],
                [
                  'What if I travel or get sick?',
                  'We adjust your training around the week you actually have. You can also pause for a month with a week’s notice.',
                ],
              ].map(([question, answer]) => (
                <details key={question}>
                  <summary>
                    {question}
                    <Plus size={17} />
                  </summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
        <section className="client-banner">
          <div className="container">
            <div>
              <span className="eyebrow">Your effort, on record</span>
              <h2>Make every session count.</h2>
              <p>Keep your workouts, weekly reflections, and progress in one place.</p>
            </div>
            <Link className="button button-dark" to="/signup">
              Create your free account <MoveUpRight size={17} />
            </Link>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="container footer-inner">
          <Brand />
          <span className="eyebrow">Los Angeles, everywhere online</span>
          <div>
            <a href="#services">Services</a>
            <a href="#pricing">Pricing</a>
            <Link to="/program">69 easy PDF</Link>
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

function Testimonial({
  quote,
  name,
  initials,
  detail,
  stat1,
  label1,
  stat2,
  label2,
}: Record<string, string>) {
  return (
    <figure className="testimonial">
      <span className="quote-mark">“</span>
      <blockquote>{quote}</blockquote>
      <figcaption>
        <span className="avatar">{initials}</span>
        <div>
          <strong>{name}</strong>
          <span>{detail}</span>
        </div>
      </figcaption>
      <div className="testimonial-stats">
        <div>
          <strong>{stat1}</strong>
          <span className="eyebrow">{label1}</span>
        </div>
        <div>
          <strong>{stat2}</strong>
          <span className="eyebrow">{label2}</span>
        </div>
      </div>
    </figure>
  )
}
