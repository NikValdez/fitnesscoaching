import { Link } from '@tanstack/react-router'
import { ArrowUpRight, Menu, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Brand } from './brand'
import { SocialLinks } from './social-links'

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Brand tagline />
        <nav className={menuOpen ? 'main-nav is-open' : 'main-nav'} aria-label="Main navigation">
          <Link to="/" activeOptions={{ exact: true }} onClick={closeMenu}>
            Home
          </Link>
          <Link to="/69-easy" onClick={closeMenu}>
            69 easy
          </Link>
          <Link to="/blog" onClick={closeMenu}>
            Blog
          </Link>
          <Link to="/work-with-me" className="nav-work-link" onClick={closeMenu}>
            Work With Me <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
          <SocialLinks className="header-social" onClick={closeMenu} />
        </nav>
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
  )
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <Brand />
        <span className="eyebrow">One-on-one coaching in Los Angeles</span>
        <SocialLinks className="footer-social" />
        <div className="footer-links">
          <Link to="/">Home</Link>
          <Link to="/69-easy">69 easy</Link>
          <Link to="/blog">Blog</Link>
          <Link to="/work-with-me">Work With Me</Link>
          <Link to="/privacy">Privacy</Link>
          <span>© 2026 Steve Rossiter Coaching</span>
        </div>
      </div>
    </footer>
  )
}

export function SiteLayout({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </div>
  )
}
