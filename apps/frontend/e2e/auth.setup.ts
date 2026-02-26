import { test as setup, expect } from '@playwright/test'

const AUTH_FILE = 'e2e/.auth/user.json'

setup('authenticate', async ({ page }) => {
  // Navigate to login page
  await page.goto('/')

  // Wait for Supabase auth UI to load
  // Fill in test credentials from environment
  const email = process.env.E2E_USER_EMAIL
  const password = process.env.E2E_USER_PASSWORD

  if (!email || !password) {
    throw new Error(
      'E2E_USER_EMAIL and E2E_USER_PASSWORD environment variables are required for E2E tests'
    )
  }

  // Wait for the login form to appear
  await page.waitForSelector('input[type="email"]', { timeout: 10000 })

  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')

  // Wait for navigation after login
  await page.waitForURL(/\/(calendar|chat)/, { timeout: 15000 })

  // Save authentication state
  await page.context().storageState({ path: AUTH_FILE })
})
