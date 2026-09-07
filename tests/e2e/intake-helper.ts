import { expect, type Page } from '@playwright/test'

export async function completeBasicIntake(page: Page) {
  await page.goto('/onboarding')
  await page.getByRole('checkbox', { name: 'Fitness coaching', exact: true }).check()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('radio', { name: 'Fitness coaching: Essential', exact: true }).check()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Email', exact: true }).check()
  await page.getByRole('button', { name: 'Save & open my portal', exact: true }).click()
  await expect(page).toHaveURL(/\/portal/)
}
