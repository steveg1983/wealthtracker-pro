import { Page } from '@playwright/test';

/**
 * Helper to bypass authentication for testing
 * This sets up the page to appear authenticated to the app
 */
export async function setupTestAuth(page: Page) {
  // Add a flag that the app can check to bypass auth in test mode
  await page.addInitScript(() => {
    // Set a flag that indicates we're in test mode
    window.localStorage.setItem('isTestMode', 'true');
    
    // Mock Clerk's authentication state
    (window as any).__clerk_test_mode = true;
  });
}

/**
 * Navigate directly to a protected route for testing
 * This assumes the app has test mode detection
 */
export async function navigateToProtectedRoute(page: Page, path: string) {
  // First set up test auth
  await setupTestAuth(page);
  
  // Then navigate
  await page.goto(`http://localhost:5174${path}`);
  
  // Wait for the page to be ready
  await page.waitForLoadState('networkidle');
}