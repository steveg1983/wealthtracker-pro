import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

/**
 * Authentication setup for Playwright tests
 * This runs once before all tests to log in a test user
 * 
 * For this to work, you need to:
 * 1. Create a test user in Clerk dashboard
 * 2. Set TEST_USER_EMAIL and TEST_USER_PASSWORD in .env.local
 */
setup('authenticate', async ({ page }) => {
  // Check if we have test credentials
  const testEmail = process.env.TEST_USER_EMAIL;
  const testPassword = process.env.TEST_USER_PASSWORD;
  
  if (!testEmail || !testPassword) {
    console.warn('⚠️  No test credentials found. Tests will run unauthenticated.');
    console.warn('   Set TEST_USER_EMAIL and TEST_USER_PASSWORD in .env.local');
    return;
  }

  // Go to the app
  await page.goto('http://localhost:5174');
  
  // Click sign in button
  await page.click('text=Sign In');
  
  // Wait for Clerk's sign-in form
  await page.waitForSelector('input[name="identifier"]', { timeout: 10000 });
  
  // Enter email
  await page.fill('input[name="identifier"]', testEmail);
  await page.click('button:has-text("Continue")');
  
  // Enter password
  await page.waitForSelector('input[name="password"]', { timeout: 5000 });
  await page.fill('input[name="password"]', testPassword);
  await page.click('button:has-text("Continue")');
  
  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  
  // Save authentication state
  await page.context().storageState({ path: authFile });
  
  console.log('✅ Authentication successful');
});