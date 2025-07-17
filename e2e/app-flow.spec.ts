import { test, expect } from '@playwright/test';

test.describe('WealthTracker App Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('initial app load and navigation', async ({ page }) => {
    // Check if app loads
    await expect(page).toHaveTitle(/Wealth Tracker/);
    
    // Check main navigation elements
    await expect(page.getByText('Dashboard')).toBeVisible();
    await expect(page.getByText('Accounts')).toBeVisible();
    await expect(page.getByText('Transactions')).toBeVisible();
    await expect(page.getByText('Budget')).toBeVisible();
    await expect(page.getByText('Goals')).toBeVisible();
    
    // Check if dashboard loads by default
    await expect(page.getByText(/Net Worth/i)).toBeVisible();
  });

  test('navigate between pages', async ({ page }) => {
    // Navigate to Accounts
    await page.click('text=Accounts');
    await expect(page.getByText(/Add Account/i)).toBeVisible();
    
    // Navigate to Transactions
    await page.click('text=Transactions');
    await expect(page.getByText(/Add Transaction/i)).toBeVisible();
    
    // Navigate to Budget
    await page.click('text=Budget');
    await expect(page.getByText(/Budget/i)).toBeVisible();
    
    // Navigate to Goals
    await page.click('text=Goals');
    await expect(page.getByText(/Add Goal/i)).toBeVisible();
    
    // Navigate back to Dashboard
    await page.click('text=Dashboard');
    await expect(page.getByText(/Net Worth/i)).toBeVisible();
  });

  test('create an account', async ({ page }) => {
    // Navigate to Accounts page
    await page.click('text=Accounts');
    
    // Click Add Account button
    await page.click('text=Add Account');
    
    // Fill in account details
    await page.fill('input[name="name"]', 'Test Savings Account');
    await page.selectOption('select[name="type"]', 'savings');
    await page.fill('input[name="balance"]', '5000');
    await page.selectOption('select[name="currency"]', 'USD');
    await page.fill('input[name="institution"]', 'Test Bank');
    
    // Save the account
    await page.click('button[type="submit"]');
    
    // Verify account was created
    await expect(page.getByText('Test Savings Account')).toBeVisible();
    await expect(page.getByText('$5,000.00')).toBeVisible();
  });

  test('create a transaction', async ({ page }) => {
    // First create an account
    await page.click('text=Accounts');
    await page.click('text=Add Account');
    await page.fill('input[name="name"]', 'Checking Account');
    await page.selectOption('select[name="type"]', 'checking');
    await page.fill('input[name="balance"]', '2000');
    await page.click('button[type="submit"]');
    
    // Navigate to Transactions
    await page.click('text=Transactions');
    
    // Add a transaction
    await page.click('text=Add Transaction');
    await page.fill('input[name="description"]', 'Grocery Shopping');
    await page.fill('input[name="amount"]', '150.50');
    await page.selectOption('select[name="type"]', 'expense');
    await page.selectOption('select[name="category"]', 'groceries');
    await page.selectOption('select[name="accountId"]', { label: 'Checking Account' });
    
    // Save the transaction
    await page.click('button[type="submit"]');
    
    // Verify transaction was created
    await expect(page.getByText('Grocery Shopping')).toBeVisible();
    await expect(page.getByText('-$150.50')).toBeVisible();
  });

  test('create a budget', async ({ page }) => {
    // Navigate to Budget page
    await page.click('text=Budget');
    
    // Add a budget
    await page.click('text=Add Budget');
    await page.selectOption('select[name="category"]', 'groceries');
    await page.fill('input[name="amount"]', '500');
    await page.selectOption('select[name="period"]', 'monthly');
    
    // Save the budget
    await page.click('button[type="submit"]');
    
    // Verify budget was created
    await expect(page.getByText('Groceries')).toBeVisible();
    await expect(page.getByText('$500')).toBeVisible();
  });

  test('create a goal', async ({ page }) => {
    // Navigate to Goals page
    await page.click('text=Goals');
    
    // Add a goal
    await page.click('text=Add Goal');
    await page.fill('input[name="name"]', 'Emergency Fund');
    await page.selectOption('select[name="type"]', 'savings');
    await page.fill('input[name="targetAmount"]', '10000');
    await page.fill('input[name="currentAmount"]', '2500');
    
    // Set target date (1 year from now)
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    await page.fill('input[name="targetDate"]', futureDate.toISOString().split('T')[0]);
    
    // Save the goal
    await page.click('button[type="submit"]');
    
    // Verify goal was created
    await expect(page.getByText('Emergency Fund')).toBeVisible();
    await expect(page.getByText('$10,000')).toBeVisible();
    await expect(page.getByText('25%')).toBeVisible(); // Progress
  });

  test('dashboard shows correct calculations', async ({ page }) => {
    // Create accounts with different balances
    await page.click('text=Accounts');
    
    // Create savings account
    await page.click('text=Add Account');
    await page.fill('input[name="name"]', 'Savings');
    await page.selectOption('select[name="type"]', 'savings');
    await page.fill('input[name="balance"]', '5000');
    await page.click('button[type="submit"]');
    
    // Create checking account
    await page.click('text=Add Account');
    await page.fill('input[name="name"]', 'Checking');
    await page.selectOption('select[name="type"]', 'checking');
    await page.fill('input[name="balance"]', '2500');
    await page.click('button[type="submit"]');
    
    // Create credit card (liability)
    await page.click('text=Add Account');
    await page.fill('input[name="name"]', 'Credit Card');
    await page.selectOption('select[name="type"]', 'credit');
    await page.fill('input[name="balance"]', '-1000');
    await page.click('button[type="submit"]');
    
    // Go to dashboard
    await page.click('text=Dashboard');
    
    // Check net worth calculation (5000 + 2500 - 1000 = 6500)
    await expect(page.getByText(/\$6,500/)).toBeVisible();
    
    // Check total assets
    await expect(page.getByText(/\$7,500/)).toBeVisible();
    
    // Check total liabilities
    await expect(page.getByText(/\$1,000/)).toBeVisible();
  });

  test('search and filter transactions', async ({ page }) => {
    // Create an account first
    await page.click('text=Accounts');
    await page.click('text=Add Account');
    await page.fill('input[name="name"]', 'Main Account');
    await page.selectOption('select[name="type"]', 'checking');
    await page.fill('input[name="balance"]', '5000');
    await page.click('button[type="submit"]');
    
    // Create multiple transactions
    await page.click('text=Transactions');
    
    // Transaction 1
    await page.click('text=Add Transaction');
    await page.fill('input[name="description"]', 'Coffee Shop');
    await page.fill('input[name="amount"]', '5.50');
    await page.selectOption('select[name="type"]', 'expense');
    await page.selectOption('select[name="category"]', 'dining');
    await page.click('button[type="submit"]');
    
    // Transaction 2
    await page.click('text=Add Transaction');
    await page.fill('input[name="description"]', 'Salary');
    await page.fill('input[name="amount"]', '3000');
    await page.selectOption('select[name="type"]', 'income');
    await page.selectOption('select[name="category"]', 'salary');
    await page.click('button[type="submit"]');
    
    // Search for specific transaction
    await page.fill('input[placeholder*="Search"]', 'Coffee');
    await expect(page.getByText('Coffee Shop')).toBeVisible();
    await expect(page.getByText('Salary')).not.toBeVisible();
    
    // Clear search
    await page.fill('input[placeholder*="Search"]', '');
    
    // Filter by type
    await page.selectOption('select[name="typeFilter"]', 'expense');
    await expect(page.getByText('Coffee Shop')).toBeVisible();
    await expect(page.getByText('Salary')).not.toBeVisible();
  });

  test('responsive design', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check if mobile menu button is visible
    await expect(page.getByRole('button', { name: /menu/i })).toBeVisible();
    
    // Open mobile menu
    await page.click('button[aria-label="Menu"]');
    
    // Check navigation items are visible in mobile menu
    await expect(page.getByText('Dashboard')).toBeVisible();
    await expect(page.getByText('Accounts')).toBeVisible();
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    // Check layout adjusts properly
    await expect(page.getByText('Dashboard')).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    // Check full navigation is visible
    await expect(page.getByText('Dashboard')).toBeVisible();
    await expect(page.getByText('Accounts')).toBeVisible();
    await expect(page.getByText('Transactions')).toBeVisible();
  });

  test('data persistence', async ({ page, context }) => {
    // Create an account
    await page.click('text=Accounts');
    await page.click('text=Add Account');
    await page.fill('input[name="name"]', 'Persistent Account');
    await page.fill('input[name="balance"]', '1234.56');
    await page.click('button[type="submit"]');
    
    // Verify account exists
    await expect(page.getByText('Persistent Account')).toBeVisible();
    
    // Create new page in same context (simulates refresh)
    const newPage = await context.newPage();
    await newPage.goto('/');
    await newPage.click('text=Accounts');
    
    // Verify data persists
    await expect(newPage.getByText('Persistent Account')).toBeVisible();
    await expect(newPage.getByText('$1,234.56')).toBeVisible();
    
    await newPage.close();
  });

  test('settings and preferences', async ({ page }) => {
    // Navigate to Settings
    await page.click('text=Settings');
    
    // Change currency
    await page.selectOption('select[name="currency"]', 'EUR');
    
    // Toggle compact view
    await page.click('input[name="compactView"]');
    
    // Change theme
    await page.selectOption('select[name="theme"]', 'dark');
    
    // Save settings
    await page.click('text=Save Settings');
    
    // Verify settings are applied
    await page.click('text=Dashboard');
    await expect(page.locator('body')).toHaveClass(/dark/);
    
    // Check currency symbol changed
    await page.click('text=Accounts');
    await page.click('text=Add Account');
    await page.fill('input[name="name"]', 'Euro Account');
    await page.fill('input[name="balance"]', '1000');
    await page.click('button[type="submit"]');
    
    await expect(page.getByText('€1,000.00')).toBeVisible();
  });
});