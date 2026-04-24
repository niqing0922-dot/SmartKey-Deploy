import { test, expect } from '@playwright/test';

test('geo writer page opens without blank screen', async ({ page }) => {
  await page.goto('/articles/geo-writer');
  await expect(page.locator('#page-aiwrite')).toBeVisible();
  await expect(page.locator('#btn-aw')).toBeVisible();
  await expect(page.locator('#aw-output')).toBeVisible();
});
