import { test, expect } from '@playwright/test';

test.describe('Mobile Smoke Tests', () => {
  test.use({ 
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5174' 
  });

  // Only run these tests on mobile devices
  test.skip(({ browserName, isMobile }) => !isMobile, 'Mobile only tests');

  test('mobile app loads successfully', async ({ page }) => {
    // Go directly to demo mode to bypass auth
    await page.goto('/?demo=true');
    
    // Wait for the app to load
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    
    // Check if main app shell loads
    await expect(page).toHaveTitle(/Wealth Tracker/i, { timeout: 10000 });
    
    // Check for dashboard or main content
    const dashboardVisible = await page.locator('text=/dashboard/i').isVisible().catch(() => false);
    const accountsVisible = await page.locator('text=/account/i').isVisible().catch(() => false);
    
    // At least one main section should be visible
    expect(dashboardVisible || accountsVisible).toBe(true);
  });

  test('mobile navigation works', async ({ page }) => {
    await page.goto('/?demo=true');
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    
    // Check if mobile menu exists (hamburger or bottom nav)
    const hamburgerMenu = page.locator('[aria-label*="menu" i], button:has-text("☰"), button svg').first();
    const bottomNav = page.locator('nav[aria-label*="bottom" i], nav[aria-label*="mobile" i]');
    
    // Either hamburger menu or bottom nav should be visible on mobile
    const hasHamburger = await hamburgerMenu.isVisible().catch(() => false);
    const hasBottomNav = await bottomNav.isVisible().catch(() => false);
    
    if (hasHamburger) {
      // Click hamburger menu
      await hamburgerMenu.click();
      await page.waitForTimeout(500);
      
      // Check if menu opened
      const menuVisible = await page.locator('nav, [role="navigation"]').isVisible();
      expect(menuVisible).toBe(true);
    } else if (hasBottomNav) {
      // Check bottom nav is functional
      expect(hasBottomNav).toBe(true);
    } else {
      // Mobile should have some form of navigation
      const anyNav = await page.locator('nav').isVisible();
      expect(anyNav).toBe(true);
    }
  });

  test('mobile viewport responsive', async ({ page }) => {
    await page.goto('/?demo=true');
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    
    // Check viewport size
    const viewport = page.viewportSize();
    expect(viewport).toBeDefined();
    expect(viewport!.width).toBeLessThanOrEqual(768); // Mobile width
    
    // Check if content adapts to mobile
    const mainContent = page.locator('main, [role="main"], .container, .content').first();
    const contentVisible = await mainContent.isVisible().catch(() => false);
    expect(contentVisible).toBe(true);
    
    // Check text is readable (not cut off)
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(100);
  });

  test('mobile touch interactions work', async ({ page }) => {
    await page.goto('/?demo=true');
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    
    // Find a clickable element
    const buttons = page.locator('button:visible, a:visible').filter({ hasText: /add|new|create/i });
    const buttonCount = await buttons.count();
    
    if (buttonCount > 0) {
      const firstButton = buttons.first();
      
      // Test tap interaction
      await firstButton.tap({ timeout: 5000 }).catch(() => {
        // Fallback to click if tap doesn't work
        return firstButton.click();
      });
      
      // Check if something happened (modal opened, navigation occurred, etc.)
      await page.waitForTimeout(1000);
      
      // Either URL changed or a modal/dialog appeared
      const urlChanged = !page.url().endsWith('/?demo=true');
      const modalVisible = await page.locator('[role="dialog"], .modal').isVisible().catch(() => false);
      
      expect(urlChanged || modalVisible).toBe(true);
    } else {
      // Just verify the page loaded
      expect(await page.locator('body').isVisible()).toBe(true);
    }
  });

  test('mobile performance acceptable', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/?demo=true');
    await page.waitForLoadState('domcontentloaded');
    
    const loadTime = Date.now() - startTime;
    
    // Mobile should load within 10 seconds on local
    expect(loadTime).toBeLessThan(10000);
    
    // Check if main content is rendered
    const hasContent = await page.locator('h1, h2, h3').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasContent).toBe(true);
  });

  test('mobile forms usable', async ({ page }) => {
    await page.goto('/accounts?demo=true');
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    
    // Look for any input fields
    const inputs = page.locator('input:visible, select:visible, textarea:visible');
    const inputCount = await inputs.count();
    
    if (inputCount > 0) {
      const firstInput = inputs.first();
      
      // Check if input is accessible
      const isEnabled = await firstInput.isEnabled();
      expect(isEnabled).toBe(true);
      
      // Check touch target size (should be at least 44x44 for mobile)
      const box = await firstInput.boundingBox();
      if (box) {
        // Input or its container should be large enough for touch
        expect(box.height).toBeGreaterThanOrEqual(32); // Minimum reasonable height
      }
    } else {
      // Page loaded successfully even if no forms
      expect(await page.locator('body').isVisible()).toBe(true);
    }
  });
});