import { test, expect } from '@playwright/test'

test('language switch updates recommend flow and persists across routes', async ({ page }) => {
  await page.goto('/keywords/recommend')

  await page.getByTestId('language.en').click()
  await expect(page.locator('.page-title')).toHaveText('Keyword Recommendations')
  await expect(page.getByTestId('nav.keywords.recommend')).toHaveClass(/active/)

  await page.goto('/articles/image-planner')
  await expect(page.locator('.page-title')).toHaveText('Image Planner')
  await page.reload()
  await expect(page.locator('.page-title')).toHaveText('Image Planner')

  await page.getByTestId('language.zh').click()
  await expect(page.locator('.page-title')).not.toHaveText('Image Planner')
})
