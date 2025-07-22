import { test, expect } from '@playwright/test';

test.describe('Report Generation Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage and set up test data
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      
      // Set up test accounts
      const accounts = [
        {
          id: 'report-acc-1',
          name: 'Checking Account',
          type: 'current',
          balance: 5000,
          createdAt: new Date('2024-01-01').toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'report-acc-2',
          name: 'Savings Account',
          type: 'savings',
          balance: 10000,
          createdAt: new Date('2024-01-01').toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      
      // Set up test transactions for reports
      const transactions = [
        // Income transactions
        {
          id: 'tx-1',
          accountId: 'report-acc-1',
          amount: 5000,
          type: 'income',
          category: 'salary',
          description: 'January Salary',
          date: new Date('2024-01-15').toISOString(),
          pending: false,
          isReconciled: true
        },
        {
          id: 'tx-2',
          accountId: 'report-acc-1',
          amount: 500,
          type: 'income',
          category: 'freelance',
          description: 'Freelance Project',
          date: new Date('2024-01-20').toISOString(),
          pending: false,
          isReconciled: true
        },
        // Expense transactions
        {
          id: 'tx-3',
          accountId: 'report-acc-1',
          amount: 1200,
          type: 'expense',
          category: 'housing',
          description: 'Rent Payment',
          date: new Date('2024-01-05').toISOString(),
          pending: false,
          isReconciled: true
        },
        {
          id: 'tx-4',
          accountId: 'report-acc-1',
          amount: 300,
          type: 'expense',
          category: 'groceries',
          description: 'Grocery Shopping',
          date: new Date('2024-01-10').toISOString(),
          pending: false,
          isReconciled: true
        },
        {
          id: 'tx-5',
          accountId: 'report-acc-1',
          amount: 150,
          type: 'expense',
          category: 'utilities',
          description: 'Electric Bill',
          date: new Date('2024-01-12').toISOString(),
          pending: false,
          isReconciled: true
        },
        // Transfer between accounts
        {
          id: 'tx-6',
          accountId: 'report-acc-1',
          amount: 1000,
          type: 'transfer',
          category: 'transfer',
          description: 'Transfer to Savings',
          date: new Date('2024-01-25').toISOString(),
          pending: false,
          isReconciled: true,
          transferAccountId: 'report-acc-2'
        }
      ];
      
      // Set up budgets for budget vs actual report
      const budgets = [
        {
          id: 'budget-1',
          category: 'housing',
          amount: 1200,
          period: 'monthly',
          startDate: new Date('2024-01-01').toISOString()
        },
        {
          id: 'budget-2',
          category: 'groceries',
          amount: 500,
          period: 'monthly',
          startDate: new Date('2024-01-01').toISOString()
        },
        {
          id: 'budget-3',
          category: 'utilities',
          amount: 200,
          period: 'monthly',
          startDate: new Date('2024-01-01').toISOString()
        }
      ];
      
      localStorage.setItem('wealthtracker_accounts', JSON.stringify(accounts));
      localStorage.setItem('wealthtracker_transactions', JSON.stringify(transactions));
      localStorage.setItem('wealthtracker_budgets', JSON.stringify(budgets));
    });
    
    await page.reload();
  });

  test('Generate income vs expenses report', async ({ page }) => {
    // Navigate to reports
    await page.getByRole('link', { name: /reports/i }).click();
    await expect(page.getByRole('heading', { name: /reports/i })).toBeVisible();

    // Select income vs expenses report
    await page.getByRole('button', { name: /income.*expense|profit.*loss/i }).click();

    // Set date range
    const startDate = page.getByLabel(/start.*date|from/i);
    const endDate = page.getByLabel(/end.*date|to/i);
    
    if (await startDate.isVisible()) {
      await startDate.fill('2024-01-01');
      await endDate.fill('2024-01-31');
    }

    // Generate report
    await page.getByRole('button', { name: /generate|view.*report/i }).click();

    // Verify report shows correct data
    await expect(page.getByText(/total.*income.*5,500/i)).toBeVisible();
    await expect(page.getByText(/total.*expense.*1,650/i)).toBeVisible();
    await expect(page.getByText(/net.*income.*3,850/i)).toBeVisible();

    // Check for visualization
    await expect(page.locator('canvas, svg').first()).toBeVisible();

    // Export report
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /export|download/i }).click();
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toMatch(/income.*expense|report/i);
  });

  test('Generate category breakdown report', async ({ page }) => {
    // Navigate to reports
    await page.getByRole('link', { name: /reports/i }).click();

    // Select category breakdown
    await page.getByRole('button', { name: /category.*breakdown|spending.*category/i }).click();

    // Set parameters
    const periodSelect = page.getByLabel(/period|timeframe/i);
    if (await periodSelect.isVisible()) {
      await periodSelect.selectOption('monthly');
    }

    // Generate report
    await page.getByRole('button', { name: /generate|view/i }).click();

    // Verify categories are shown
    await expect(page.getByText(/housing.*1,200/i)).toBeVisible();
    await expect(page.getByText(/groceries.*300/i)).toBeVisible();
    await expect(page.getByText(/utilities.*150/i)).toBeVisible();

    // Check for pie chart or bar chart
    await expect(page.locator('canvas, svg').first()).toBeVisible();

    // Test drill-down functionality
    const housingCategory = page.getByText(/housing.*1,200/i);
    if (await housingCategory.isVisible()) {
      await housingCategory.click();
      // Should show transaction details
      await expect(page.getByText('Rent Payment')).toBeVisible();
    }
  });

  test('Generate budget vs actual report', async ({ page }) => {
    // Navigate to reports
    await page.getByRole('link', { name: /reports/i }).click();

    // Select budget vs actual
    await page.getByRole('button', { name: /budget.*actual|budget.*comparison/i }).click();

    // Select month
    const monthSelect = page.getByLabel(/month|period/i);
    if (await monthSelect.isVisible()) {
      await monthSelect.selectOption('2024-01');
    }

    // Generate report
    await page.getByRole('button', { name: /generate|view/i }).click();

    // Verify budget comparisons
    await expect(page.getByText(/housing.*budget.*1,200/i)).toBeVisible();
    await expect(page.getByText(/housing.*actual.*1,200/i)).toBeVisible();
    await expect(page.getByText(/housing.*100%/i)).toBeVisible();

    await expect(page.getByText(/groceries.*budget.*500/i)).toBeVisible();
    await expect(page.getByText(/groceries.*actual.*300/i)).toBeVisible();
    await expect(page.getByText(/groceries.*60%/i)).toBeVisible();

    // Check for visual indicators (progress bars)
    await expect(page.locator('[role="progressbar"]').first()).toBeVisible();
  });

  test('Generate cash flow report', async ({ page }) => {
    // Navigate to reports
    await page.getByRole('link', { name: /reports/i }).click();

    // Select cash flow report
    await page.getByRole('button', { name: /cash.*flow/i }).click();

    // Set time period
    const timePeriod = page.getByLabel(/period|timeframe/i);
    if (await timePeriod.isVisible()) {
      await timePeriod.selectOption('monthly');
    }

    // Generate report
    await page.getByRole('button', { name: /generate|view/i }).click();

    // Verify cash flow data
    await expect(page.getByText(/opening.*balance/i)).toBeVisible();
    await expect(page.getByText(/income.*5,500/i)).toBeVisible();
    await expect(page.getByText(/expenses.*1,650/i)).toBeVisible();
    await expect(page.getByText(/net.*flow.*3,850/i)).toBeVisible();
    await expect(page.getByText(/closing.*balance/i)).toBeVisible();

    // Check for cash flow chart
    await expect(page.locator('canvas, svg').first()).toBeVisible();
  });

  test('Generate net worth report', async ({ page }) => {
    // Navigate to reports
    await page.getByRole('link', { name: /reports/i }).click();

    // Select net worth report
    await page.getByRole('button', { name: /net.*worth/i }).click();

    // Generate report
    await page.getByRole('button', { name: /generate|view/i }).click();

    // Verify net worth calculation
    await expect(page.getByText(/total.*assets.*15,000/i)).toBeVisible();
    await expect(page.getByText(/checking.*5,000/i)).toBeVisible();
    await expect(page.getByText(/savings.*10,000/i)).toBeVisible();
    
    // Check for net worth trend chart
    await expect(page.locator('canvas, svg').first()).toBeVisible();
  });

  test('Generate tax summary report', async ({ page }) => {
    // Navigate to reports
    await page.getByRole('link', { name: /reports/i }).click();

    // Select tax summary if available
    const taxButton = page.getByRole('button', { name: /tax.*summary|tax.*report/i });
    if (await taxButton.isVisible()) {
      await taxButton.click();

      // Select tax year
      const yearSelect = page.getByLabel(/year|tax.*year/i);
      if (await yearSelect.isVisible()) {
        await yearSelect.selectOption('2024');
      }

      // Generate report
      await page.getByRole('button', { name: /generate|view/i }).click();

      // Verify tax-related information
      await expect(page.getByText(/income.*5,500/i)).toBeVisible();
      await expect(page.getByText(/deductible|business.*expense/i)).toBeVisible();
    }
  });

  test('Custom date range report', async ({ page }) => {
    // Navigate to reports
    await page.getByRole('link', { name: /reports/i }).click();

    // Select any report type
    await page.getByRole('button', { name: /income.*expense/i }).click();

    // Select custom date range
    const dateRangeSelect = page.getByLabel(/date.*range|period/i);
    if (await dateRangeSelect.isVisible()) {
      await dateRangeSelect.selectOption('custom');
    }

    // Set custom dates
    await page.getByLabel(/start.*date|from/i).fill('2024-01-10');
    await page.getByLabel(/end.*date|to/i).fill('2024-01-20');

    // Generate report
    await page.getByRole('button', { name: /generate|view/i }).click();

    // Verify only transactions in date range are included
    await expect(page.getByText('Freelance Project')).toBeVisible();
    await expect(page.getByText('Grocery Shopping')).toBeVisible();
    await expect(page.getByText('Electric Bill')).toBeVisible();
    
    // Should not include transactions outside range
    await expect(page.getByText('Rent Payment')).not.toBeVisible();
  });

  test('Print report', async ({ page }) => {
    // Navigate to reports
    await page.getByRole('link', { name: /reports/i }).click();

    // Generate any report
    await page.getByRole('button', { name: /income.*expense/i }).click();
    await page.getByRole('button', { name: /generate|view/i }).click();

    // Mock print dialog
    await page.evaluate(() => {
      window.print = () => {
        window.printCalled = true;
      };
    });

    // Click print button
    await page.getByRole('button', { name: /print/i }).click();

    // Verify print was called
    const printCalled = await page.evaluate(() => window.printCalled);
    expect(printCalled).toBe(true);
  });

  test('Report filtering and customization', async ({ page }) => {
    // Navigate to reports
    await page.getByRole('link', { name: /reports/i }).click();

    // Select a report
    await page.getByRole('button', { name: /category.*breakdown/i }).click();

    // Test account filtering
    const accountFilter = page.getByLabel(/account/i);
    if (await accountFilter.isVisible()) {
      await accountFilter.selectOption('report-acc-1');
    }

    // Test category filtering
    const categoryFilter = page.getByLabel(/categories/i);
    if (await categoryFilter.isVisible()) {
      // Select only specific categories
      await categoryFilter.click();
      await page.getByRole('option', { name: /housing/i }).click();
      await page.getByRole('option', { name: /groceries/i }).click();
      await page.keyboard.press('Escape');
    }

    // Generate filtered report
    await page.getByRole('button', { name: /generate|view/i }).click();

    // Verify filtered results
    await expect(page.getByText(/housing.*1,200/i)).toBeVisible();
    await expect(page.getByText(/groceries.*300/i)).toBeVisible();
    await expect(page.getByText(/utilities/i)).not.toBeVisible();
  });

  test('Save report preferences', async ({ page }) => {
    // Navigate to reports
    await page.getByRole('link', { name: /reports/i }).click();

    // Configure a report
    await page.getByRole('button', { name: /income.*expense/i }).click();
    
    // Set preferences
    const periodSelect = page.getByLabel(/period/i);
    if (await periodSelect.isVisible()) {
      await periodSelect.selectOption('quarterly');
    }

    // Save as favorite or template
    const saveButton = page.getByRole('button', { name: /save.*preference|save.*template/i });
    if (await saveButton.isVisible()) {
      await saveButton.click();
      
      // Name the saved report
      const nameInput = page.getByLabel(/name|title/i);
      if (await nameInput.isVisible()) {
        await nameInput.fill('Quarterly Income Report');
        await page.getByRole('button', { name: /save|confirm/i }).click();
      }

      // Verify saved
      await expect(page.getByText(/saved|preference.*saved/i)).toBeVisible();
    }
  });
});