import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteFooter, SiteHeader } from '../components/site-layout'
import homeStyles from '../home.css?url'

export const Route = createFileRoute('/')({
  head: () => ({
    links: [{ rel: 'stylesheet', href: homeStyles }],
    meta: [
      { title: 'Hi, I’m Steve. — Steve Rossiter Coaching' },
      { name: 'description', content: 'My mission is to help you feel great.' },
    ],
  }),
  component: Landing,
})

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
          <div className="home-hero-copy">
            <h1>
              <span>Hi,</span> <span>I’m Steve.</span>
            </h1>
            <p>My mission is to help you feel great.</p>
            <Link className="home-work-link" to="/work-with-me">
              Work with me <span className="home-work-arrow">→</span>
            </Link>
          </div>
          <div className="home-hero-media">
            <img
              className="home-portrait"
              src="/images/steve-rossiter-outdoors.jpg"
              alt="Steve Rossiter standing on a misty hillside"
              width="1646"
              height="2058"
              fetchPriority="high"
            />
          </div>
        </section>

        <div className="home-content">
          <section className="home-prose home-story">
            <p className="home-lede">
              I know what it’s like to feel great, be healthy, [kind of] strong, and get compliments
              about my body from strangers (mostly dudes).
            </p>
            <p>
              I also know what it’s like to feel like complete shit. I’m not talking about being
              sick or deathly hungover (although I know that feeling too). I’m talking about{' '}
              <em>years</em> of low energy, chronic fatigue, constant anxiety, poor sleep, digestion
              issues, feeling cold all the time, losing strength &amp; muscle, having a dysregulated
              nervous system… all while thinking I was “doing everything right.”
            </p>
            <p className="home-aside">Maybe you can relate. Maybe not. Maybe fuck yaself.</p>
            <p>
              Maybe you just want to feel better, have better energy, be more confident, and
              actually enjoy your life instead of grinding through it. Either way, you’re in the
              right place.
            </p>
            <p>
              I disappeared for a bit because I had to figure out what the fuck was going on with my
              body and my life. I went deep. Learned a lot and unlearned even more. I came out the
              other end feeling better than ever and with a completely new perspective. A new
              philosophy.
            </p>
            <p className="home-kicker">And now I feel a responsibility to share it.</p>
          </section>

          <section className="home-prose home-wellth" aria-labelledby="wellth-manager-title">
            <h2 id="wellth-manager-title">I’m your Wellth Manager.</h2>
            <p>
              I’m not your personal trainer. I’m not here to spoonfeed your macros. This isn’t some
              one-size-fits-all cookie-cutter AI bullshit. It’s me and you—mano a mano—building
              real, lasting wellth (I always thought it was mono e mono until just now).
            </p>
            <h2>What is wellth, you ask?</h2>
            <p>
              It’s having a strong, capable body. The ability to move well and pain-free. A calm
              nervous system. Being present and at peace. Joy, playfulness, silliness. Community.
              Living in gratitude. Living in alignment. It’s that warm, fuzzy feeling. The
              combination of a youthful spirit and mature wisdom. It’s having sustainable energy so
              you can handle your responsibilities <em>and</em> meet the demands of whatever life
              throws at you.
            </p>
            <p className="home-statement">
              Wellth is anything that helps you feel great and enjoy your life.
            </p>
          </section>

          <section className="home-comparison" aria-labelledby="comparison-title">
            <div className="home-comparison-inner">
              <h2 id="comparison-title">
                <span className="home-fitness">“FITNESS”</span> <span className="home-vs">vs.</span>{' '}
                <span>wellth</span>
              </h2>
              <ul>
                {comparisons.map(([fitness, wellth]) => (
                  <li key={fitness}>
                    <span className="home-fitness">{fitness}</span>{' '}
                    <span className="home-vs">vs.</span> <span>{wellth}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="home-closing">
            <h2>Are you ready to feel great and finally enjoy your life?</h2>
            <p className="home-quote">
              <em>
                “Think of yourself as dead. You have lived your life. Now take what’s left and live
                it properly.”
              </em>{' '}
              <span className="home-quote-author">- Marcus Aurelius</span>
            </p>
            <Link className="home-work-link" to="/work-with-me">
              Work with me <span className="home-work-arrow">→</span>
            </Link>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
