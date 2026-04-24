import { test, expect } from '@playwright/test'

test('app opens directly to dashboard and primary nav works', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.page-title')).toBeVisible()
  await expect(page.getByTestId('shell.sidebar')).toBeVisible()

  await page.getByTestId('nav.keywords').click()
  await expect(page.getByTestId('keywords.create-button')).toBeVisible()

  await page.getByTestId('nav.articles').click()
  await expect(page.getByTestId('articles.create-button')).toBeVisible()

  await page.getByTestId('nav.articles.geo-writer').click()
  await expect(page.getByTestId('geo.generate-button')).toBeVisible()
})
