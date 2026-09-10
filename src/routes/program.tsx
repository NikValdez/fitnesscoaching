import { createFileRoute, type SearchSchemaInput } from '@tanstack/react-router'
import { ArrowUpRight, Check, Download, FileText } from 'lucide-react'
import { ShopLayout, shopLinks } from '../components/shop-layout'
import { pdfProgram } from '../lib/product'
import programPdf from '../../output/pdf/69-easy-sample.pdf?url'

export const Route = createFileRoute('/program')({
  head: () => ({
    links: shopLinks,
    meta: [
      { title: '69 Easy — Free PDF plan | Steve Rossiter Coaching' },
      {
        name: 'description',
        content:
          'Explore 69 Easy, a free downloadable PDF plan from Steve Rossiter Coaching. No payment or account required.',
      },
    ],
  }),
  validateSearch: (search: { checkout?: unknown } & SearchSchemaInput) => ({
    checkout: ['cancelled', 'error', 'unavailable'].includes(String(search.checkout))
      ? String(search.checkout)
      : '',
  }),
  component: ProgramPage,
})

function ProgramPage() {
  return (
    <ShopLayout>
      <div className="container shop-breadcrumb">
        <a href="/">Coaching</a>
        <span>/</span>
        <span>The PDF program</span>
      </div>
      <section className="container product-grid">
        <div className="product-art" aria-label="69 Easy PDF cover preview">
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
              <span>Easy</span>
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
              <Check size={17} /> Free download, no subscription
            </li>
            <li>
              <Check size={17} /> Download directly to your device
            </li>
            <li>
              <Check size={17} /> No account needed
            </li>
          </ul>
          {pdfProgram.isSample && (
            <div className="sample-note">
              <FileText size={19} />
              <p>
                <strong>Sample edition</strong>This preview contains a branded placeholder PDF. The
                full training program is coming.
              </p>
            </div>
          )}
          <a
            className="button product-buy"
            href={programPdf}
            download={pdfProgram.isSample ? '69 Easy-sample.pdf' : '69 Easy.pdf'}
          >
            {pdfProgram.isSample ? 'Download the free sample' : 'Download 69 Easy free'}
            <Download size={19} />
          </a>
          <p className="checkout-caption">
            No payment or account required.
            {pdfProgram.isSample && ' The full 69 Easy plan is coming soon.'}
          </p>
        </div>
      </section>
      <section className="shop-how">
        <div className="container">
          <div className="shop-section-heading">
            <span className="eyebrow">Simple from the start</span>
            <h2>From this page to your device.</h2>
          </div>
          <div className="shop-steps">
            {[
              {
                icon: Download,
                title: 'Get your copy',
                text: 'Download the free PDF directly. No checkout or client account needed.',
              },
              {
                icon: Download,
                title: 'Open your PDF',
                text: 'Read it on your phone, tablet, or laptop.',
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
            In the Los Angeles area? Contact Steve about one-on-one, in-person coaching. He’ll get
            back to you about your goals and availability.
          </p>
        </div>
        <a href="/#book" className="button button-outline">
          Contact Steve <ArrowUpRight size={17} />
        </a>
      </section>
    </ShopLayout>
  )
}
