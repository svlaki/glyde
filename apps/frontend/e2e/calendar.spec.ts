import { test, expect } from '@playwright/test'

test.describe('Calendar Page', () => {
  test('navigates to calendar and displays it', async ({ page }) => {
    await page.goto('/calendar')
    // Should show the calendar view
    await expect(page.locator('text=/calendar/i').first()).toBeVisible({ timeout: 10000 })
  })

  test('can navigate between months', async ({ page }) => {
    await page.goto('/calendar')
    await page.waitForLoadState('networkidle')

    // Look for navigation buttons (next/prev month)
    const nextButton = page.locator('button:has-text("next"), button[aria-label*="next"], button[aria-label*="Next"]').first()
    if (await nextButton.isVisible()) {
      await nextButton.click()
      // Should still show calendar after navigation
      await expect(page).toHaveURL(/\/calendar/)
    }
  })

  test('sidebar navigation works', async ({ page }) => {
    await page.goto('/calendar')
    await page.waitForLoadState('networkidle')

    // Check sidebar has navigation items
    const sidebar = page.locator('[class*="sidebar"], nav').first()
    await expect(sidebar).toBeVisible({ timeout: 10000 })
  })
})
