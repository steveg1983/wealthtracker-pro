import { test, expect } from '@playwright/test';

test.describe('Example Test Suite', () => {
  test('should load the homepage', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Check if the page title is correct
    await expect(page).toHaveTitle(/Wealth Tracker/);
    
    // Look for a specific element
    await expect(page.locator('h1')).toContainText('Welcome');
  });

  test('should navigate to transactions page', async ({ page }) => {
    await page.goto('/');
    
    // Click on the Transactions link
    await page.click('text=Transactions');
    
    // Wait for navigation and check URL
    await expect(page).toHaveURL('/transactions');
    
    // Verify page content
    await expect(page.locator('h1')).toContainText('Transactions');
  });

  test('should add a new transaction', async ({ page }) => {
    await page.goto('/transactions');
    
    // Click Add Transaction button
    await page.click('button:has-text("Add Transaction")');
    
    // Fill in the form
    await page.fill('input[name="description"]', 'Coffee');
    await page.fill('input[name="amount"]', '4.50');
    await page.selectOption('select[name="category"]', 'Food & Dining');
    
    // Submit the form
    await page.click('button[type="submit"]');
    
    // Verify the transaction appears in the list
    await expect(page.locator('text=Coffee')).toBeVisible();
  });
});