import { Link } from '@tanstack/react-router'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Brand } from './brand'
import shopStyles from '../shop.css?url'

export const shopLinks = [{ rel: 'stylesheet', href: shopStyles }]

export function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <div className="shop-page">
      <header className="site-header">
        <div className="container shop-header">
          <Brand />
          <Link to="/" className="text-link">
            <ArrowLeft size={15} /> Back to coaching
          </Link>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="site-footer">
        <div className="container shop-footer">
          <Brand />
          <span className="eyebrow">One-on-one coaching in Los Angeles</span>
          <Link to="/privacy" className="text-link">
            Privacy
          </Link>
          <a className="text-link" href="/#book">
            Talk to Steve <ArrowUpRight size={15} />
          </a>
        </div>
      </footer>
    </div>
  )
}
