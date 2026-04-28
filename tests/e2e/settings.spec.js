import { test, expect } from '@playwright/test'

test('settings page supports provider switching', async ({ page }) => {
  await page.goto('/settings')
  await page.getByRole('button', { name: 'OpenAI' }).click()
  await page.getByTestId('settings-save').click()
  await expect(page.getByTestId('settings-save-success')).toContainText(/Settings saved\.|配置已保存。/)
  await page.reload()
  await expect(page.getByRole('button', { name: 'OpenAI' })).toHaveClass(/active/)
})
