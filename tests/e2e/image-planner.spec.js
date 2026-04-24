import { test, expect } from '@playwright/test';

test('image planner page opens as a separate page', async ({ page }) => {
  await page.goto('/articles/image-planner');
  await expect(page.locator('#page-image-planner')).toBeVisible();
  await expect(page.locator('#page-image-planner .btn-primary')).toBeVisible();
});
