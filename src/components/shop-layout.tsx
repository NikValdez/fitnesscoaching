import type { ReactNode } from 'react'
import { SiteLayout } from './site-layout'
import shopStyles from '../shop.css?url'

export const shopLinks = [{ rel: 'stylesheet', href: shopStyles }]

export function ShopLayout({ children }: { children: ReactNode }) {
  return <SiteLayout className="shop-page">{children}</SiteLayout>
}
