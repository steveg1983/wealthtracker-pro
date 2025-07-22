import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Transaction Import Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage and navigate to app
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    
    // Set up a test account
    await page.evaluate(() => {
      const accounts = [{
        id: 'import-test-1',
        name: 'Import Test Account',
        type: 'current',
        balance: 5000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }];
      localStorage.setItem('wealthtracker_accounts', JSON.stringify(accounts));
    });
  });

  test('CSV import workflow', async ({ page }) => {
    // Navigate to settings
    await page.getByRole('link', { name: /settings/i }).click();
    
    // Go to data management
    await page.getByRole('link', { name: /data.*management/i }).click();
    await expect(page.getByRole('heading', { name: /data.*management/i })).toBeVisible();

    // Click import button
    await page.getByRole('button', { name: /import.*data|import.*csv/i }).click();
    
    // Select CSV import option if there's a choice
    const csvOption = page.getByText(/csv.*import/i);
    if (await csvOption.isVisible()) {
      await csvOption.click();
    }

    // Create test CSV content
    const csvContent = `Date,Description,Amount,Type,Category
2024-01-15,Salary Payment,3500.00,income,salary
2024-01-16,Grocery Store,-125.50,expense,groceries
2024-01-17,Electric Bill,-85.00,expense,utilities
2024-01-18,Restaurant,-45.75,expense,dining`;

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-transactions.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    });

    // Map columns if needed
    const mappingStep = page.getByText(/map.*columns|column.*mapping/i);
    if (await mappingStep.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Verify default mappings are correct
      await expect(page.getByText(/date.*→.*date/i)).toBeVisible();
      await expect(page.getByText(/description.*→.*description/i)).toBeVisible();
      await expect(page.getByText(/amount.*→.*amount/i)).toBeVisible();
      
      // Continue with import
      await page.getByRole('button', { name: /next|continue/i }).click();
    }

    // Select account for import
    const accountSelect = page.getByLabel(/account/i);
    if (await accountSelect.isVisible()) {
      await accountSelect.selectOption('import-test-1');
    }

    // Preview transactions
    await expect(page.getByText('Salary Payment')).toBeVisible();
    await expect(page.getByText('3,500.00')).toBeVisible();
    
    // Complete import
    await page.getByRole('button', { name: /import|finish/i }).click();
    
    // Wait for success message
    await expect(page.getByText(/import.*success|imported.*4.*transactions/i)).toBeVisible();

    // Navigate to transactions to verify
    await page.getByRole('link', { name: /transactions/i }).click();
    
    // Verify imported transactions
    await expect(page.getByText('Salary Payment')).toBeVisible();
    await expect(page.getByText('Grocery Store')).toBeVisible();
    await expect(page.getByText('Electric Bill')).toBeVisible();
    await expect(page.getByText('Restaurant')).toBeVisible();
  });

  test('OFX import workflow', async ({ page }) => {
    // Navigate to data management
    await page.goto('/settings/data');
    
    // Click import button
    await page.getByRole('button', { name: /import.*data/i }).click();
    
    // Select OFX import option
    const ofxOption = page.getByText(/ofx.*import/i);
    if (await ofxOption.isVisible()) {
      await ofxOption.click();
    }

    // Create test OFX content
    const ofxContent = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>CREDIT
            <DTPOSTED>20240115
            <TRNAMT>2500.00
            <NAME>Direct Deposit
            <MEMO>Monthly Salary
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20240116
            <TRNAMT>-150.00
            <NAME>Supermarket
            <MEMO>Weekly groceries
          </STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

    // Upload OFX file
    const fileInput = page.locator('input[type="file"][accept*="ofx"]');
    await fileInput.setInputFiles({
      name: 'test-statement.ofx',
      mimeType: 'application/x-ofx',
      buffer: Buffer.from(ofxContent)
    });

    // Select account
    const accountSelect = page.getByLabel(/account/i);
    if (await accountSelect.isVisible()) {
      await accountSelect.selectOption('import-test-1');
    }

    // Preview and confirm
    await expect(page.getByText('Direct Deposit')).toBeVisible();
    await expect(page.getByText('2,500.00')).toBeVisible();
    
    await page.getByRole('button', { name: /import|confirm/i }).click();
    
    // Verify success
    await expect(page.getByText(/import.*success|imported.*2.*transactions/i)).toBeVisible();
  });

  test('QIF import workflow', async ({ page }) => {
    // Navigate to data management
    await page.goto('/settings/data');
    
    // Click import button
    await page.getByRole('button', { name: /import.*data/i }).click();
    
    // Select QIF import option
    const qifOption = page.getByText(/qif.*import/i);
    if (await qifOption.isVisible()) {
      await qifOption.click();
    }

    // Create test QIF content
    const qifContent = `!Type:Bank
D1/20/2024
PPaycheck
T1500.00
^
D1/21/2024
PGas Station
T-45.50
^
D1/22/2024
POnline Shopping
T-125.00
^`;

    // Upload QIF file
    const fileInput = page.locator('input[type="file"][accept*="qif"]');
    await fileInput.setInputFiles({
      name: 'test-transactions.qif',
      mimeType: 'application/qif',
      buffer: Buffer.from(qifContent)
    });

    // Select account and date format
    const accountSelect = page.getByLabel(/account/i);
    if (await accountSelect.isVisible()) {
      await accountSelect.selectOption('import-test-1');
    }

    // Select date format if needed
    const dateFormatSelect = page.getByLabel(/date.*format/i);
    if (await dateFormatSelect.isVisible()) {
      await dateFormatSelect.selectOption('MM/DD/YYYY');
    }

    // Preview and import
    await expect(page.getByText('Paycheck')).toBeVisible();
    await expect(page.getByText('1,500.00')).toBeVisible();
    
    await page.getByRole('button', { name: /import|confirm/i }).click();
    
    // Verify success
    await expect(page.getByText(/import.*success|imported.*3.*transactions/i)).toBeVisible();
  });

  test('Duplicate detection during import', async ({ page }) => {
    // First, add some existing transactions
    await page.evaluate(() => {
      const existingTransactions = [{
        id: 'existing-1',
        accountId: 'import-test-1',
        amount: 3500,
        type: 'income',
        category: 'salary',
        description: 'Salary Payment',
        date: new Date('2024-01-15').toISOString(),
        pending: false,
        isReconciled: false
      }];
      localStorage.setItem('wealthtracker_transactions', JSON.stringify(existingTransactions));
    });

    // Navigate to import
    await page.goto('/settings/data');
    await page.getByRole('button', { name: /import.*data/i }).click();

    // Create CSV with duplicate
    const csvContent = `Date,Description,Amount,Type,Category
2024-01-15,Salary Payment,3500.00,income,salary
2024-01-16,New Transaction,100.00,income,other`;

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-with-duplicates.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    });

    // Select account
    const accountSelect = page.getByLabel(/account/i);
    if (await accountSelect.isVisible()) {
      await accountSelect.selectOption('import-test-1');
    }

    // Check for duplicate warning
    await expect(page.getByText(/duplicate.*detected|1.*duplicate/i)).toBeVisible();
    
    // Should show option to skip duplicates
    const skipDuplicates = page.getByLabel(/skip.*duplicate/i);
    if (await skipDuplicates.isVisible()) {
      await skipDuplicates.check();
    }

    // Import
    await page.getByRole('button', { name: /import|continue/i }).click();
    
    // Should only import 1 new transaction
    await expect(page.getByText(/imported.*1.*transaction/i)).toBeVisible();
  });

  test('Import with category mapping', async ({ page }) => {
    // Navigate to import
    await page.goto('/settings/data');
    await page.getByRole('button', { name: /import.*data/i }).click();

    // Create CSV with custom categories
    const csvContent = `Date,Description,Amount,Type,Category
2024-01-15,Salary,3500.00,income,Employment
2024-01-16,Groceries,-125.50,expense,Food & Dining
2024-01-17,Netflix,-15.99,expense,Subscriptions`;

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-categories.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    });

    // Check if category mapping is needed
    const categoryMapping = page.getByText(/map.*categories|category.*mapping/i);
    if (await categoryMapping.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Map Employment -> salary
      const employmentSelect = page.getByLabel(/Employment/i);
      if (await employmentSelect.isVisible()) {
        await employmentSelect.selectOption('salary');
      }

      // Map Food & Dining -> groceries
      const foodSelect = page.getByLabel(/Food.*Dining/i);
      if (await foodSelect.isVisible()) {
        await foodSelect.selectOption('groceries');
      }

      // Map Subscriptions -> entertainment
      const subSelect = page.getByLabel(/Subscriptions/i);
      if (await subSelect.isVisible()) {
        await subSelect.selectOption('entertainment');
      }

      await page.getByRole('button', { name: /next|continue/i }).click();
    }

    // Select account
    const accountSelect = page.getByLabel(/account/i);
    if (await accountSelect.isVisible()) {
      await accountSelect.selectOption('import-test-1');
    }

    // Complete import
    await page.getByRole('button', { name: /import|finish/i }).click();
    
    // Verify success
    await expect(page.getByText(/import.*success/i)).toBeVisible();

    // Navigate to transactions to verify categories
    await page.getByRole('link', { name: /transactions/i }).click();
    
    // Verify categories were mapped correctly
    const salaryTx = page.locator('tr', { hasText: 'Salary' });
    await expect(salaryTx.getByText(/salary/i)).toBeVisible();
    
    const groceriesTx = page.locator('tr', { hasText: 'Groceries' });
    await expect(groceriesTx.getByText(/groceries/i)).toBeVisible();
  });

  test('Import error handling', async ({ page }) => {
    // Navigate to import
    await page.goto('/settings/data');
    await page.getByRole('button', { name: /import.*data/i }).click();

    // Create invalid CSV content
    const invalidCsvContent = `This is not valid CSV data
Random text here
No proper formatting`;

    // Upload invalid file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'invalid.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(invalidCsvContent)
    });

    // Should show error message
    await expect(page.getByText(/error.*invalid.*format|unable.*parse/i)).toBeVisible();

    // Try with empty file
    await fileInput.setInputFiles({
      name: 'empty.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('')
    });

    await expect(page.getByText(/empty.*file|no.*data/i)).toBeVisible();
  });

  test('Import progress for large files', async ({ page }) => {
    // Navigate to import
    await page.goto('/settings/data');
    await page.getByRole('button', { name: /import.*data/i }).click();

    // Create large CSV content (1000 transactions)
    let largeCsvContent = 'Date,Description,Amount,Type,Category\n';
    for (let i = 1; i <= 1000; i++) {
      const date = new Date(2024, 0, Math.floor(i / 30) + 1).toISOString().split('T')[0];
      const amount = (Math.random() * 1000).toFixed(2);
      const type = Math.random() > 0.3 ? 'expense' : 'income';
      largeCsvContent += `${date},Transaction ${i},${type === 'expense' ? '-' : ''}${amount},${type},${type === 'income' ? 'salary' : 'shopping'}\n`;
    }

    // Upload large file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'large-import.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(largeCsvContent)
    });

    // Select account
    const accountSelect = page.getByLabel(/account/i);
    if (await accountSelect.isVisible()) {
      await accountSelect.selectOption('import-test-1');
    }

    // Start import
    await page.getByRole('button', { name: /import|start/i }).click();

    // Should show progress indicator
    await expect(page.getByRole('progressbar')).toBeVisible();
    
    // Wait for completion
    await expect(page.getByText(/import.*complete|imported.*1000/i)).toBeVisible({ timeout: 30000 });
  });
});