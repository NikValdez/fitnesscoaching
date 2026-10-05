import { createFileRoute, Link } from '@tanstack/react-router'
import { Fragment, type CSSProperties } from 'react'
import { SiteFooter, SiteHeader } from '../components/site-layout'
import { wellthDefinition, wellthParagraphs } from '../content/wellth'
import homeStyles from '../home.css?url'

export const Route = createFileRoute('/')({
  head: () => ({
    links: [{ rel: 'stylesheet', href: homeStyles }],
    meta: [
      { title: 'Steve Rossiter | Wellth Management' },
      { name: 'description', content: 'My mission is to help you feel great.' },
    ],
  }),
  component: Landing,
})

// The opening statement, revealed word by word as it scrolls through the viewport.
type RevealPart = { text: string } | { scribble: string }

const statement: RevealPart[] = [
  { text: 'I know what it’s like to feel great, be healthy,' },
  { scribble: '[kind of]' },
  { text: 'strong, and get compliments about my body from strangers' },
  { scribble: '(mostly dudes).' },
]

const wellthTraits = [
  'Strong, capable body',
  'Moving pain-free',
  'Calm nervous system',
  'Presence',
  'Joy',
  'Playfulness',
  'Silliness',
  'Community',
  'Gratitude',
  'Alignment',
  'Youthful spirit',
  'Mature wisdom',
  'Sustainable energy',
]

const comparisons = [
  ['RISE & GRIND', 'rise & coffee grinds'],
  ['NO DAYS OFF', 'more days off'],
  ['50 PILLS A DAY', 'taking a chill pill'],
  ['CUTTING CARBS FROM YOUR DIET', 'cutting carbs with a high-quality chef’s knife'],
  ['DAVID GOGGINS', 'Walton Goggins'],
  ['30-DAY CHALLENGE!', 'real, lasting wellth'],
]

function Landing() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="home-page">
        <section className="home-hero">
          <div className="home-hero-bg" aria-hidden="true" />
          <div className="home-hero-copy">
            <h1>Hi, I’m Steve.</h1>
            <p className="home-hero-sub">
              My mission is to help you{' '}
              <span className="home-mark">
                feel great
                <Underline />
              </span>
              .
            </p>
          </div>
          <figure className="home-hero-figure">
            <img
              className="home-portrait"
              src="/images/steve-rossiter-outdoors.jpg"
              alt="Steve Rossiter standing on a misty hillside"
              width="1646"
              height="2058"
              fetchPriority="high"
            />
            <figcaption className="home-scribble home-hero-note" aria-hidden="true">
              me, feeling great
              <svg viewBox="0 0 80 60" fill="none">
                <path d="M6 6c18 2 38 12 48 30 4 7 6 12 7 18" />
                <path d="M50 46l11 9 6-14" />
              </svg>
            </figcaption>
          </figure>
        </section>

        <section className="home-statement" aria-label="Where I’m coming from">
          <RevealStatement parts={statement} />
        </section>

        <section id="story" className="home-story">
          <p>
            I also know what it’s like to feel like complete shit. I’m not talking about being sick
            or deathly hungover (although I know that feeling too). I’m talking about <em>years</em>{' '}
            of low energy, chronic fatigue, constant anxiety, poor sleep, digestion issues, feeling
            cold all the time, losing strength &amp; muscle, having a dysregulated nervous system…
            all while thinking I was “doing everything right.”
          </p>
          <p className="home-aside">
            Maybe you can relate. Maybe not. <br />
            Maybe fuck yaself.
          </p>
          <p>
            Maybe you just want to feel better, have better energy, be more confident, and actually
            enjoy your life instead of grinding through it. Either way, you’re in the right place.
          </p>
          <p>
            I disappeared for a bit because I had to figure out what the fuck was going on with my
            body and my life. I went deep. Learned a lot and unlearned even more. I came out the
            other end feeling better than ever and with a completely new perspective. A new
            philosophy.
          </p>
          <p className="home-kicker">
            And now I feel a{' '}
            <span className="home-mark home-mark-scroll">
              responsibility
              <Underline />
            </span>{' '}
            to share it.
          </p>
        </section>

        <section className="home-features" aria-labelledby="wellth-manager-title">
          <div className="home-feature">
            <div className="home-tile home-tile-photo">
              <img
                src="/images/steve-client-coaching.png"
                alt="Steve coaching a client between sets at the gym"
                width="801"
                height="1384"
                loading="lazy"
              />
            </div>
            <div className="home-feature-copy">
              <h2 id="wellth-manager-title">I’m your Wellth Manager.</h2>
              <p>
                I’m not your personal trainer. I’m not here to spoonfeed your macros. This isn’t
                some one-size-fits-all cookie-cutter AI bullshit. It’s me and you—mano a
                mano—building real, lasting wellth (I always thought it was mono e mono until just
                now).
              </p>
            </div>
          </div>

          <div className="home-feature home-feature-flip">
            <div className="home-tile home-tile-traits" aria-hidden="true">
              <ul>
                {wellthTraits.map((trait) => (
                  <li key={trait}>{trait}</li>
                ))}
              </ul>
            </div>
            <div className="home-feature-copy">
              <h2>What is wellth?</h2>
              <p>{wellthDefinition}</p>
              {wellthParagraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        </section>

        <section className="home-definition">
          <p>
            Wellth is anything that helps you{' '}
            <span className="home-mark home-mark-scroll">
              feel great
              <Underline />
            </span>{' '}
            and{' '}
            <span className="home-mark home-mark-scroll">
              enjoy your life
              <Underline />
            </span>
            .
          </p>
        </section>

        <section className="home-comparison" aria-labelledby="comparison-title">
          <div className="home-comparison-inner">
            <h2 id="comparison-title">
              <span className="home-fitness">“FITNESS”</span> <span className="home-vs">vs.</span>{' '}
              <span className="home-wellth">wellth</span>
            </h2>
            <ul>
              {comparisons.map(([fitness, wellth]) => (
                <li key={fitness}>
                  <span className="home-fitness">{fitness}</span>{' '}
                  <span className="home-vs">vs.</span> <span className="home-wellth">{wellth}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="home-closing">
          <h2>Are you ready to feel great and finally enjoy your life?</h2>
          <p className="home-quote">
            <em>
              “Think of yourself as dead. You have lived your life. Now take what’s left and live it
              properly.”
            </em>{' '}
            <span className="home-quote-author">- Marcus Aurelius</span>
          </p>
          <WorkLink />
        </section>
      </main>
      <SiteFooter />
    </>
  )
}

function WorkLink() {
  return (
    <Link className="home-button" to="/work-with-me">
      Work with me <span className="home-arrow">→</span>
    </Link>
  )
}

function Underline() {
  return (
    <svg
      className="home-underline"
      viewBox="0 0 200 16"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d="M3 11C46 5 112 3 197 6M150 12c14-1 29-1 42-.5" pathLength="1" />
    </svg>
  )
}

function RevealStatement({ parts }: { parts: RevealPart[] }) {
  const units = parts.flatMap((part): RevealPart[] =>
    'text' in part ? part.text.split(' ').map((text) => ({ text })) : [part],
  )

  return (
    <p className="home-reveal" style={{ '--n': units.length } as CSSProperties}>
      {units.map((unit, i) => {
        const style = { '--i': i } as CSSProperties
        return (
          <Fragment key={i}>
            {'scribble' in unit ? (
              <span className="home-reveal-word home-scribble" style={style}>
                {unit.scribble}
              </span>
            ) : (
              <span className="home-reveal-word" style={style}>
                {unit.text}
              </span>
            )}
            {i < units.length - 1 && ' '}
          </Fragment>
        )
      })}
    </p>
  )
}
