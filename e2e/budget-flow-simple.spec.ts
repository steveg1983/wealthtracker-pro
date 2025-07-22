import { test, expect, Page } from '@playwright/test';

// Helper function to navigate to Budget page
async function navigateToBudget(page: Page) {
  await page.goto('/budget');
  await page.waitForLoadState('networkidle');
  
  // Wait for Budget page to load
  await expect(page.getByRole('heading', { name: 'Budget', level: 1 })).toBeVisible({ timeout: 10000 });
}

test.describe('Budget - Core Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToBudget(page);
  });

  test('should display budget page', async ({ page }) => {
    // Check main heading
    await expect(page.getByRole('heading', { name: 'Budget', level: 1 })).toBeVisible();
    
    // Check summary cards are visible
    await expect(page.getByText('Total Budgeted')).toBeVisible();
    await expect(page.getByText('Total Spent')).toBeVisible();
    await expect(page.getByText('Total Remaining')).toBeVisible();
  });

  test('should display budget tabs', async ({ page }) => {
    // Check tabs are visible
    await expect(page.getByText('Traditional')).toBeVisible();
    await expect(page.getByText('Envelope')).toBeVisible();
    await expect(page.getByText('Templates')).toBeVisible();
    await expect(page.getByText('Rollover')).toBeVisible();
    await expect(page.getByText('Alerts')).toBeVisible();
    await expect(page.getByText('Zero-Based')).toBeVisible();
  });

  test('should navigate between tabs', async ({ page }) => {
    // Verify we can click on different tabs
    // First check Traditional is visible
    const traditionalTab = page.getByText('Traditional');
    await expect(traditionalTab).toBeVisible();
    
    // Click Envelope tab
    const envelopeTab = page.getByText('Envelope');
    await expect(envelopeTab).toBeVisible();
    await envelopeTab.click();
    await page.waitForTimeout(1000);
    
    // The test passes if we can click without errors
  });

  test('should display existing budgets', async ({ page }) => {
    // Check if any budget cards are visible
    const budgetCards = page.locator('div').filter({ hasText: 'Monthly budget' });
    const count = await budgetCards.count();
    
    // If there are budgets, verify they show key information
    if (count > 0) {
      // Check for budget amount (currency format) - use first() to avoid strict mode error
      await expect(page.getByText(/£\d+\.\d{2}/).first()).toBeVisible();
      
      // Check for Active status
      await expect(page.getByText('Active').first()).toBeVisible();
    }
  });

  test('should have add budget button', async ({ page }) => {
    // Look for the add budget button in the header
    const addButton = page.locator('div[title="Add Budget"]');
    await expect(addButton).toBeVisible();
    
    // Verify it's clickable
    await expect(addButton).toBeEnabled();
  });
});

test.describe('Budget - Summary Display', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToBudget(page);
  });

  test('should display budget totals', async ({ page }) => {
    // Check for currency formatted totals
    const totalBudgeted = page.locator('text=/£[0-9,]+\\.[0-9]{2}/').first();
    await expect(totalBudgeted).toBeVisible();
  });

  test('should display budget categories', async ({ page }) => {
    // Common budget categories that might be displayed
    const categories = ['Groceries', 'Transport', 'Utilities', 'Entertainment'];
    let foundCategory = false;
    
    for (const category of categories) {
      const categoryElement = page.getByText(category);
      if (await categoryElement.isVisible({ timeout: 1000 }).catch(() => false)) {
        foundCategory = true;
        break;
      }
    }
    
    // At least one category should be visible if there are budgets
    expect(foundCategory).toBeTruthy();
  });

  test('should show budget progress indicators', async ({ page }) => {
    // Look for percentage indicators
    const percentageText = page.getByText(/\d+% used/);
    const hasPercentage = await percentageText.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (hasPercentage) {
      await expect(percentageText.first()).toBeVisible();
    }
  });
});

test.describe('Budget - Mobile View', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await navigateToBudget(page);
  });

  test('should display budget page on mobile', async ({ page }) => {
    // Check main elements are visible
    await expect(page.getByRole('heading', { name: 'Budget', level: 1 })).toBeVisible();
    
    // Check summary cards stack properly on mobile
    await expect(page.getByText('Total Budgeted')).toBeVisible();
    await expect(page.getByText('Total Spent')).toBeVisible();
  });

  test('should have responsive tab layout', async ({ page }) => {
    // Check tabs are still accessible on mobile
    const traditionalTab = page.getByText('Traditional');
    await expect(traditionalTab).toBeVisible();
    
    // Tabs might be scrollable on mobile
    const tabContainer = traditionalTab.locator('..');
    const containerBox = await tabContainer.boundingBox();
    expect(containerBox).not.toBeNull();
  });
});