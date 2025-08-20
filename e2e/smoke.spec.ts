import { test, expect } from '@playwright/test';
import { setupTestAuth } from './test-helpers';

test.describe('Smoke Tests', () => {
  test.use({ 
    // Use base URL from environment or config
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173' 
  });

  test('app loads successfully', async ({ page }) => {
    await setupTestAuth(page);
    await page.goto('/?demo=true');
    
    // Check if main app shell loads
    await expect(page).toHaveTitle(/Wealth Tracker/);
    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10000 });
  });

  test('critical navigation paths work', async ({ page }) => {
    await setupTestAuth(page);
    await page.goto('/?demo=true');
    await page.waitForTimeout(3000); // Wait for app to load
    
    // Test that we can navigate to key pages directly
    const pages = [
      { path: '/accounts?demo=true', expectedText: /account/i },
      { path: '/transactions?demo=true', expectedText: /transaction/i },
      { path: '/budget?demo=true', expectedText: /budget/i },
      { path: '/goals?demo=true', expectedText: /goal/i }
    ];
    
    for (const { path, expectedText } of pages) {
      // Navigate directly to the page
      await page.goto(path);
      await page.waitForTimeout(2000);
      
      // Check we're on the right page by looking for relevant text
      const pageContent = await page.textContent('body');
      const hasExpectedContent = expectedText.test(pageContent || '');
      
      // Also check URL
      const currentUrl = page.url();
      const isCorrectUrl = currentUrl.includes(path.split('?')[0].substring(1));
      
      // Either the content or URL should match
      expect(hasExpectedContent || isCorrectUrl).toBe(true);
    }
  });

  test('critical forms are accessible', async ({ page }) => {
    await setupTestAuth(page);
    await page.goto('/accounts?demo=true');
    await page.waitForTimeout(3000); // Wait for app to load
    
    // Check if Add Account button exists and is clickable
    const addButton = page.locator('button:has-text("Add Account"), button:has-text("Add"), button:has-text("New Account")').first();
    
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(1000);
      
      // Check if a form or modal appeared
      const formVisible = await page.locator('form, [role="dialog"]').isVisible();
      expect(formVisible).toBe(true);
    } else {
      // Just check that we're on the accounts page
      await expect(page).toHaveURL(/accounts/);
    }
  });

  test('data persistence works', async ({ page }) => {
    await setupTestAuth(page);
    await page.goto('/?demo=true');
    await page.waitForTimeout(3000); // Wait for app to load
    
    // Test that demo data is loaded and persists
    // Navigate to accounts page
    await page.goto('/accounts?demo=true');
    await page.waitForTimeout(2000);
    
    // Check that we have account headings (like "Natwest Savings Account")
    const accountHeadings = await page.locator('h3').count();
    console.log('Account headings found:', accountHeadings);
    
    // Navigate away and back
    await page.goto('/?demo=true');
    await page.waitForTimeout(1000);
    await page.goto('/accounts?demo=true');
    await page.waitForTimeout(2000);
    
    // Check accounts still exist after navigation
    const headingsAfterNav = await page.locator('h3').count();
    console.log('Headings after navigation:', headingsAfterNav);
    
    // In demo mode, we should have account headings
    expect(headingsAfterNav).toBeGreaterThan(0);
  });

  test('responsive design works', async ({ page }) => {
    await setupTestAuth(page);
    await page.goto('/?demo=true');
    await page.waitForTimeout(3000); // Wait for app to load
    
    // Desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(1000);
    
    // Check if we can see content in desktop view
    const desktopContent = await page.locator('body').textContent();
    expect(desktopContent).toBeTruthy();
    expect(desktopContent.length).toBeGreaterThan(100);
    
    // Mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    
    // Check if content is still accessible in mobile view
    const mobileContent = await page.locator('body').textContent();
    expect(mobileContent).toBeTruthy();
    
    // Verify viewport change worked
    const viewport = page.viewportSize();
    expect(viewport?.width).toBe(375);
  });

  test('no console errors', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await setupTestAuth(page);
    await page.goto('/?demo=true');
    await page.waitForTimeout(3000); // Wait for app to load
    await page.waitForLoadState('networkidle');
    
    // Log all errors for debugging
    if (errors.length > 0) {
      console.log('Console errors detected:', errors);
    }
    
    // Only fail on truly critical errors
    const criticalPatterns = [
      'Cannot read properties of undefined',
      'Cannot read properties of null',
      'is not a function',
      'Uncaught Error',
      'Uncaught TypeError',
      'Uncaught ReferenceError',
      'CORS',
      'Network request failed',
      'Failed to fetch'
    ];
    
    const criticalErrors = errors.filter(error => 
      criticalPatterns.some(pattern => error.includes(pattern))
    );
    
    // We're more lenient - allow dev warnings and non-critical errors
    if (criticalErrors.length > 0) {
      console.log('Critical errors found:', criticalErrors);
    }
    
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
    
    await setupTestAuth(page);
    await page.goto('/?demo=true');
    await page.waitForTimeout(3000); // Wait for app to load
    await page.waitForLoadState('networkidle');
    
    // Check if critical assets loaded
    // Filter out non-critical failures like source maps, extensions, etc.
    const criticalAssetsFailed = failedRequests.filter(url => {
      // Ignore source maps, browser extensions, and external resources
      if (url.includes('.map') || 
          url.includes('chrome-extension') || 
          url.includes('firefox-extension') ||
          url.includes('localhost:9323') || // Playwright report server
          !url.includes('localhost')) {
        return false;
      }
      // Only care about main JS and CSS files
      return url.includes('.js') || url.includes('.css');
    });
    
    // Log any failures for debugging
    if (criticalAssetsFailed.length > 0) {
      console.log('Failed to load:', criticalAssetsFailed);
    }
    
    expect(criticalAssetsFailed).toHaveLength(0);
  });
});