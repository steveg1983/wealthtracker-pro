import { test, expect } from '@playwright/test';
import { setupTestAuth } from './test-helpers';

test.describe('Basic Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupTestAuth(page);
    await page.goto('/?demo=true');
  });

  test('app loads successfully', async ({ page }) => {
    // Check if app loads with correct title
    await expect(page).toHaveTitle(/Wealth Tracker/);
    
    // Check if the main content area is visible
    await expect(page.locator('main')).toBeVisible();
    
    // Check for the sidebar on desktop
    const sidebar = page.locator('aside');
    const viewportSize = page.viewportSize();
    
    if (viewportSize && viewportSize.width >= 768) {
      // Desktop view - sidebar should be visible
      await expect(sidebar).toBeVisible();
      
      // Check main navigation items in sidebar
      await expect(page.getByText('Home')).toBeVisible();
      await expect(page.getByText('Dashboard')).toBeVisible();
      await expect(page.getByText('Accounts')).toBeVisible();
      await expect(page.getByText('Investments')).toBeVisible();
    } else {
      // Mobile view - check for menu button
      await expect(page.locator('button[aria-label="Menu"]')).toBeVisible();
    }
  });

  test('navigate to dashboard', async ({ page }) => {
    // Click on Dashboard link
    await page.click('text=Dashboard');
    
    // Wait for navigation
    await page.waitForURL('**/dashboard');
    
    // Check if dashboard content is visible
    await expect(page.getByText('Net Worth', { exact: true }).first()).toBeVisible();
  });

  test('navigate to accounts', async ({ page }) => {
    // Click on Accounts link
    await page.click('text=Accounts');
    
    // Wait for navigation
    await page.waitForURL('**/accounts');
    
    // Check if accounts page is loaded
    await expect(page.locator('h1', { hasText: 'Accounts' })).toBeVisible();
  });

  test('mobile menu toggle', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
    }
    
    // Click menu button
    const menuButton = page.locator('button').filter({ hasText: /menu/i }).or(page.locator('button[aria-label="Menu"]'));
    await menuButton.click();
    
    // Check if mobile menu is visible
    await expect(page.getByText('Home')).toBeVisible();
    await expect(page.getByText('Dashboard')).toBeVisible();
    
    // Close menu
    await menuButton.click();
    
    // Menu should be hidden
    await expect(page.getByText('Home')).not.toBeVisible();
  });
});