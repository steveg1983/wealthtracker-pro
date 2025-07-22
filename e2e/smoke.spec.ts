import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test.use({ 
    // Use base URL from environment or config
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173' 
  });

  test('app loads successfully', async ({ page }) => {
    await page.goto('/');
    
    // Check if main app shell loads
    await expect(page).toHaveTitle(/WealthTracker/);
    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10000 });
  });

  test('critical navigation paths work', async ({ page }) => {
    await page.goto('/');
    
    // Test main navigation items
    const navItems = ['Dashboard', 'Accounts', 'Transactions', 'Budget', 'Goals'];
    
    for (const item of navItems) {
      await page.click(`text=${item}`);
      await page.waitForLoadState('networkidle');
      
      // Verify we're on the right page
      if (item === 'Dashboard') {
        await expect(page.locator('text=/Net Worth/i')).toBeVisible();
      } else {
        await expect(page.locator(`text=/Add ${item.slice(0, -1)}/i`)).toBeVisible();
      }
    }
  });

  test('critical forms are accessible', async ({ page }) => {
    await page.goto('/accounts');
    
    // Check if Add Account button works
    await page.click('text=Add Account');
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('data persistence works', async ({ page }) => {
    await page.goto('/');
    
    // Create a test entry
    await page.goto('/accounts');
    await page.click('text=Add Account');
    await page.fill('input[name="name"]', 'Smoke Test Account');
    await page.fill('input[name="balance"]', '1000');
    await page.click('button[type="submit"]');
    
    // Reload page
    await page.reload();
    
    // Verify data persists
    await expect(page.locator('text=Smoke Test Account')).toBeVisible();
  });

  test('responsive design works', async ({ page }) => {
    await page.goto('/');
    
    // Desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('text=Dashboard')).toBeVisible();
    
    // Mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    // Check if mobile menu appears
    const menuButton = page.locator('button[aria-label*="menu" i]');
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await expect(page.locator('text=Dashboard')).toBeVisible();
    }
  });

  test('no console errors', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Allow some specific errors that are acceptable
    const acceptableErrors = [
      'ResizeObserver', // Common benign error
      'Non-Error promise rejection', // Often from third-party scripts
    ];
    
    const criticalErrors = errors.filter(error => 
      !acceptableErrors.some(acceptable => error.includes(acceptable))
    );
    
    expect(criticalErrors).toHaveLength(0);
  });

  test('API endpoints are accessible', async ({ request }) => {
    // If your app has API endpoints, test them
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
    
    // Test health check endpoint if available
    const healthResponse = await request.get(`${baseUrl}/api/health`).catch(() => null);
    if (healthResponse) {
      expect(healthResponse.ok()).toBeTruthy();
    }
  });

  test('critical assets load', async ({ page }) => {
    const failedRequests: string[] = [];
    
    page.on('requestfailed', request => {
      failedRequests.push(request.url());
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check if critical assets loaded
    const criticalAssetsFailed = failedRequests.filter(url => 
      url.includes('.js') || url.includes('.css')
    );
    
    expect(criticalAssetsFailed).toHaveLength(0);
  });
});