import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowUpRight,
  Clapperboard,
  Film,
  Library,
  Lightbulb,
  LogOut,
  ShieldCheck,
} from 'lucide-react'
import { Brand } from './brand'
import { Notice } from './workspace'
import { authClient } from '../lib/auth-client'

export function AdminWorkspace({
  name,
  current,
  children,
}: {
  name: string
  current: 'content' | 'ideas' | 'library' | 'media'
  children: ReactNode
}) {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  return (
    <div className="admin-workspace">
      <header className="admin-header">
        <Brand />
        <span className="admin-access">
          <ShieldCheck size={14} /> Admin workspace
        </span>
        <div className="admin-header-links">
          <Link to="/coach">
            Coach workspace <ArrowUpRight size={14} />
          </Link>
          <Link to="/">
            Website <ArrowUpRight size={14} />
          </Link>
          <span className="admin-avatar" title={name}>
            {name
              .split(' ')
              .filter(Boolean)
              .map((word) => word[0])
              .slice(0, 2)
              .join('')}
          </span>
          <button
            className="icon-button"
            aria-label="Sign out"
            onClick={async () => {
              try {
                const result = await authClient.signOut()
                if (result.error) throw new Error()
                await navigate({ to: '/admin/login' })
              } catch {
                setError('Could not sign out. Please try again.')
              }
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <div className="admin-container">
        <div className="admin-navigation">
          <span className="eyebrow">Steve Rossiter / Content Studio</span>
          <nav aria-label="Content Studio navigation">
            <Link
              to="/admin/content"
              className={current === 'content' ? 'active' : ''}
              aria-current={current === 'content' ? 'page' : undefined}
            >
              <Clapperboard size={17} /> Production board
            </Link>
            <Link
              to="/admin/ideas"
              className={current === 'ideas' ? 'active' : ''}
              aria-current={current === 'ideas' ? 'page' : undefined}
            >
              <Lightbulb size={17} /> Ideas
            </Link>
            <Link
              to="/admin/library"
              className={current === 'library' ? 'active' : ''}
              aria-current={current === 'library' ? 'page' : undefined}
            >
              <Library size={17} /> Content library
            </Link>
            <Link
              to="/admin/media"
              className={current === 'media' ? 'active' : ''}
              aria-current={current === 'media' ? 'page' : undefined}
            >
              <Film size={17} /> Shared media
            </Link>
          </nav>
        </div>
        <main id="main">
          {error && <Notice error message={error} onClose={() => setError('')} />}
          {children}
        </main>
      </div>
    </div>
  )
}
