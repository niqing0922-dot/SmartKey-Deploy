import { test, expect } from '@playwright/test';

test('image planner switches between zh and en', async ({ page }) => {
  await page.goto('/articles/image-planner');
  const langOptions = page.locator('.lang-opt');
  await expect(langOptions).toHaveCount(2);
  await langOptions.nth(1).click();
  await expect(page.locator('.page-title')).toHaveText('Image Planner');
  await expect(page.locator('button.btn-primary')).toHaveText('Analyze Image Placements');
  await langOptions.nth(0).click();
  await expect(page.locator('.page-title')).not.toHaveText('Image Planner');
});
