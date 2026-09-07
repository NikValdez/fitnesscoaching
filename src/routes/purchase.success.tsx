import { createFileRoute, Link, useRouter, type SearchSchemaInput } from '@tanstack/react-router'
import { useState } from 'react'
import { Check, Download, RotateCw, FileText } from 'lucide-react'
import { ShopLayout, shopLinks } from '../components/shop-layout'
import { getPurchase } from '../lib/shop'
import { pdfProgram } from '../lib/product'

export const Route = createFileRoute('/purchase/success')({
  head: () => ({
    links: shopLinks,
    meta: [
      { title: 'Your PDF download — Steve Rossiter Coaching' },
      { name: 'robots', content: 'noindex, nofollow' },
      { name: 'referrer', content: 'no-referrer' },
    ],
  }),
  headers: () => ({ 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }),
  validateSearch: (search: { session_id?: unknown } & SearchSchemaInput) => ({
    session_id: typeof search.session_id === 'string' ? search.session_id.slice(0, 255) : '',
  }),
  loaderDeps: ({ search }) => ({ sessionId: search.session_id }),
  loader: ({ deps }) => getPurchase({ data: deps }),
  component: PurchasePage,
})

function PurchasePage() {
  const { status, testMode } = Route.useLoaderData()
  const { session_id } = Route.useSearch()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const paid = status === 'paid'
  return (
    <ShopLayout>
      <section className="container purchase-page">
        <div className="purchase-card">
          <div className="purchase-icon">{paid ? <Check size={30} /> : <FileText size={30} />}</div>
          <span className="eyebrow">
            {paid
              ? testMode
                ? 'Test purchase confirmed'
                : 'Payment confirmed'
              : 'Purchase confirmation'}
          </span>
          <h1>
            {paid
              ? 'Your next chapter is ready.'
              : status === 'invalid'
                ? 'Let’s find your purchase.'
                : 'Checking your payment.'}
          </h1>
          <p>
            {paid
              ? `Your copy of ${pdfProgram.name} is ready to download. Save it to your device and keep this page bookmarked for your records.`
              : status === 'invalid'
                ? 'Open the confirmation link you received after Stripe checkout to access your PDF.'
                : 'We haven’t confirmed a completed payment yet. If you just finished checkout, wait a moment and check again.'}
          </p>
          {paid ? (
            <>
              <div className="purchase-item">
                <FileText size={25} />
                <div>
                  <strong>{pdfProgram.name}</strong>
                  <span>PDF download{pdfProgram.isSample ? ' · Sample edition' : ''}</span>
                </div>
                <Check size={18} />
              </div>
              <a
                className="button product-buy"
                href={`/api/program/download?session_id=${encodeURIComponent(session_id)}`}
                referrerPolicy="no-referrer"
              >
                <Download size={18} /> Download your PDF
              </a>
              {testMode && (
                <p className="checkout-caption">
                  This was a test purchase. No real payment was collected.
                </p>
              )}
            </>
          ) : (
            session_id && (
              <button
                className="button product-buy"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    await router.invalidate({ sync: true })
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                <RotateCw size={17} />
                {busy ? 'Checking…' : 'Check payment again'}
              </button>
            )
          )}
          <Link to="/program" className="text-link">
            Back to the program
          </Link>
          <p className="purchase-help">
            Need a hand? <a href="/#book">Get in touch with Steve.</a>
          </p>
        </div>
      </section>
    </ShopLayout>
  )
}
