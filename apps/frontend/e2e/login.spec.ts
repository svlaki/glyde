import { test, expect } from '@playwright/test'

test.describe('Login Flow', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('shows login page when not authenticated', async ({ page }) => {
    await page.goto('/')
    // Should see login form or redirect to auth
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('input[type="email"]', { timeout: 10000 })

    await page.fill('input[type="email"]', 'invalid@example.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    // Should show an error message
    await expect(page.locator('text=/invalid|error|incorrect/i')).toBeVisible({ timeout: 5000 })
  })
})
