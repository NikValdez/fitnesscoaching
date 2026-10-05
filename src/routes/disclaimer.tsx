import { createFileRoute } from '@tanstack/react-router'
import { SiteLayout } from '../components/site-layout'

export const Route = createFileRoute('/disclaimer')({
  head: () => ({
    meta: [{ title: 'Disclaimer — Steve Rossiter' }],
  }),
  component: DisclaimerPage,
})

function DisclaimerPage() {
  return (
    <SiteLayout className="marketing-page">
      <article className="disclaimer-page container" aria-labelledby="disclaimer-title">
        <h1 id="disclaimer-title">Disclaimer</h1>
        <p>
          I am not a medical doctor or health professional, and the content of this website is for
          educational and entertainment purposes only. It is not intended to diagnose or treat any
          medical, psychological, or other health-related conditions. It is not a substitute for advice
          from a healthcare professional. Do not disregard medical advice or delay seeking it due to
          opinions or any other information you have read on this website or on any related social
          media content.
        </p>
        <p>
          The opinions expressed are the opinions of the author(s). To the extent permitted by
          applicable law, the author assumes no liability or responsibility for damage or injury to
          persons or property arising from any use of information, ideas, opinions, or instructions
          found within this guide.
        </p>
      </article>
    </SiteLayout>
  )
}
