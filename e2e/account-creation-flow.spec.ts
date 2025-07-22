import { test, expect } from '@playwright/test';

test.describe('Account Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage and navigate to the app
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    
    // Navigate to accounts page - use menuitem role
    await page.getByRole('menuitem', { name: /Navigate to Accounts/i }).click();
    // Wait for navigation to complete
    await page.waitForURL('**/accounts');
    await expect(page.getByRole('heading', { name: 'Accounts', exact: true })).toBeVisible();
  });

  test('should display accounts page with add account option', async ({ page }) => {
    // The page already has test accounts, so we'll verify the page structure
    // Check that we're on the accounts page
    await expect(page.getByRole('heading', { name: 'Accounts', exact: true })).toBeVisible();
    
    // Look for account sections - these should exist
    await expect(page.getByRole('heading', { name: /Current Accounts/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Savings Accounts/i })).toBeVisible();
    
    // Verify the add account button exists
    await expect(page.locator('[title="Add Account"]')).toBeVisible();
  });

  test('should create a checking account successfully', async ({ page }) => {
    // Click add account icon in the header
    await page.locator('[title="Add Account"]').click();
    
    // Wait for modal to open
    await expect(page.getByRole('dialog', { name: 'Add New Account' })).toBeVisible();
    
    // Fill in account details
    await page.getByRole('textbox').first().fill('Primary Checking'); // Account Name field
    await page.getByRole('combobox').first().selectOption('current'); // Account Type
    await page.getByRole('spinbutton').fill('2500.50'); // Current Balance
    await page.getByRole('combobox').nth(1).selectOption('USD $'); // Currency
    await page.getByRole('textbox').nth(1).fill('Chase Bank'); // Institution
    
    // Submit form
    await page.getByRole('button', { name: 'Add Account' }).click();
    
    // Verify account appears in the list
    await expect(page.getByText('Primary Checking')).toBeVisible();
    await expect(page.getByText('Chase Bank')).toBeVisible();
    
    // Verify the balance - be more specific to avoid multiple matches
    const accountSection = page.locator('h3:has-text("Primary Checking")').locator('..');
    await expect(accountSection.getByText('$2,500.50')).toBeVisible();
  });

  test('should create multiple account types', async ({ page }) => {
    const accounts = [
      {
        name: 'Emergency Savings',
        type: 'savings',
        balance: '10000',
        currency: 'GBP £',
        institution: 'Ally Bank'
      },
      {
        name: 'Travel Card',
        type: 'credit',
        balance: '-1500',
        currency: 'USD $',
        institution: 'Chase'
      }
    ];

    for (const account of accounts) {
      // Add account
      await page.locator('[title="Add Account"]').click();
      await expect(page.getByRole('dialog', { name: 'Add New Account' })).toBeVisible();
      
      await page.getByRole('textbox').first().fill(account.name);
      await page.getByRole('combobox').first().selectOption(account.type);
      await page.getByRole('spinbutton').fill(account.balance);
      await page.getByRole('combobox').nth(1).selectOption(account.currency);
      await page.getByRole('textbox').nth(1).fill(account.institution);
      
      await page.getByRole('button', { name: 'Add Account' }).click();
      
      // Wait for modal to close
      await expect(page.getByRole('dialog')).not.toBeVisible();
      
      // Verify account was added
      await expect(page.getByText(account.name)).toBeVisible();
    }
  });

  test('should validate required fields', async ({ page }) => {
    // Click add account button
    await page.locator('[title="Add Account"]').click();
    await expect(page.getByRole('dialog', { name: 'Add New Account' })).toBeVisible();
    
    // Try to submit without filling required fields
    await page.getByRole('button', { name: 'Add Account' }).click();
    
    // The form should still be open (validation failed)
    await expect(page.getByRole('dialog', { name: 'Add New Account' })).toBeVisible();
    
    // Fill in the account name and try again
    await page.getByRole('textbox').first().fill('Test Account');
    await page.getByRole('button', { name: 'Add Account' }).click();
    
    // Modal should close after successful submission
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText('Test Account')).toBeVisible();
  });

  test('should allow editing an existing account', async ({ page }) => {
    // Find an existing account and click its settings button
    const firstAccount = page.getByRole('heading', { level: 3 }).first();
    const accountName = await firstAccount.textContent();
    
    // Click the account settings button for the first account
    const accountCard = firstAccount.locator('..');
    await accountCard.getByRole('button', { name: 'Account Settings' }).click();
    
    // Wait for settings modal to open
    await expect(page.getByRole('dialog')).toBeVisible();
    
    // Update account name
    const nameInput = page.getByRole('textbox').first();
    await nameInput.clear();
    await nameInput.fill('Updated Account Name');
    
    // Save changes
    await page.getByRole('button', { name: /save|update/i }).click();
    
    // Verify changes
    await expect(page.getByText('Updated Account Name')).toBeVisible();
    await expect(page.getByText(accountName!)).not.toBeVisible();
  });

  test('should handle account deletion', async ({ page }) => {
    // First, create a test account to delete
    await page.locator('[title="Add Account"]').click();
    await page.getByRole('textbox').first().fill('Account to Delete');
    await page.getByRole('combobox').first().selectOption('savings');
    await page.getByRole('spinbutton').fill('5000');
    await page.getByRole('button', { name: 'Add Account' }).click();
    
    // Wait for account to appear
    await expect(page.getByText('Account to Delete')).toBeVisible();
    
    // Find and click delete button for this account
    const accountCard = page.locator('h3:has-text("Account to Delete")').locator('..');
    await accountCard.getByRole('button', { name: 'Delete Account' }).click();
    
    // Confirm deletion if there's a confirmation dialog
    const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i });
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }
    
    // Verify account is gone
    await expect(page.getByText('Account to Delete')).not.toBeVisible();
  });

  test('should persist accounts after page reload', async ({ page }) => {
    // Create an account
    await page.locator('[title="Add Account"]').click();
    await page.getByRole('textbox').first().fill('Persistent Account');
    await page.getByRole('combobox').first().selectOption('current');
    await page.getByRole('spinbutton').fill('7500');
    await page.getByRole('button', { name: 'Add Account' }).click();
    
    // Wait for account to appear
    await expect(page.getByText('Persistent Account')).toBeVisible();
    
    // Reload page
    await page.reload();
    
    // Account should still be there
    await expect(page.getByText('Persistent Account')).toBeVisible();
  });

  test('should handle different currencies correctly', async ({ page }) => {
    const currencies = [
      { code: 'GBP £', symbol: '£', amount: '1000' },
      { code: 'USD $', symbol: '$', amount: '1500' },
      { code: 'EUR €', symbol: '€', amount: '2000' }
    ];

    for (const currency of currencies) {
      await page.locator('[title="Add Account"]').click();
      
      await page.getByRole('textbox').first().fill(`${currency.code} Account`);
      await page.getByRole('combobox').first().selectOption('savings');
      await page.getByRole('spinbutton').fill(currency.amount);
      await page.getByRole('combobox').nth(1).selectOption(currency.code);
      await page.getByRole('textbox').nth(1).fill('Test Bank');
      
      await page.getByRole('button', { name: 'Add Account' }).click();
      
      // Verify account shows with correct currency
      const accountCard = page.locator(`h3:has-text("${currency.code} Account")`).locator('..');
      await expect(accountCard.getByText(new RegExp(`\\${currency.symbol}`))).toBeVisible();
    }
  });
});