import { test, expect } from '@playwright/test';

test.describe('Performance E2E Tests', () => {
  test('app loads within acceptable time', async ({ page }) => {
    // Start measuring
    const startTime = Date.now();
    
    // Navigate to app
    await page.goto('/');
    
    // Wait for main content to be visible
    await page.waitForSelector('text=Dashboard', { timeout: 5000 });
    
    const loadTime = Date.now() - startTime;
    
    // App should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('handles large datasets efficiently', async ({ page }) => {
    await page.goto('/');
    
    // Create multiple accounts
    await page.click('text=Accounts');
    
    const startTime = Date.now();
    
    // Create 20 accounts
    for (let i = 1; i <= 20; i++) {
      await page.click('text=Add Account');
      await page.fill('input[name="name"]', `Test Account ${i}`);
      await page.fill('input[name="balance"]', `${1000 * i}`);
      await page.selectOption('select[name="type"]', i % 2 === 0 ? 'savings' : 'checking');
      await page.click('button[type="submit"]');
    }
    
    const creationTime = Date.now() - startTime;
    
    // Should handle 20 accounts creation within 30 seconds
    expect(creationTime).toBeLessThan(30000);
    
    // Navigate to dashboard
    await page.click('text=Dashboard');
    
    // Dashboard should load quickly even with many accounts
    const dashboardStartTime = Date.now();
    await page.waitForSelector('text=Net Worth');
    const dashboardLoadTime = Date.now() - dashboardStartTime;
    
    expect(dashboardLoadTime).toBeLessThan(2000);
  });

  test('search and filter performance', async ({ page }) => {
    await page.goto('/');
    
    // Create account first
    await page.click('text=Accounts');
    await page.click('text=Add Account');
    await page.fill('input[name="name"]', 'Performance Test Account');
    await page.fill('input[name="balance"]', '10000');
    await page.click('button[type="submit"]');
    
    // Create many transactions
    await page.click('text=Transactions');
    
    // Create 50 transactions
    for (let i = 1; i <= 50; i++) {
      await page.click('text=Add Transaction');
      await page.fill('input[name="description"]', `Transaction ${i}`);
      await page.fill('input[name="amount"]', `${10 + i}`);
      await page.selectOption('select[name="type"]', i % 2 === 0 ? 'income' : 'expense');
      await page.click('button[type="submit"]');
    }
    
    // Test search performance
    const searchStartTime = Date.now();
    await page.fill('input[placeholder*="Search"]', 'Transaction 25');
    
    // Wait for filtered results
    await page.waitForSelector('text=Transaction 25');
    const searchTime = Date.now() - searchStartTime;
    
    // Search should be responsive (under 500ms)
    expect(searchTime).toBeLessThan(500);
  });

  test('chart rendering performance', async ({ page }) => {
    await page.goto('/');
    
    // Create data for charts
    await page.click('text=Accounts');
    
    // Create diverse accounts for pie chart
    const accountTypes = ['checking', 'savings', 'credit', 'investment'];
    for (let i = 0; i < accountTypes.length; i++) {
      await page.click('text=Add Account');
      await page.fill('input[name="name"]', `${accountTypes[i]} Account`);
      await page.fill('input[name="balance"]', `${(i + 1) * 2500}`);
      await page.selectOption('select[name="type"]', accountTypes[i]);
      await page.click('button[type="submit"]');
    }
    
    // Navigate to page with charts (Dashboard or Analytics)
    await page.click('text=Dashboard');
    
    const chartStartTime = Date.now();
    
    // Wait for chart elements (SVG elements from recharts)
    await page.waitForSelector('svg.recharts-surface', { timeout: 5000 });
    
    const chartLoadTime = Date.now() - chartStartTime;
    
    // Charts should render within 2 seconds
    expect(chartLoadTime).toBeLessThan(2000);
  });

  test('form submission responsiveness', async ({ page }) => {
    await page.goto('/');
    
    // Test account creation form
    await page.click('text=Accounts');
    await page.click('text=Add Account');
    
    // Fill form
    await page.fill('input[name="name"]', 'Quick Test Account');
    await page.fill('input[name="balance"]', '1234.56');
    
    // Measure submission time
    const submitStartTime = Date.now();
    await page.click('button[type="submit"]');
    
    // Wait for form to close and new account to appear
    await page.waitForSelector('text=Quick Test Account');
    const submitTime = Date.now() - submitStartTime;
    
    // Form submission should be quick (under 1 second)
    expect(submitTime).toBeLessThan(1000);
  });

  test('navigation responsiveness', async ({ page }) => {
    await page.goto('/');
    
    const routes = ['Accounts', 'Transactions', 'Budget', 'Goals', 'Dashboard'];
    
    for (const route of routes) {
      const navStartTime = Date.now();
      await page.click(`text=${route}`);
      
      // Wait for route-specific content
      if (route === 'Dashboard') {
        await page.waitForSelector('text=Net Worth');
      } else {
        await page.waitForSelector(`text=Add ${route.slice(0, -1)}`);
      }
      
      const navTime = Date.now() - navStartTime;
      
      // Navigation should be instant (under 500ms)
      expect(navTime).toBeLessThan(500);
    }
  });

  test('concurrent operations', async ({ page }) => {
    await page.goto('/');
    
    // Create an account
    await page.click('text=Accounts');
    await page.click('text=Add Account');
    await page.fill('input[name="name"]', 'Concurrent Test');
    await page.fill('input[name="balance"]', '5000');
    await page.click('button[type="submit"]');
    
    // Open multiple modals/forms quickly
    await page.click('text=Transactions');
    
    // Rapidly open and close transaction form
    const operationStartTime = Date.now();
    
    for (let i = 0; i < 5; i++) {
      await page.click('text=Add Transaction');
      await page.keyboard.press('Escape'); // Close modal
    }
    
    const operationTime = Date.now() - operationStartTime;
    
    // Rapid operations should not cause lag (under 2 seconds for 5 open/close)
    expect(operationTime).toBeLessThan(2000);
  });

  test('memory usage remains stable', async ({ page }) => {
    await page.goto('/');
    
    // Perform many operations to test memory stability
    for (let cycle = 0; cycle < 3; cycle++) {
      // Create accounts
      await page.click('text=Accounts');
      for (let i = 0; i < 5; i++) {
        await page.click('text=Add Account');
        await page.fill('input[name="name"]', `Memory Test ${cycle}-${i}`);
        await page.fill('input[name="balance"]', '1000');
        await page.click('button[type="submit"]');
      }
      
      // Navigate around
      await page.click('text=Dashboard');
      await page.click('text=Transactions');
      await page.click('text=Budget');
      await page.click('text=Goals');
    }
    
    // App should still be responsive after many operations
    const finalNavStartTime = Date.now();
    await page.click('text=Dashboard');
    await page.waitForSelector('text=Net Worth');
    const finalNavTime = Date.now() - finalNavStartTime;
    
    // Navigation should still be fast
    expect(finalNavTime).toBeLessThan(1000);
  });
});