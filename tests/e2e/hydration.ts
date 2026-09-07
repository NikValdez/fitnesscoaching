import { expect, type Page } from '@playwright/test'

// Public hosting can finish SSR before the route's JavaScript arrives. Wait for
// React to attach event handlers before exercising interactive controls.
export async function waitForHydration(page: Page) {
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true')
}
