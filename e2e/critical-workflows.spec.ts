import { test, expect } from '@playwright/test';
import { setupTestAuth } from './test-helpers';

test.describe('Critical User Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Set up test auth and clear localStorage before each test
    await setupTestAuth(page);
    await page.goto('/?demo=true');
    await page.waitForTimeout(2000); // Wait for app to fully load
    await page.evaluate(() => localStorage.clear());
  });

  test('Complete financial setup workflow', async ({ page }) => {

    // Step 1: Create accounts
    await page.getByRole('link', { name: /accounts/i }).click();
    await expect(page.getByRole('heading', { name: /accounts/i })).toBeVisible();

    // Add checking account
    await page.getByRole('button', { name: /add.*account/i }).click();
    await page.getByLabel(/account.*name/i).fill('Main Checking');
    await page.getByLabel(/type/i).selectOption('current');
    await page.getByLabel(/balance/i).fill('5000');
    await page.getByRole('button', { name: /save|create/i }).click();

    // Verify account was created
    await expect(page.getByText('Main Checking')).toBeVisible();
    await expect(page.getByText(/£5,000\.00|5,000\.00/)).toBeVisible();

    // Add savings account
    await page.getByRole('button', { name: /add.*account/i }).click();
    await page.getByLabel(/account.*name/i).fill('Emergency Savings');
    await page.getByLabel(/type/i).selectOption('savings');
    await page.getByLabel(/balance/i).fill('10000');
    await page.getByRole('button', { name: /save|create/i }).click();

    // Verify total balance
    await expect(page.getByText(/£15,000\.00|15,000\.00/)).toBeVisible();
  });

  test('Record and categorize transactions', async ({ page }) => {

    // Navigate to transactions
    await page.getByRole('link', { name: /transactions/i }).click();
    await expect(page.getByRole('heading', { name: /transactions/i })).toBeVisible();

    // Add income transaction
    await page.getByRole('button', { name: /add.*transaction/i }).click();
    await page.getByLabel(/description/i).fill('Monthly Salary');
    await page.getByLabel(/amount/i).fill('3500');
    await page.getByLabel(/type/i).selectOption('income');
    await page.getByLabel(/category/i).selectOption('salary');
    await page.getByLabel(/date/i).fill('2024-01-15');
    await page.getByRole('button', { name: /save|add/i }).click();

    // Add expense transactions
    await page.getByRole('button', { name: /add.*transaction/i }).click();
    await page.getByLabel(/description/i).fill('Rent Payment');
    await page.getByLabel(/amount/i).fill('1200');
    await page.getByLabel(/type/i).selectOption('expense');
    await page.getByLabel(/category/i).selectOption('housing');
    await page.getByLabel(/date/i).fill('2024-01-05');
    await page.getByRole('button', { name: /save|add/i }).click();

    // Verify transactions appear
    await expect(page.getByText('Monthly Salary')).toBeVisible();
    await expect(page.getByText('Rent Payment')).toBeVisible();
    await expect(page.getByText(/£3,500\.00|3,500\.00/)).toBeVisible();
    await expect(page.getByText(/£1,200\.00|1,200\.00/)).toBeVisible();
  });

  test('Set up and monitor budgets', async ({ page }) => {

    // Navigate to budget
    await page.getByRole('link', { name: /budget/i }).click();
    await expect(page.getByRole('heading', { name: /budget/i })).toBeVisible();

    // Create budget for groceries
    await page.getByRole('button', { name: /add.*budget|create.*budget/i }).click();
    await page.getByLabel(/category/i).selectOption('groceries');
    await page.getByLabel(/amount/i).fill('500');
    await page.getByLabel(/period/i).selectOption('monthly');
    await page.getByRole('button', { name: /save|create/i }).click();

    // Create budget for entertainment
    await page.getByRole('button', { name: /add.*budget|create.*budget/i }).click();
    await page.getByLabel(/category/i).selectOption('entertainment');
    await page.getByLabel(/amount/i).fill('200');
    await page.getByLabel(/period/i).selectOption('monthly');
    await page.getByRole('button', { name: /save|create/i }).click();

    // Verify budgets appear
    await expect(page.getByText(/groceries.*£500/i)).toBeVisible();
    await expect(page.getByText(/entertainment.*£200/i)).toBeVisible();
  });

  test('Create and track financial goals', async ({ page }) => {

    // Navigate to goals
    await page.getByRole('link', { name: /goals/i }).click();
    await expect(page.getByRole('heading', { name: /goals/i })).toBeVisible();

    // Create emergency fund goal
    await page.getByRole('button', { name: /add.*goal|create.*goal/i }).click();
    await page.getByLabel(/goal.*name/i).fill('Emergency Fund');
    await page.getByLabel(/target.*amount/i).fill('15000');
    await page.getByLabel(/current.*amount/i).fill('5000');
    await page.getByLabel(/target.*date/i).fill('2024-12-31');
    await page.getByRole('button', { name: /save|create/i }).click();

    // Verify goal appears with progress
    await expect(page.getByText('Emergency Fund')).toBeVisible();
    await expect(page.getByText(/33%|£5,000.*£15,000/)).toBeVisible();
  });

  test('View dashboard with all financial data', async ({ page }) => {
    // First set up some data
    await page.goto('/');
    
    // Add account via localStorage for speed
    await page.evaluate(() => {
      const accounts = [{
        id: '1',
        name: 'Test Account',
        type: 'current',
        balance: 5000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }];
      localStorage.setItem('wealthtracker_accounts', JSON.stringify(accounts));
      
      const transactions = [
        {
          id: '1',
          accountId: '1',
          amount: 3000,
          type: 'income',
          category: 'salary',
          description: 'Salary',
          date: new Date().toISOString(),
          pending: false,
          isReconciled: true
        },
        {
          id: '2',
          accountId: '1',
          amount: 1200,
          type: 'expense',
          category: 'housing',
          description: 'Rent',
          date: new Date().toISOString(),
          pending: false,
          isReconciled: false
        }
      ];
      localStorage.setItem('wealthtracker_transactions', JSON.stringify(transactions));
    });

    // Navigate to dashboard
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();

    // Verify key metrics are displayed
    await expect(page.getByText(/net worth|total balance/i)).toBeVisible();
    await expect(page.getByText(/income.*expense/i)).toBeVisible();
    await expect(page.getByText(/recent.*transaction/i)).toBeVisible();
  });

  test('Mobile responsive workflow', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Check mobile menu
    const menuButton = page.getByRole('button', { name: /menu|nav/i });
    if (await menuButton.isVisible()) {
      await menuButton.click();
    }

    // Navigate using mobile menu
    await page.getByRole('link', { name: /accounts/i }).click();
    await expect(page.getByRole('heading', { name: /accounts/i })).toBeVisible();

    // Check that key actions are accessible on mobile
    await expect(page.getByRole('button', { name: /add.*account/i })).toBeVisible();
  });

  test('Data persistence across sessions', async ({ page }) => {

    // Add data via UI or localStorage
    await page.evaluate(() => {
      const testData = {
        accounts: [{
          id: 'persist-1',
          name: 'Persistent Account',
          type: 'savings',
          balance: 7500,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }],
        transactions: [{
          id: 'persist-1',
          accountId: 'persist-1',
          amount: 500,
          type: 'income',
          category: 'other',
          description: 'Test Income',
          date: new Date().toISOString(),
          pending: false,
          isReconciled: false
        }]
      };
      localStorage.setItem('wealthtracker_accounts', JSON.stringify(testData.accounts));
      localStorage.setItem('wealthtracker_transactions', JSON.stringify(testData.transactions));
    });

    // Reload page
    await page.reload();

    // Navigate to accounts
    await page.getByRole('link', { name: /accounts/i }).click();

    // Verify data persisted
    await expect(page.getByText('Persistent Account')).toBeVisible();
    await expect(page.getByText(/£7,500\.00|7,500\.00/)).toBeVisible();

    // Navigate to another page and back to verify persistence
    await page.goto('/transactions?demo=true');
    await page.goto('/accounts?demo=true');
    
    // Verify data is still available
    await expect(page.getByText('Persistent Account')).toBeVisible();
  });

  test('Export and import data workflow', async ({ page }) => {

    // Navigate to settings
    await page.getByRole('link', { name: /settings/i }).click();
    
    // Go to data management
    await page.getByRole('link', { name: /data.*management|import.*export/i }).click();

    // Test export functionality
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /export.*data/i }).click();
    const download = await downloadPromise;
    
    // Verify download
    expect(download.suggestedFilename()).toContain('wealthtracker');
    expect(download.suggestedFilename()).toMatch(/\.(json|csv)/);
  });

  test('Search and filter transactions', async ({ page }) => {
    // Set up test data
    await page.goto('/');
    await page.evaluate(() => {
      const transactions = [
        {
          id: '1',
          accountId: '1',
          amount: 50,
          type: 'expense',
          category: 'groceries',
          description: 'Walmart groceries',
          date: new Date('2024-01-10').toISOString(),
          pending: false,
          isReconciled: false
        },
        {
          id: '2',
          accountId: '1',
          amount: 30,
          type: 'expense',
          category: 'entertainment',
          description: 'Netflix subscription',
          date: new Date('2024-01-15').toISOString(),
          pending: false,
          isReconciled: true
        },
        {
          id: '3',
          accountId: '1',
          amount: 100,
          type: 'expense',
          category: 'groceries',
          description: 'Whole Foods',
          date: new Date('2024-01-20').toISOString(),
          pending: true,
          isReconciled: false
        }
      ];
      localStorage.setItem('wealthtracker_transactions', JSON.stringify(transactions));
    });

    // Navigate to transactions
    await page.goto('/transactions');

    // Search for specific transaction
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('Netflix');
      await expect(page.getByText('Netflix subscription')).toBeVisible();
      await expect(page.getByText('Walmart')).not.toBeVisible();
    }

    // Clear search
    await searchInput.clear();

    // Filter by category
    const categoryFilter = page.getByLabel(/category/i);
    if (await categoryFilter.isVisible()) {
      await categoryFilter.selectOption('groceries');
      await expect(page.getByText('Walmart groceries')).toBeVisible();
      await expect(page.getByText('Whole Foods')).toBeVisible();
      await expect(page.getByText('Netflix')).not.toBeVisible();
    }
  });

  test('Reconciliation workflow', async ({ page }) => {
    // Set up test data
    await page.goto('/');
    await page.evaluate(() => {
      const accounts = [{
        id: '1',
        name: 'Checking',
        type: 'current',
        balance: 1000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }];
      const transactions = [
        {
          id: '1',
          accountId: '1',
          amount: 50,
          type: 'expense',
          category: 'groceries',
          description: 'Unreconciled transaction',
          date: new Date().toISOString(),
          pending: false,
          isReconciled: false
        }
      ];
      localStorage.setItem('wealthtracker_accounts', JSON.stringify(accounts));
      localStorage.setItem('wealthtracker_transactions', JSON.stringify(transactions));
    });

    // Navigate to reconciliation
    await page.goto('/reconciliation');
    await expect(page.getByRole('heading', { name: /reconciliation/i })).toBeVisible();

    // Select account if needed
    const accountSelect = page.getByLabel(/account/i);
    if (await accountSelect.isVisible()) {
      await accountSelect.selectOption('1');
    }

    // Find unreconciled transaction
    await expect(page.getByText('Unreconciled transaction')).toBeVisible();

    // Reconcile transaction
    const reconcileButton = page.getByRole('button', { name: /reconcile|mark.*reconciled/i }).first();
    if (await reconcileButton.isVisible()) {
      await reconcileButton.click();
      
      // Verify reconciliation status changed
      await expect(page.getByText(/reconciled|✓/i)).toBeVisible();
    }
  });
});