import { test, expect } from '@playwright/test';

test.describe('Recurring Transactions Management', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage and set up test data
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      
      // Set up test accounts
      const accounts = [
        {
          id: 'recurring-acc-1',
          name: 'Main Checking',
          type: 'current',
          balance: 10000,
          createdAt: new Date('2024-01-01').toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'recurring-acc-2',
          name: 'Credit Card',
          type: 'credit',
          balance: -1500,
          createdAt: new Date('2024-01-01').toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      
      // Set up existing recurring transactions
      const recurringTransactions = [
        {
          id: 'recurring-1',
          accountId: 'recurring-acc-1',
          amount: 3500,
          type: 'income',
          category: 'salary',
          description: 'Monthly Salary',
          frequency: 'monthly',
          dayOfMonth: 15,
          startDate: new Date('2024-01-01').toISOString(),
          endDate: null,
          isActive: true,
          lastProcessedDate: new Date('2024-01-15').toISOString()
        },
        {
          id: 'recurring-2',
          accountId: 'recurring-acc-1',
          amount: 1200,
          type: 'expense',
          category: 'housing',
          description: 'Rent Payment',
          frequency: 'monthly',
          dayOfMonth: 1,
          startDate: new Date('2024-01-01').toISOString(),
          endDate: null,
          isActive: true,
          lastProcessedDate: new Date('2024-02-01').toISOString()
        }
      ];
      
      localStorage.setItem('wealthtracker_accounts', JSON.stringify(accounts));
      localStorage.setItem('wealthtracker_recurring_transactions', JSON.stringify(recurringTransactions));
    });
    
    await page.reload();
  });

  test('View recurring transactions list', async ({ page }) => {
    // Navigate to transactions
    await page.getByRole('link', { name: /transactions/i }).click();
    
    // Click on recurring transactions tab or button
    const recurringTab = page.getByRole('tab', { name: /recurring/i });
    const recurringButton = page.getByRole('button', { name: /recurring/i });
    
    if (await recurringTab.isVisible()) {
      await recurringTab.click();
    } else if (await recurringButton.isVisible()) {
      await recurringButton.click();
    }

    // Verify recurring transactions are displayed
    await expect(page.getByText('Monthly Salary')).toBeVisible();
    await expect(page.getByText(/3,500.*monthly/i)).toBeVisible();
    await expect(page.getByText('Rent Payment')).toBeVisible();
    await expect(page.getByText(/1,200.*monthly/i)).toBeVisible();

    // Check for status indicators
    await expect(page.getByText(/active/i).first()).toBeVisible();
  });

  test('Create new recurring income transaction', async ({ page }) => {
    // Navigate to transactions
    await page.getByRole('link', { name: /transactions/i }).click();
    
    // Access recurring transactions
    const recurringButton = page.getByRole('button', { name: /recurring|add.*recurring/i });
    if (await recurringButton.isVisible()) {
      await recurringButton.click();
    }

    // Click add recurring transaction
    await page.getByRole('button', { name: /add.*recurring|new.*recurring/i }).click();

    // Fill recurring transaction details
    await page.getByLabel(/description/i).fill('Freelance Monthly Retainer');
    await page.getByLabel(/amount/i).fill('1500');
    await page.getByLabel(/type/i).selectOption('income');
    await page.getByLabel(/category/i).selectOption('freelance');
    await page.getByLabel(/account/i).selectOption('recurring-acc-1');
    
    // Set frequency
    await page.getByLabel(/frequency/i).selectOption('monthly');
    
    // Set day of month or week
    const dayField = page.getByLabel(/day.*month/i);
    if (await dayField.isVisible()) {
      await dayField.fill('25');
    }
    
    // Set start date
    await page.getByLabel(/start.*date/i).fill('2024-02-01');
    
    // Save recurring transaction
    await page.getByRole('button', { name: /save|create/i }).click();

    // Verify it was created
    await expect(page.getByText('Freelance Monthly Retainer')).toBeVisible();
    await expect(page.getByText(/1,500.*monthly/i)).toBeVisible();
  });

  test('Create recurring expense with end date', async ({ page }) => {
    // Navigate to recurring transactions
    await page.goto('/transactions');
    const recurringButton = page.getByRole('button', { name: /recurring/i });
    if (await recurringButton.isVisible()) {
      await recurringButton.click();
    }

    // Add new recurring transaction
    await page.getByRole('button', { name: /add.*recurring/i }).click();

    // Fill details for a subscription
    await page.getByLabel(/description/i).fill('Netflix Subscription');
    await page.getByLabel(/amount/i).fill('15.99');
    await page.getByLabel(/type/i).selectOption('expense');
    await page.getByLabel(/category/i).selectOption('entertainment');
    await page.getByLabel(/account/i).selectOption('recurring-acc-2');
    
    // Set frequency
    await page.getByLabel(/frequency/i).selectOption('monthly');
    await page.getByLabel(/day.*month/i).fill('5');
    
    // Set date range
    await page.getByLabel(/start.*date/i).fill('2024-01-05');
    await page.getByLabel(/end.*date/i).fill('2024-12-31');
    
    // Save
    await page.getByRole('button', { name: /save|create/i }).click();

    // Verify creation with end date
    await expect(page.getByText('Netflix Subscription')).toBeVisible();
    await expect(page.getByText(/ends.*2024-12-31/i)).toBeVisible();
  });

  test('Create weekly recurring transaction', async ({ page }) => {
    // Navigate to recurring transactions
    await page.goto('/transactions');
    const recurringButton = page.getByRole('button', { name: /recurring/i });
    if (await recurringButton.isVisible()) {
      await recurringButton.click();
    }

    // Add new recurring transaction
    await page.getByRole('button', { name: /add.*recurring/i }).click();

    // Fill details for weekly expense
    await page.getByLabel(/description/i).fill('Weekly Groceries');
    await page.getByLabel(/amount/i).fill('150');
    await page.getByLabel(/type/i).selectOption('expense');
    await page.getByLabel(/category/i).selectOption('groceries');
    await page.getByLabel(/account/i).selectOption('recurring-acc-1');
    
    // Set weekly frequency
    await page.getByLabel(/frequency/i).selectOption('weekly');
    
    // Select day of week
    const dayOfWeek = page.getByLabel(/day.*week/i);
    if (await dayOfWeek.isVisible()) {
      await dayOfWeek.selectOption('saturday');
    }
    
    await page.getByLabel(/start.*date/i).fill('2024-02-03');
    
    // Save
    await page.getByRole('button', { name: /save|create/i }).click();

    // Verify
    await expect(page.getByText('Weekly Groceries')).toBeVisible();
    await expect(page.getByText(/150.*weekly/i)).toBeVisible();
  });

  test('Edit existing recurring transaction', async ({ page }) => {
    // Navigate to recurring transactions
    await page.goto('/transactions');
    const recurringButton = page.getByRole('button', { name: /recurring/i });
    if (await recurringButton.isVisible()) {
      await recurringButton.click();
    }

    // Find and edit the salary transaction
    const salaryRow = page.locator('tr', { hasText: 'Monthly Salary' });
    await salaryRow.getByRole('button', { name: /edit/i }).click();

    // Update amount (salary increase)
    await page.getByLabel(/amount/i).clear();
    await page.getByLabel(/amount/i).fill('4000');
    
    // Update description
    await page.getByLabel(/description/i).clear();
    await page.getByLabel(/description/i).fill('Monthly Salary (Updated)');
    
    // Save changes
    await page.getByRole('button', { name: /save|update/i }).click();

    // Verify updates
    await expect(page.getByText('Monthly Salary (Updated)')).toBeVisible();
    await expect(page.getByText(/4,000.*monthly/i)).toBeVisible();
  });

  test('Pause and resume recurring transaction', async ({ page }) => {
    // Navigate to recurring transactions
    await page.goto('/transactions');
    const recurringButton = page.getByRole('button', { name: /recurring/i });
    if (await recurringButton.isVisible()) {
      await recurringButton.click();
    }

    // Find rent payment transaction
    const rentRow = page.locator('tr', { hasText: 'Rent Payment' });
    
    // Pause the transaction
    const pauseButton = rentRow.getByRole('button', { name: /pause|disable/i });
    if (await pauseButton.isVisible()) {
      await pauseButton.click();
      
      // Confirm pause
      const confirmButton = page.getByRole('button', { name: /confirm|yes/i });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
      
      // Verify paused status
      await expect(rentRow.getByText(/paused|inactive/i)).toBeVisible();
    }
    
    // Resume the transaction
    const resumeButton = rentRow.getByRole('button', { name: /resume|enable/i });
    if (await resumeButton.isVisible()) {
      await resumeButton.click();
      
      // Verify active status
      await expect(rentRow.getByText(/active/i)).toBeVisible();
    }
  });

  test('Delete recurring transaction', async ({ page }) => {
    // Navigate to recurring transactions
    await page.goto('/transactions');
    const recurringButton = page.getByRole('button', { name: /recurring/i });
    if (await recurringButton.isVisible()) {
      await recurringButton.click();
    }

    // Count initial transactions
    const initialCount = await page.locator('tr[data-testid*="recurring"]').count();

    // Find and delete a transaction
    const firstRow = page.locator('tr', { hasText: 'Monthly Salary' });
    await firstRow.getByRole('button', { name: /delete|remove/i }).click();

    // Confirm deletion
    await page.getByRole('button', { name: /confirm|delete/i }).click();

    // Verify deletion
    await expect(page.getByText('Monthly Salary')).not.toBeVisible();
    
    // Verify count decreased
    const newCount = await page.locator('tr[data-testid*="recurring"]').count();
    expect(newCount).toBe(initialCount - 1);
  });

  test('View upcoming recurring transactions', async ({ page }) => {
    // Navigate to recurring transactions
    await page.goto('/transactions');
    const recurringButton = page.getByRole('button', { name: /recurring/i });
    if (await recurringButton.isVisible()) {
      await recurringButton.click();
    }

    // Look for upcoming transactions view
    const upcomingButton = page.getByRole('button', { name: /upcoming|schedule/i });
    if (await upcomingButton.isVisible()) {
      await upcomingButton.click();
      
      // Should show next occurrences
      await expect(page.getByText(/next.*occurrence/i)).toBeVisible();
      
      // Verify upcoming dates are shown
      await expect(page.getByText(/feb.*15.*2024/i)).toBeVisible(); // Next salary
      await expect(page.getByText(/mar.*1.*2024/i)).toBeVisible(); // Next rent
    }
  });

  test('Process recurring transactions manually', async ({ page }) => {
    // Navigate to recurring transactions
    await page.goto('/transactions');
    const recurringButton = page.getByRole('button', { name: /recurring/i });
    if (await recurringButton.isVisible()) {
      await recurringButton.click();
    }

    // Look for process/run button
    const processButton = page.getByRole('button', { name: /process|run.*now/i });
    if (await processButton.isVisible()) {
      await processButton.click();
      
      // Should show which transactions will be created
      await expect(page.getByText(/transactions.*created/i)).toBeVisible();
      
      // Confirm processing
      await page.getByRole('button', { name: /confirm|process/i }).click();
      
      // Verify success message
      await expect(page.getByText(/processed.*successfully/i)).toBeVisible();
    }
  });

  test('Skip next occurrence', async ({ page }) => {
    // Navigate to recurring transactions
    await page.goto('/transactions');
    const recurringButton = page.getByRole('button', { name: /recurring/i });
    if (await recurringButton.isVisible()) {
      await recurringButton.click();
    }

    // Find a transaction and access skip option
    const rentRow = page.locator('tr', { hasText: 'Rent Payment' });
    const moreButton = rentRow.getByRole('button', { name: /more|actions/i });
    
    if (await moreButton.isVisible()) {
      await moreButton.click();
      
      // Click skip next
      await page.getByRole('menuitem', { name: /skip.*next/i }).click();
      
      // Confirm skip
      await page.getByRole('button', { name: /confirm|skip/i }).click();
      
      // Verify skip indicator
      await expect(page.getByText(/next.*skipped/i)).toBeVisible();
    }
  });

  test('Recurring transaction history', async ({ page }) => {
    // Navigate to recurring transactions
    await page.goto('/transactions');
    const recurringButton = page.getByRole('button', { name: /recurring/i });
    if (await recurringButton.isVisible()) {
      await recurringButton.click();
    }

    // Click on a specific recurring transaction
    await page.getByText('Monthly Salary').click();

    // Should show transaction history
    await expect(page.getByText(/history|past.*transactions/i)).toBeVisible();
    
    // Verify past occurrences are listed
    await expect(page.getByText(/jan.*15.*2024/i)).toBeVisible();
    await expect(page.getByText(/3,500/)).toBeVisible();
    
    // Check for stats
    await expect(page.getByText(/total.*processed/i)).toBeVisible();
  });

  test('Bulk operations on recurring transactions', async ({ page }) => {
    // Add more test recurring transactions
    await page.evaluate(() => {
      const additional = [
        {
          id: 'recurring-3',
          accountId: 'recurring-acc-2',
          amount: 50,
          type: 'expense',
          category: 'utilities',
          description: 'Internet Bill',
          frequency: 'monthly',
          dayOfMonth: 10,
          startDate: new Date('2024-01-01').toISOString(),
          isActive: true
        },
        {
          id: 'recurring-4',
          accountId: 'recurring-acc-2',
          amount: 100,
          type: 'expense',
          category: 'utilities',
          description: 'Electric Bill',
          frequency: 'monthly',
          dayOfMonth: 15,
          startDate: new Date('2024-01-01').toISOString(),
          isActive: true
        }
      ];
      
      const existing = JSON.parse(localStorage.getItem('wealthtracker_recurring_transactions') || '[]');
      localStorage.setItem('wealthtracker_recurring_transactions', JSON.stringify([...existing, ...additional]));
    });
    
    await page.reload();
    
    // Navigate to recurring transactions
    const recurringButton = page.getByRole('button', { name: /recurring/i });
    if (await recurringButton.isVisible()) {
      await recurringButton.click();
    }

    // Select multiple transactions
    await page.getByRole('checkbox', { name: /select.*all/i }).click();
    
    // Bulk actions should appear
    await expect(page.getByText(/4.*selected/i)).toBeVisible();
    
    // Bulk pause
    await page.getByRole('button', { name: /bulk.*pause|pause.*selected/i }).click();
    await page.getByRole('button', { name: /confirm/i }).click();
    
    // Verify all are paused
    const pausedCount = await page.getByText(/paused|inactive/i).count();
    expect(pausedCount).toBeGreaterThanOrEqual(4);
  });
});