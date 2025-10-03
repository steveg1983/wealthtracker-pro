import { test, expect } from '@playwright/test';
import { setupTestAuth } from './test-helpers';
import fs from 'fs';

test.describe('Data Export Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage and set up comprehensive test data
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      
      // Set up test accounts
      const accounts = [
        {
          id: 'export-acc-1',
          name: 'Primary Checking',
          type: 'current',
          balance: 12500,
          currency: 'USD',
          createdAt: new Date('2024-01-01').toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'export-acc-2',
          name: 'High Yield Savings',
          type: 'savings',
          balance: 25000,
          currency: 'USD',
          createdAt: new Date('2024-01-01').toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      
      // Set up transactions for export
      const transactions = [
        {
          id: 'export-tx-1',
          accountId: 'export-acc-1',
          amount: 5000,
          type: 'income',
          category: 'salary',
          description: 'Monthly Salary',
          date: new Date('2024-01-15').toISOString(),
          pending: false,
          isReconciled: true,
          tags: ['income', 'recurring']
        },
        {
          id: 'export-tx-2',
          accountId: 'export-acc-1',
          amount: 1200,
          type: 'expense',
          category: 'housing',
          description: 'Rent Payment',
          date: new Date('2024-01-05').toISOString(),
          pending: false,
          isReconciled: true,
          tags: ['bills', 'recurring']
        },
        {
          id: 'export-tx-3',
          accountId: 'export-acc-1',
          amount: 350,
          type: 'expense',
          category: 'groceries',
          description: 'Whole Foods Market',
          date: new Date('2024-01-20').toISOString(),
          pending: false,
          isReconciled: false,
          tags: ['food']
        }
      ];
      
      // Set up budgets
      const budgets = [
        {
          id: 'export-budget-1',
          category: 'housing',
          amount: 1200,
          period: 'monthly',
          startDate: new Date('2024-01-01').toISOString()
        },
        {
          id: 'export-budget-2',
          category: 'groceries',
          amount: 600,
          period: 'monthly',
          startDate: new Date('2024-01-01').toISOString()
        }
      ];
      
      // Set up goals
      const goals = [
        {
          id: 'export-goal-1',
          name: 'Emergency Fund',
          targetAmount: 30000,
          currentAmount: 25000,
          targetDate: new Date('2024-12-31').toISOString(),
          category: 'savings'
        }
      ];
      
      localStorage.setItem('wealthtracker_accounts', JSON.stringify(accounts));
      localStorage.setItem('wealthtracker_transactions', JSON.stringify(transactions));
      localStorage.setItem('wealthtracker_budgets', JSON.stringify(budgets));
      localStorage.setItem('wealthtracker_goals', JSON.stringify(goals));
    });
    
    await page.reload();
  });

  test('Export all data as JSON', async ({ page }) => {
    // Navigate to settings
    await page.getByRole('link', { name: /settings/i }).click();
    
    // Go to data management
    await page.getByRole('link', { name: /data.*management/i }).click();
    await expect(page.getByRole('heading', { name: /data.*management/i })).toBeVisible();

    // Click export button
    await page.getByRole('button', { name: /export.*data/i }).click();

    // Select JSON format
    const formatSelect = page.getByLabel(/format/i);
    if (await formatSelect.isVisible()) {
      await formatSelect.selectOption('json');
    }

    // Select all data option
    const dataTypeSelect = page.getByLabel(/data.*type|what.*export/i);
    if (await dataTypeSelect.isVisible()) {
      await dataTypeSelect.selectOption('all');
    }

    // Set up download promise
    const downloadPromise = page.waitForEvent('download');
    
    // Confirm export
    await page.getByRole('button', { name: /export|download/i }).click();
    
    const download = await downloadPromise;
    
    // Verify download
    expect(download.suggestedFilename()).toContain('wealthtracker');
    expect(download.suggestedFilename()).toMatch(/\.json$/);
    
    // Save and verify content
    const filePath = await download.path();
    if (filePath) {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      // Verify exported data structure
      expect(data).toHaveProperty('accounts');
      expect(data).toHaveProperty('transactions');
      expect(data).toHaveProperty('budgets');
      expect(data).toHaveProperty('goals');
      expect(data.accounts).toHaveLength(2);
      expect(data.transactions).toHaveLength(3);
    }
  });

  test('Export transactions as CSV', async ({ page }) => {
    // Navigate to data management
    await page.goto('/settings/data');

    // Click export
    await page.getByRole('button', { name: /export.*data/i }).click();

    // Select CSV format
    await page.getByLabel(/format/i).selectOption('csv');

    // Select transactions only
    const dataTypeSelect = page.getByLabel(/data.*type|what.*export/i);
    if (await dataTypeSelect.isVisible()) {
      await dataTypeSelect.selectOption('transactions');
    }

    // Set date range
    const dateRangeToggle = page.getByLabel(/date.*range|filter.*date/i);
    if (await dateRangeToggle.isVisible()) {
      await dateRangeToggle.check();
      await page.getByLabel(/start.*date|from/i).fill('2024-01-01');
      await page.getByLabel(/end.*date|to/i).fill('2024-01-31');
    }

    // Download
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /export|download/i }).click();
    
    const download = await downloadPromise;
    
    // Verify CSV file
    expect(download.suggestedFilename()).toMatch(/transactions.*\.csv$/);
    
    // Verify CSV content
    const filePath = await download.path();
    if (filePath) {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      
      // Check CSV headers
      expect(content).toContain('Date,Description,Amount,Type,Category');
      
      // Check data rows
      expect(content).toContain('Monthly Salary');
      expect(content).toContain('5000');
      expect(content).toContain('income');
    }
  });

  test('Export to Excel format', async ({ page }) => {
    // Navigate to data management
    await page.goto('/settings/data');

    // Click export
    await page.getByRole('button', { name: /export.*data/i }).click();

    // Select Excel format
    const formatSelect = page.getByLabel(/format/i);
    await formatSelect.selectOption('excel');

    // Configure export options
    const includeCharts = page.getByLabel(/include.*charts|visualizations/i);
    if (await includeCharts.isVisible()) {
      await includeCharts.check();
    }

    // Download
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /export|download/i }).click();
    
    const download = await downloadPromise;
    
    // Verify Excel file
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  });

  test('Export filtered transactions', async ({ page }) => {
    // Navigate to transactions page
    await page.getByRole('link', { name: /transactions/i }).click();

    // Apply filters
    const categoryFilter = page.getByLabel(/category/i);
    if (await categoryFilter.isVisible()) {
      await categoryFilter.selectOption('expense');
    }

    // Click export from transactions page
    const exportButton = page.getByRole('button', { name: /export/i });
    if (await exportButton.isVisible()) {
      const downloadPromise = page.waitForEvent('download');
      await exportButton.click();
      
      // Confirm filtered export
      const confirmButton = page.getByRole('button', { name: /export.*filtered|yes/i });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
      
      const download = await downloadPromise;
      
      // Verify only filtered data is exported
      const filePath = await download.path();
      if (filePath) {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        
        // Should contain expenses
        expect(content).toContain('Rent Payment');
        expect(content).toContain('Whole Foods Market');
        
        // Should not contain income
        expect(content).not.toContain('Monthly Salary');
      }
    }
  });

  test('Export account summary', async ({ page }) => {
    // Navigate to accounts
    await page.getByRole('link', { name: /accounts/i }).click();

    // Export accounts data
    const exportButton = page.getByRole('button', { name: /export/i });
    if (await exportButton.isVisible()) {
      await exportButton.click();
      
      // Select summary option
      const summaryOption = page.getByLabel(/summary|overview/i);
      if (await summaryOption.isVisible()) {
        await summaryOption.check();
      }
      
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: /download|confirm/i }).click();
      
      const download = await downloadPromise;
      
      // Verify account summary
      expect(download.suggestedFilename()).toContain('account');
    }
  });

  test('Export budget vs actual report', async ({ page }) => {
    // Navigate to budget page
    await page.getByRole('link', { name: /budget/i }).click();

    // Export budget data
    const exportButton = page.getByRole('button', { name: /export/i });
    if (await exportButton.isVisible()) {
      await exportButton.click();
      
      // Include actual spending
      const includeActual = page.getByLabel(/include.*actual|vs.*actual/i);
      if (await includeActual.isVisible()) {
        await includeActual.check();
      }
      
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: /download|export/i }).click();
      
      const download = await downloadPromise;
      
      // Verify budget export
      expect(download.suggestedFilename()).toContain('budget');
    }
  });

  test('Scheduled exports configuration', async ({ page }) => {
    // Navigate to data management
    await page.goto('/settings/data');

    // Look for scheduled exports section
    const scheduledSection = page.getByText(/scheduled.*export|automatic.*export/i);
    if (await scheduledSection.isVisible()) {
      await scheduledSection.click();
      
      // Configure scheduled export
      await page.getByRole('button', { name: /add.*schedule|new.*schedule/i }).click();
      
      // Set schedule details
      await page.getByLabel(/name/i).fill('Monthly Financial Report');
      await page.getByLabel(/frequency/i).selectOption('monthly');
      await page.getByLabel(/day.*month/i).fill('1');
      await page.getByLabel(/format/i).selectOption('pdf');
      
      // Select data to include
      await page.getByLabel(/include.*transactions/i).check();
      await page.getByLabel(/include.*budget/i).check();
      await page.getByLabel(/include.*goals/i).check();
      
      // Set email delivery
      const emailField = page.getByLabel(/email/i);
      if (await emailField.isVisible()) {
        await emailField.fill('user@example.com');
      }
      
      // Save schedule
      await page.getByRole('button', { name: /save|create/i }).click();
      
      // Verify schedule created
      await expect(page.getByText('Monthly Financial Report')).toBeVisible();
    }
  });

  test('Export with custom columns', async ({ page }) => {
    // Navigate to data management
    await page.goto('/settings/data');

    // Click export
    await page.getByRole('button', { name: /export.*data/i }).click();

    // Select custom columns option
    const customizeButton = page.getByRole('button', { name: /customize.*columns|select.*fields/i });
    if (await customizeButton.isVisible()) {
      await customizeButton.click();
      
      // Select specific columns
      await page.getByLabel(/date/i).check();
      await page.getByLabel(/description/i).check();
      await page.getByLabel(/amount/i).check();
      await page.getByLabel(/category/i).check();
      await page.getByLabel(/tags/i).uncheck();
      await page.getByLabel(/notes/i).uncheck();
      
      // Apply column selection
      await page.getByRole('button', { name: /apply|done/i }).click();
    }

    // Export with custom columns
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /export|download/i }).click();
    
    const download = await downloadPromise;
    const filePath = await download.path();
    
    if (filePath) {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      
      // Verify only selected columns are present
      expect(content).toContain('Date');
      expect(content).toContain('Description');
      expect(content).toContain('Amount');
      expect(content).toContain('Category');
      expect(content).not.toContain('Tags');
      expect(content).not.toContain('Notes');
    }
  });

  test('Export for tax purposes', async ({ page }) => {
    // Navigate to data management
    await page.goto('/settings/data');

    // Look for tax export option
    const taxExportButton = page.getByRole('button', { name: /tax.*export|export.*tax/i });
    if (await taxExportButton.isVisible()) {
      await taxExportButton.click();
      
      // Select tax year
      await page.getByLabel(/year|tax.*year/i).selectOption('2024');
      
      // Select tax categories
      const categoriesSection = page.getByText(/deductible.*categories/i);
      if (await categoriesSection.isVisible()) {
        await page.getByLabel(/business/i).check();
        await page.getByLabel(/medical/i).check();
        await page.getByLabel(/charity/i).check();
      }
      
      // Include receipts option
      const includeReceipts = page.getByLabel(/include.*receipts|attachments/i);
      if (await includeReceipts.isVisible()) {
        await includeReceipts.check();
      }
      
      // Export
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: /export|generate/i }).click();
      
      const download = await downloadPromise;
      
      // Verify tax export
      expect(download.suggestedFilename()).toMatch(/tax.*2024/i);
    }
  });

  test('Backup entire application data', async ({ page }) => {
    // Navigate to data management
    await page.goto('/settings/data');

    // Click backup option
    const backupButton = page.getByRole('button', { name: /backup|create.*backup/i });
    if (await backupButton.isVisible()) {
      await backupButton.click();
      
      // Include all data
      const includeAll = page.getByLabel(/include.*everything|full.*backup/i);
      if (await includeAll.isVisible()) {
        await includeAll.check();
      }
      
      // Add backup note
      const noteField = page.getByLabel(/note|description/i);
      if (await noteField.isVisible()) {
        await noteField.fill('Pre-update backup - v1.4.6');
      }
      
      // Create backup
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: /create.*backup|backup.*now/i }).click();
      
      const download = await downloadPromise;
      
      // Verify backup file
      expect(download.suggestedFilename()).toMatch(/backup.*\d{8}/); // Contains date
      expect(download.suggestedFilename()).toMatch(/\.(json|zip)$/);
    }
  });

  test('Export with encryption', async ({ page }) => {
    // Navigate to data management
    await page.goto('/settings/data');

    // Click export
    await page.getByRole('button', { name: /export.*data/i }).click();

    // Enable encryption
    const encryptToggle = page.getByLabel(/encrypt|password.*protect/i);
    if (await encryptToggle.isVisible()) {
      await encryptToggle.check();
      
      // Set password
      await page.getByLabel(/password/i).first().fill('SecurePass123!');
      await page.getByLabel(/confirm.*password/i).fill('SecurePass123!');
      
      // Export with encryption
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: /export|download/i }).click();
      
      const download = await downloadPromise;
      
      // Verify encrypted export
      expect(download.suggestedFilename()).toContain('encrypted');
    }
  });
});