import { test, expect } from '@playwright/test'

test('keywords, articles, and local data flows stay usable', async ({ page }) => {
  await page.goto('/keywords')
  await page.getByTestId('keywords.quick-input').fill('industrial router')
  await page.getByTestId('keywords.create-button').click()
  await expect(page.locator('[data-testid^="keywords.row."]')).toHaveCount(1)

  await page.goto('/articles')
  await page.getByTestId('articles.quick-input').fill('Industrial Router Guide')
  await page.getByTestId('articles.create-button').click()
  await expect(page.locator('[data-testid^="articles.row."]')).toHaveCount(1)

  await page.goto('/local-data')
  await page.getByTestId('local-data.backup-button').click()
  await expect(page.locator('.alert-success')).toBeVisible()
})
