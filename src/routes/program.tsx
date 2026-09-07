import { createFileRoute, type SearchSchemaInput } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowUpRight, Check, CreditCard, Download, FileText, LockKeyhole } from 'lucide-react'
import { ShopLayout, shopLinks } from '../components/shop-layout'
import { pdfProgram, programPrice } from '../lib/product'
import { getShop } from '../lib/shop'

export const Route = createFileRoute('/program')({
  head: () => ({
    links: shopLinks,
    meta: [
      { title: '69 easy — PDF program | Steve Rossiter Coaching' },
      {
        name: 'description',
        content:
          'Explore 69 easy, a downloadable PDF program from Steve Rossiter Coaching. One purchase, your own pace.',
      },
    ],
  }),
  validateSearch: (search: { checkout?: unknown } & SearchSchemaInput) => ({
    checkout: ['cancelled', 'error', 'unavailable'].includes(String(search.checkout))
      ? String(search.checkout)
      : '',
  }),
  loader: () => getShop(),
  component: ProgramPage,
})

function ProgramPage() {
  const config = Route.useLoaderData()
  const { checkout } = Route.useSearch()
  const [busy, setBusy] = useState(false)
  return (
    <ShopLayout>
      <div className="container shop-breadcrumb">
        <a href="/">Coaching</a>
        <span>/</span>
        <span>The PDF program</span>
      </div>
      <section className="container product-grid">
        <div className="product-art" aria-label="69 easy PDF cover preview">
          <span className="eyebrow product-art-label">A little structure. Your own pace.</span>
          <div className="program-book">
            <span className="eyebrow book-brand">
              Steve Rossiter
              <br />
              Coaching
            </span>
            <div className="book-title">
              69
              <br />
              <span>easy</span>
            </div>
            <div className="book-rule" />
            <span className="book-subtitle">The PDF program</span>
            <div className="book-bottom">
              <span>{pdfProgram.isSample ? 'Sample edition' : 'Digital edition'}</span>
              <span>SR / 01</span>
            </div>
          </div>
          <div className="product-art-footer">
            <FileText size={16} />
            <span>Digital download</span>
            <span>PDF</span>
          </div>
        </div>
        <div className="product-copy">
          <span className="eyebrow">
            <span className="status-dot" /> The program collection / 01
          </span>
          <h1>
            {pdfProgram.name}
            <span className="product-title-dot">.</span>
          </h1>
          <p className="product-intro">
            A plan to keep.
            <br />A pace that’s yours.
          </p>
          <p className="product-description">
            A downloadable PDF from Steve Rossiter Coaching, ready to keep on your phone, tablet, or
            laptop. Open it whenever you’re ready to get started.
          </p>
          <ul className="product-benefits">
            <li>
              <Check size={17} /> One purchase, no subscription
            </li>
            <li>
              <Check size={17} /> Download after checkout
            </li>
            <li>
              <Check size={17} /> Buy as a guest, no account needed
            </li>
          </ul>
          <div className="product-price">
            <strong>{programPrice}</strong>
            <span>One-time payment</span>
          </div>
          {pdfProgram.isSample && (
            <div className="sample-note">
              <FileText size={19} />
              <p>
                <strong>Sample edition</strong>This preview contains a branded placeholder PDF. The
                full training program is coming.
              </p>
            </div>
          )}
          {checkout && (
            <p role="status" className="checkout-notice">
              {checkout === 'cancelled'
                ? 'Checkout was cancelled. You can return whenever you’re ready.'
                : checkout === 'unavailable'
                  ? 'Purchasing isn’t available just yet. Please check back soon.'
                  : 'We couldn’t open checkout. Please try again.'}
            </p>
          )}
          <form action="/api/checkout" method="post" onSubmit={() => setBusy(true)}>
            <button className="button product-buy" disabled={!config.enabled || busy}>
              {busy
                ? 'Opening secure checkout…'
                : config.enabled && config.testMode
                  ? `Try test checkout · ${programPrice}`
                  : `Buy PDF · ${programPrice}`}
              <ArrowUpRight size={19} />
            </button>
          </form>
          <p className="checkout-caption">
            {!config.enabled
              ? 'Purchasing opens soon. Explore the sample edition above.'
              : config.testMode
                ? 'Test checkout only. No real payment is collected.'
                : 'Your download will be ready after payment.'}
          </p>
          <div className="stripe-reassurance">
            <LockKeyhole size={14} />
            <span>
              Secure checkout with <strong>stripe</strong>
            </span>
          </div>
        </div>
      </section>
      <section className="shop-how">
        <div className="container">
          <div className="shop-section-heading">
            <span className="eyebrow">Simple from the start</span>
            <h2>From checkout to your device.</h2>
          </div>
          <div className="shop-steps">
            {[
              {
                icon: CreditCard,
                title: 'Make it yours',
                text: 'Check out securely through Stripe. No coaching account needed.',
              },
              {
                icon: Download,
                title: 'Get your PDF',
                text: 'Return to your confirmation page and download your copy.',
              },
              {
                icon: FileText,
                title: 'Keep it close',
                text: 'Save the PDF to your device so it’s there when you need it.',
              },
            ].map(({ icon: Icon, title, text }, i) => (
              <article key={title}>
                <div>
                  <Icon size={22} strokeWidth={1.5} />
                  <span className="eyebrow">0{i + 1}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="container program-coaching-note">
        <div>
          <span className="eyebrow">Looking for something personal?</span>
          <h2>Work directly with Steve.</h2>
          <p>
            This PDF is a standalone product. For a plan written around your goals and ongoing
            support, explore individual coaching.
          </p>
        </div>
        <a href="/#book" className="button button-outline">
          Let’s talk <ArrowUpRight size={17} />
        </a>
      </section>
    </ShopLayout>
  )
}
