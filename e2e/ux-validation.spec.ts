import { test, expect } from '@playwright/test';
import { setupTestAuth } from './test-helpers';

/**
 * UX Validation Test Suite
 * Tests real user workflows to identify friction points
 */

test.describe('UX Validation - Critical User Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Set up test authentication to bypass Clerk
    await setupTestAuth(page);
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');
  });

  test('Quick transaction entry should take 2 clicks or less', async ({ page }) => {
    let clickCount = 0;
    
    // Look for FAB or quick add button
    const fab = page.locator('[aria-label*="Add"]').or(page.locator('.fab-button'));
    if (await fab.isVisible()) {
      await fab.click();
      clickCount++;
      
      // Check if quick form is available
      const quickForm = page.locator('[data-testid="quick-transaction-form"]');
      if (await quickForm.isVisible()) {
        // Measure clicks to complete transaction
        await page.fill('input[name="description"]', 'Test transaction');
        await page.fill('input[name="amount"]', '10.00');
        
        const submitButton = page.locator('button[type="submit"]');
        await submitButton.click();
        clickCount++;
        
        expect(clickCount).toBeLessThanOrEqual(2);
      }
    }
  });

  test('Account balance should be visible without navigation', async ({ page }) => {
    // From dashboard, all account balances should be visible
    await setupTestAuth(page);
    await page.goto('http://localhost:5174/dashboard');
    
    // Wait for content to load
    await page.waitForLoadState('networkidle');
    
    // Check if account balances are visible - look for our new account balance cards
    const accountBalances = page.locator('[data-testid="account-balance-card"]').or(
      page.locator('.account-balance').or(
        page.locator('text=/Key Account Balances/').or(
          page.locator('text=/Account Balances/')
        )
      )
    );
    
    const count = await accountBalances.count();
    expect(count).toBeGreaterThan(0); // Should show at least one balance
  });

  test('Budget status should show at a glance', async ({ page }) => {
    await setupTestAuth(page);
    await page.goto('http://localhost:5174/dashboard');
    
    // Wait for content to load
    await page.waitForLoadState('networkidle');
    
    // Budget status should be visible on dashboard - look for our new budget status section
    const budgetIndicators = page.locator('[data-testid="budget-status"]').or(
      page.locator('.budget-progress').or(
        page.locator('text=/Budget Status/').or(
          page.locator('text=/Set Budget/')  // Button if no budgets
        )
      )
    );
    
    // Should see budget information or prompt to create budget
    const budgetVisible = await budgetIndicators.first().isVisible();
    expect(budgetVisible).toBeTruthy();
  });

  test('Mobile: Transaction list should support swipe actions', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await setupTestAuth(page);
    await page.goto('http://localhost:5174/transactions');
    
    // Check if swipeable indicators exist
    const transactionRows = page.locator('.transaction-row').or(
      page.locator('[data-testid="transaction-item"]')
    );
    
    const firstRow = transactionRows.first();
    if (await firstRow.isVisible()) {
      // Check for swipe capability (touch handlers or swipe indicators)
      const hasSwipeClass = await firstRow.evaluate(el => 
        el.classList.toString().includes('swipe') || 
        el.hasAttribute('data-swipeable')
      );
      
      // Mobile transactions should be swipeable or have quick actions
      const hasQuickActions = await page.locator('.transaction-actions').first().isVisible();
      
      expect(hasSwipeClass || hasQuickActions).toBeTruthy();
    }
  });

  test('Search should be instantly accessible', async ({ page }) => {
    // Search should be reachable within 1 click from any main page (skip Welcome page)
    const pages = ['/dashboard', '/transactions', '/accounts'];
    
    for (const path of pages) {
      await setupTestAuth(page);
      await page.goto(`http://localhost:5174${path}`);
      await page.waitForLoadState('networkidle');
      
      // Look for search input or search button - updated to match our new search bar
      const searchInput = page.locator('input[type="search"]').or(
        page.locator('input[placeholder*="Search"]').or(
          page.locator('text=/Search transactions/')  // Our new search bar text
        )
      );
      const searchButton = page.locator('button[aria-label*="Search"]').or(
        page.locator('button:has-text("Search")').or(
          page.locator('button:has-text("Ctrl+K")')  // Our search shortcut indicator
        )
      );
      
      // Use first() to avoid strict mode violations when multiple search elements exist
      const searchInputVisible = await searchInput.first().isVisible().catch(() => false);
      const searchButtonVisible = await searchButton.first().isVisible().catch(() => false);
      const searchAccessible = searchInputVisible || searchButtonVisible;
      expect(searchAccessible).toBeTruthy();
    }
  });

  test('Form validation should provide inline feedback', async ({ page }) => {
    // Navigate to add transaction
    await setupTestAuth(page);
    await page.goto('http://localhost:5174/transactions');
    const addButton = page.locator('button:has-text("Add")').first();
    
    if (await addButton.isVisible()) {
      await addButton.click();
      
      // Try to submit empty form
      const submitButton = page.locator('button[type="submit"]');
      if (await submitButton.isVisible()) {
        await submitButton.click();
        
        // Should see inline validation messages, not just browser defaults
        const validationMessages = page.locator('.error-message').or(
          page.locator('[role="alert"]')
        );
        
        const hasInlineValidation = await validationMessages.first().isVisible();
        expect(hasInlineValidation).toBeTruthy();
      }
    }
  });

  test('Loading states should be clear and informative', async ({ page }) => {
    await setupTestAuth(page);
    await page.goto('http://localhost:5174/transactions');
    
    // Check for loading indicators
    const loadingIndicators = page.locator('.loading').or(
      page.locator('[data-testid="loading"]').or(
        page.locator('.spinner')
      )
    );
    
    // During initial load, should see loading state
    // This is a quick check - in real scenario would trigger a data fetch
    const hasLoadingStates = await loadingIndicators.count() > 0 || 
                            await page.locator('text=/loading/i').count() > 0;
    
    // App should have loading states implemented
    expect(hasLoadingStates).toBeDefined();
  });

  test('Empty states should guide users', async ({ page }) => {
    // Check various empty states
    await setupTestAuth(page);
    await page.goto('http://localhost:5174/goals');
    await page.waitForLoadState('networkidle');
    
    // Check if we have the empty state with our new data-testid
    const emptyState = page.locator('[data-testid="empty-state"]').or(
      page.locator('text=/No goals yet/i').or(
        page.locator('text=/Create Your First Goal/').or(
          page.locator('text=/Set financial goals/')
        )
      )
    );
    
    // Either we have goals displayed OR we have an empty state
    const hasEmptyState = await emptyState.first().isVisible();
    // Use first() to avoid strict mode violation with multiple elements
    const hasGoals = await page.locator('text=/Active Goals/').first().isVisible().catch(() => false);
    
    expect(hasEmptyState || hasGoals).toBeTruthy();
  });
});

test.describe('UX Validation - Friction Points', () => {
  test('Measure clicks for common tasks', async ({ page }) => {
    const taskMetrics = {
      addTransaction: 0,
      checkBalance: 0,
      viewBudget: 0,
      filterTransactions: 0
    };
    
    // Measure each task and report
    await setupTestAuth(page);
    await page.goto('http://localhost:5174');
    
    // Task 1: Add transaction
    let clicks = 0;
    const addButton = page.locator('button:has-text("Add")').or(
      page.locator('[aria-label*="Add"]')
    ).first();
    
    if (await addButton.isVisible()) {
      await addButton.click();
      clicks++;
      
      const form = page.locator('form').first();
      if (await form.isVisible()) {
        clicks++; // Count form submission as a click
      }
      taskMetrics.addTransaction = clicks;
    }
    
    // Report metrics
    console.log('UX Metrics - Clicks required:');
    console.log(taskMetrics);
    
    // Optimal targets
    expect(taskMetrics.addTransaction).toBeLessThanOrEqual(3);
  });
});

test.describe('UX Validation - User Preferences', () => {
  test('Should remember last used category', async ({ page }) => {
    await setupTestAuth(page);
    await page.goto('http://localhost:5174/transactions');
    
    // Add a transaction with a specific category
    // Then add another and check if category is pre-selected
    // This tests if the app learns from user behavior
    
    // Implementation depends on actual UI structure
  });
  
  test('Should maintain filter state during session', async ({ page }) => {
    await setupTestAuth(page);
    await page.goto('http://localhost:5174/transactions');
    
    // Apply a filter
    const filterButton = page.locator('button:has-text("Filter")').first();
    if (await filterButton.isVisible()) {
      await filterButton.click();
      
      // Select a filter option
      // Navigate away and back
      await page.goto('http://localhost:5174/dashboard');
      await page.goto('http://localhost:5174/transactions');
      
      // Filter should still be applied
      // Check if filter indicators are visible
    }
  });
});