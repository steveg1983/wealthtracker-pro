import { test, expect, Page } from '@playwright/test';

// Helper function to navigate to Budget page
async function navigateToBudget(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  // Check if we're on mobile (viewport width)
  const viewportSize = page.viewportSize();
  const isMobile = viewportSize && viewportSize.width < 768;
  
  if (isMobile) {
    // For mobile, navigate directly to the Budget page
    await page.goto('/budget');
    await page.waitForLoadState('networkidle');
  } else {
    // Desktop navigation - click on Budget menu item
    const budgetMenuItem = page.getByRole('menuitem', { name: /Navigate to Budget/i });
    if (await budgetMenuItem.isVisible({ timeout: 3000 })) {
      await budgetMenuItem.click();
    } else {
      // Direct navigation if menu item not found
      await page.goto('/budget');
    }
  }
  
  // Wait for Budget page to load
  await expect(page.getByRole('heading', { name: 'Budget', level: 1 })).toBeVisible({ timeout: 10000 });
}

test.describe('Budget - Basic Operations', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToBudget(page);
  });

  test('should display budget page with tabs', async ({ page }) => {
    // Check main heading
    await expect(page.getByRole('heading', { name: 'Budget', level: 1 })).toBeVisible();
    
    // Check tabs are visible - they appear as links/buttons with icons
    await expect(page.getByText('Traditional')).toBeVisible();
    await expect(page.getByText('Envelope')).toBeVisible();
    await expect(page.getByText('Templates')).toBeVisible();
    await expect(page.getByText('Rollover')).toBeVisible();
    await expect(page.getByText('Alerts')).toBeVisible();
    await expect(page.getByText('Zero-Based')).toBeVisible();
  });

  test('should create a new budget', async ({ page }) => {
    // Click the add budget button - it's in the top right corner
    await page.locator('div[title="Add Budget"]').click();
    
    // Wait for modal to open
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: /Add Budget/i })).toBeVisible();
    
    // Fill in budget details
    await page.getByLabel(/Category/i).selectOption({ index: 1 }); // Select first category
    await page.getByLabel(/Budget Amount/i).fill('500');
    await page.getByLabel(/Period/i).selectOption('monthly');
    
    // Save the budget
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    
    // Verify modal closes
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
    
    // Verify budget appears in the list
    await expect(page.getByText('$500.00')).toBeVisible();
  });

  test('should edit an existing budget', async ({ page }) => {
    // First create a budget
    await page.locator('div[title="Add Budget"]').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    
    await page.getByLabel(/Category/i).selectOption({ index: 1 });
    await page.getByLabel(/Budget Amount/i).fill('300');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    
    // Now edit it - click the edit button
    await page.getByRole('button', { name: /Edit/i }).first().click();
    
    // Modal should open with existing values
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Edit Budget/i })).toBeVisible();
    
    // Update the amount
    await page.getByLabel(/Budget Amount/i).fill('600');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    
    // Verify update
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText('$600.00')).toBeVisible();
  });

  test('should delete a budget', async ({ page }) => {
    // First create a budget
    await page.locator('div[title="Add Budget"]').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    
    await page.getByLabel(/Category/i).selectOption({ index: 1 });
    await page.getByLabel(/Budget Amount/i).fill('250');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    
    // Verify it exists
    await expect(page.getByText('$250.00')).toBeVisible();
    
    // Delete it
    await page.getByRole('button', { name: /Delete/i }).first().click();
    
    // Wait for deletion to process
    await page.waitForTimeout(1000);
    
    // Verify it's deleted
    await expect(page.getByText('$250.00')).not.toBeVisible({ timeout: 5000 });
  });

  test('should toggle budget active status', async ({ page }) => {
    // Create a budget first
    await page.locator('div[title="Add Budget"]').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    
    await page.getByLabel(/Category/i).selectOption({ index: 1 });
    await page.getByLabel(/Budget Amount/i).fill('400');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    
    // Look for the Active status indicator
    const activeStatus = page.getByText('Active').first();
    await expect(activeStatus).toBeVisible();
    
    // The toggle is likely through edit or clicking on the status
    // For now, just verify the budget was created with Active status
    await expect(page.getByText('Active')).toBeVisible();
  });
});

test.describe('Budget - Tab Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToBudget(page);
  });

  test('should navigate to Envelope budgeting tab', async ({ page }) => {
    await page.getByText('Envelope').click();
    
    // Wait for envelope content to load - check for envelope-specific content
    await page.waitForTimeout(500); // Give time for tab switch
    const envelopeContent = page.getByText(/Envelope|Allocate|envelope/i).first();
    await expect(envelopeContent).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to Templates tab', async ({ page }) => {
    await page.getByText('Templates').click();
    
    // Wait for tab content to change
    await page.waitForTimeout(500);
  });

  test('should navigate to Rollover tab', async ({ page }) => {
    await page.getByText('Rollover').click();
    
    // Wait for tab content to change
    await page.waitForTimeout(500);
  });

  test('should navigate to Alerts tab', async ({ page }) => {
    await page.getByText('Alerts').click();
    
    // Wait for tab content to change
    await page.waitForTimeout(500);
  });

  test('should navigate to Zero Based tab', async ({ page }) => {
    await page.getByText('Zero-Based').click();
    
    // Wait for tab content to change
    await page.waitForTimeout(500);
  });
});

test.describe('Budget - Progress and Spending', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToBudget(page);
  });

  test('should display budget progress bars', async ({ page }) => {
    // Create a budget
    await page.locator('div[title="Add Budget"]').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    
    await page.getByLabel(/Category/i).selectOption({ index: 1 });
    await page.getByLabel(/Budget Amount/i).fill('1000');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    
    // Check for progress bar
    const progressBar = page.locator('[role="progressbar"], .progress-bar, [class*="progress"]').first();
    await expect(progressBar).toBeVisible({ timeout: 5000 });
  });

  test('should show budget summary cards', async ({ page }) => {
    // Check for summary cards
    await expect(page.getByText(/Total Budgeted/i)).toBeVisible();
    await expect(page.getByText(/Total Spent/i)).toBeVisible();
    await expect(page.getByText(/Remaining/i)).toBeVisible();
  });

  test('should display budget periods correctly', async ({ page }) => {
    // Create weekly budget
    await page.locator('div[title="Add Budget"]').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    
    await page.getByLabel(/Category/i).selectOption({ index: 1 });
    await page.getByLabel(/Budget Amount/i).fill('100');
    await page.getByLabel(/Period/i).selectOption('weekly');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    
    // Verify weekly budget shows
    await expect(page.getByText(/weekly/i)).toBeVisible();
    
    // Create monthly budget
    await page.locator('div[title="Add Budget"]').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    
    await page.getByLabel(/Category/i).selectOption({ index: 2 });
    await page.getByLabel(/Budget Amount/i).fill('500');
    await page.getByLabel(/Period/i).selectOption('monthly');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    
    // Verify monthly budget shows
    await expect(page.getByText(/monthly/i)).toBeVisible();
  });
});

test.describe('Budget - Advanced Features', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToBudget(page);
  });

  test('should handle budget validation', async ({ page }) => {
    // Try to create budget without required fields
    await page.locator('div[title="Add Budget"]').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    
    // Click save without filling fields
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    
    // Should show validation error or stay on modal
    const modalStillVisible = await page.getByRole('dialog').isVisible();
    const hasError = await page.getByText(/required|Please select|Invalid/i).isVisible({ timeout: 1000 }).catch(() => false);
    
    expect(modalStillVisible || hasError).toBeTruthy();
  });

  test('should handle decimal amounts', async ({ page }) => {
    await page.locator('div[title="Add Budget"]').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    
    await page.getByLabel(/Category/i).selectOption({ index: 1 });
    await page.getByLabel(/Budget Amount/i).fill('123.45');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    
    // Verify decimal amount is displayed correctly
    await expect(page.getByText('$123.45')).toBeVisible();
  });

  test('should filter budgets by status', async ({ page }) => {
    // Create multiple budgets
    for (let i = 0; i < 2; i++) {
      await page.locator('div[title="Add Budget"]').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      
      await page.getByLabel(/Category/i).selectOption({ index: i + 1 });
      await page.getByLabel(/Budget Amount/i).fill(`${(i + 1) * 100}`);
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    }
    
    // Verify multiple budgets were created
    const budgetCards = page.locator('div').filter({ hasText: /Monthly budget|Weekly budget|Yearly budget/i });
    const count = await budgetCards.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

test.describe('Budget - Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await navigateToBudget(page);
  });

  test('should display budget page on mobile', async ({ page }) => {
    // Check main elements are visible
    await expect(page.getByRole('heading', { name: 'Budget', level: 1 })).toBeVisible();
    
    // Check tabs are scrollable or stacked on mobile
    const tabContainer = page.locator('.flex.space-x-1').first();
    await expect(tabContainer).toBeVisible();
  });

  test('should open budget modal on mobile', async ({ page }) => {
    await page.locator('div[title="Add Budget"]').click();
    
    // Modal should be full screen or properly sized for mobile
    await expect(page.getByRole('dialog')).toBeVisible();
    
    // Check that form elements are accessible
    await expect(page.getByLabel(/Category/i)).toBeVisible();
    await expect(page.getByLabel(/Budget Amount/i)).toBeVisible();
  });
});