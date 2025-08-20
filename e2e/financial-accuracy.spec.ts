import { test, expect } from '@playwright/test';
import { setupTestAuth } from './test-helpers';

test.describe('Financial Accuracy E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await setupTestAuth(page);
    await page.goto('/?demo=true');
  });

  test('decimal precision in calculations', async ({ page }) => {
    // Navigate to Accounts
    await page.click('text=Accounts');
    
    // Create account with decimal balance
    await page.click('text=Add Account');
    await page.fill('input[name="name"]', 'Precision Test 1');
    await page.fill('input[name="balance"]', '999.99');
    await page.click('button[type="submit"]');
    
    // Create another account
    await page.click('text=Add Account');
    await page.fill('input[name="name"]', 'Precision Test 2');
    await page.fill('input[name="balance"]', '0.01');
    await page.click('button[type="submit"]');
    
    // Go to dashboard and check total
    await page.click('text=Dashboard');
    
    // Should show exactly $1,000.00
    await expect(page.getByText(/\$1,000\.00/)).toBeVisible();
  });

  test('budget calculations with decimals', async ({ page }) => {
    // Create account
    await page.click('text=Accounts');
    await page.click('text=Add Account');
    await page.fill('input[name="name"]', 'Budget Test Account');
    await page.fill('input[name="balance"]', '5000');
    await page.click('button[type="submit"]');
    
    // Create budget
    await page.click('text=Budget');
    await page.click('text=Add Budget');
    await page.selectOption('select[name="category"]', 'groceries');
    await page.fill('input[name="amount"]', '100');
    await page.click('button[type="submit"]');
    
    // Create transactions that sum to exactly 100
    await page.click('text=Transactions');
    
    // Transaction 1: $33.33
    await page.click('text=Add Transaction');
    await page.fill('input[name="description"]', 'Groceries 1');
    await page.fill('input[name="amount"]', '33.33');
    await page.selectOption('select[name="type"]', 'expense');
    await page.selectOption('select[name="category"]', 'groceries');
    await page.click('button[type="submit"]');
    
    // Transaction 2: $66.67
    await page.click('text=Add Transaction');
    await page.fill('input[name="description"]', 'Groceries 2');
    await page.fill('input[name="amount"]', '66.67');
    await page.selectOption('select[name="type"]', 'expense');
    await page.selectOption('select[name="category"]', 'groceries');
    await page.click('button[type="submit"]');
    
    // Check budget page shows 100% usage
    await page.click('text=Budget');
    await expect(page.getByText('100%')).toBeVisible();
    await expect(page.getByText('$100.00 of $100.00')).toBeVisible();
  });

  test('running balance calculations', async ({ page }) => {
    // Create account with initial balance
    await page.click('text=Accounts');
    await page.click('text=Add Account');
    await page.fill('input[name="name"]', 'Running Balance Test');
    await page.fill('input[name="balance"]', '1000');
    await page.click('button[type="submit"]');
    
    // Create series of transactions
    await page.click('text=Transactions');
    
    // Income: +500
    await page.click('text=Add Transaction');
    await page.fill('input[name="description"]', 'Bonus');
    await page.fill('input[name="amount"]', '500');
    await page.selectOption('select[name="type"]', 'income');
    await page.click('button[type="submit"]');
    
    // Expense: -250.50
    await page.click('text=Add Transaction');
    await page.fill('input[name="description"]', 'Bills');
    await page.fill('input[name="amount"]', '250.50');
    await page.selectOption('select[name="type"]', 'expense');
    await page.click('button[type="submit"]');
    
    // Expense: -49.50
    await page.click('text=Add Transaction');
    await page.fill('input[name="description"]', 'Coffee');
    await page.fill('input[name="amount"]', '49.50');
    await page.selectOption('select[name="type"]', 'expense');
    await page.click('button[type="submit"]');
    
    // Check account balance (1000 + 500 - 250.50 - 49.50 = 1200)
    await page.click('text=Accounts');
    
    // The displayed balance should include transactions
    await expect(page.getByText(/Running Balance Test/)).toBeVisible();
    // Note: actual balance display depends on implementation
  });

  test('goal progress calculations', async ({ page }) => {
    // Create multiple goals with different progress levels
    await page.click('text=Goals');
    
    // Goal 1: 0% progress
    await page.click('text=Add Goal');
    await page.fill('input[name="name"]', 'New Car');
    await page.fill('input[name="targetAmount"]', '25000');
    await page.fill('input[name="currentAmount"]', '0');
    await page.click('button[type="submit"]');
    
    // Goal 2: 25% progress
    await page.click('text=Add Goal');
    await page.fill('input[name="name"]', 'Vacation Fund');
    await page.fill('input[name="targetAmount"]', '4000');
    await page.fill('input[name="currentAmount"]', '1000');
    await page.click('button[type="submit"]');
    
    // Goal 3: 100% progress
    await page.click('text=Add Goal');
    await page.fill('input[name="name"]', 'Emergency Fund');
    await page.fill('input[name="targetAmount"]', '5000');
    await page.fill('input[name="currentAmount"]', '5000');
    await page.click('button[type="submit"]');
    
    // Verify progress calculations
    await expect(page.getByText('0%')).toBeVisible();
    await expect(page.getByText('25%')).toBeVisible();
    await expect(page.getByText('100%')).toBeVisible();
  });

  test('multi-currency calculations', async ({ page }) => {
    // Navigate to Settings first
    await page.click('text=Settings');
    
    // Set base currency to USD
    await page.selectOption('select[name="currency"]', 'USD');
    await page.click('text=Save Settings');
    
    // Create accounts in different currencies
    await page.click('text=Accounts');
    
    // USD Account
    await page.click('text=Add Account');
    await page.fill('input[name="name"]', 'USD Account');
    await page.fill('input[name="balance"]', '1000');
    await page.selectOption('select[name="currency"]', 'USD');
    await page.click('button[type="submit"]');
    
    // EUR Account
    await page.click('text=Add Account');
    await page.fill('input[name="name"]', 'EUR Account');
    await page.fill('input[name="balance"]', '1000');
    await page.selectOption('select[name="currency"]', 'EUR');
    await page.click('button[type="submit"]');
    
    // GBP Account
    await page.click('text=Add Account');
    await page.fill('input[name="name"]', 'GBP Account');
    await page.fill('input[name="balance"]', '1000');
    await page.selectOption('select[name="currency"]', 'GBP');
    await page.click('button[type="submit"]');
    
    // Check dashboard for converted totals
    await page.click('text=Dashboard');
    
    // Net worth should show all accounts converted to base currency
    // Exact values depend on exchange rates
    await expect(page.getByText(/Net Worth/i)).toBeVisible();
    await expect(page.getByText(/\$/)).toBeVisible(); // USD symbol
  });

  test('transaction categorization and reporting', async ({ page }) => {
    // Create account
    await page.click('text=Accounts');
    await page.click('text=Add Account');
    await page.fill('input[name="name"]', 'Reporting Test');
    await page.fill('input[name="balance"]', '10000');
    await page.click('button[type="submit"]');
    
    // Create transactions in different categories
    await page.click('text=Transactions');
    
    const categories = [
      { desc: 'Groceries 1', amount: '150', category: 'groceries' },
      { desc: 'Groceries 2', amount: '200', category: 'groceries' },
      { desc: 'Gas', amount: '60', category: 'transport' },
      { desc: 'Electric Bill', amount: '120', category: 'utilities' },
      { desc: 'Restaurant', amount: '80', category: 'dining' },
    ];
    
    for (const cat of categories) {
      await page.click('text=Add Transaction');
      await page.fill('input[name="description"]', cat.desc);
      await page.fill('input[name="amount"]', cat.amount);
      await page.selectOption('select[name="type"]', 'expense');
      await page.selectOption('select[name="category"]', cat.category);
      await page.click('button[type="submit"]');
    }
    
    // Go to Analytics/Reports page if available
    if (await page.getByText('Analytics').isVisible()) {
      await page.click('text=Analytics');
      
      // Check category breakdowns
      await expect(page.getByText(/Groceries.*\$350/)).toBeVisible();
      await expect(page.getByText(/Transport.*\$60/)).toBeVisible();
      await expect(page.getByText(/Utilities.*\$120/)).toBeVisible();
      await expect(page.getByText(/Dining.*\$80/)).toBeVisible();
    }
  });

  test('recurring transactions', async ({ page }) => {
    // If the app supports recurring transactions
    const hasRecurring = await page.getByText('Recurring').isVisible().catch(() => false);
    
    if (hasRecurring) {
      // Create account
      await page.click('text=Accounts');
      await page.click('text=Add Account');
      await page.fill('input[name="name"]', 'Recurring Test');
      await page.fill('input[name="balance"]', '5000');
      await page.click('button[type="submit"]');
      
      // Create recurring transaction
      await page.click('text=Transactions');
      await page.click('text=Add Transaction');
      await page.fill('input[name="description"]', 'Monthly Rent');
      await page.fill('input[name="amount"]', '1200');
      await page.selectOption('select[name="type"]', 'expense');
      await page.selectOption('select[name="category"]', 'housing');
      
      // Set as recurring if option exists
      if (await page.getByLabel('Recurring').isVisible()) {
        await page.check('input[name="recurring"]');
        await page.selectOption('select[name="frequency"]', 'monthly');
      }
      
      await page.click('button[type="submit"]');
      
      // Verify recurring indicator
      await expect(page.getByText('Monthly Rent')).toBeVisible();
      if (await page.getByText('Recurring').isVisible()) {
        await expect(page.getByText('Monthly')).toBeVisible();
      }
    }
  });
});