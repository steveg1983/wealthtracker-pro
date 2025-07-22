import { test, expect } from '@playwright/test';

test('Reports page initialization test', async ({ page }) => {
  // First go to home page
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  // Take screenshot of home page
  await page.screenshot({ path: 'home-page.png' });
  
  // Now navigate to reports
  await page.goto('/reports');
  await page.waitForLoadState('networkidle');
  
  // Wait a bit more for any lazy loading
  await page.waitForTimeout(3000);
  
  // Take screenshot
  await page.screenshot({ path: 'reports-page.png' });
  
  // Check if there's any content on the page
  const bodyText = await page.locator('body').textContent();
  console.log('Body text content:', bodyText);
  
  // Check for any error messages
  const errorMessages = await page.locator('text=/error|Error|failed|Failed/i').all();
  console.log('Error messages found:', errorMessages.length);
  
  // Check page title
  const title = await page.title();
  console.log('Page title:', title);
  
  // Check if React app is mounted
  const reactRoot = await page.locator('#root, .app, [data-reactroot]').count();
  console.log('React root elements:', reactRoot);
  
  // Basic assertion - the page should have some content
  expect(bodyText).not.toBe('');
});