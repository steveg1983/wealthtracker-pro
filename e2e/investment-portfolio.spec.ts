import { test, expect } from '@playwright/test';

test.describe('Investment Portfolio Management', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage and set up test data
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      
      // Set up investment accounts
      const accounts = [
        {
          id: 'inv-acc-1',
          name: 'Brokerage Account',
          type: 'investment',
          balance: 50000,
          createdAt: new Date('2024-01-01').toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'inv-acc-2',
          name: 'Retirement 401k',
          type: 'retirement',
          balance: 75000,
          createdAt: new Date('2024-01-01').toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      
      // Set up existing investments
      const investments = [
        {
          id: 'inv-1',
          accountId: 'inv-acc-1',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          quantity: 100,
          purchasePrice: 150.00,
          currentPrice: 175.00,
          purchaseDate: new Date('2023-06-15').toISOString(),
          assetType: 'stock'
        },
        {
          id: 'inv-2',
          accountId: 'inv-acc-1',
          symbol: 'GOOGL',
          name: 'Alphabet Inc.',
          quantity: 50,
          purchasePrice: 100.00,
          currentPrice: 125.00,
          purchaseDate: new Date('2023-08-20').toISOString(),
          assetType: 'stock'
        },
        {
          id: 'inv-3',
          accountId: 'inv-acc-2',
          symbol: 'VOO',
          name: 'Vanguard S&P 500 ETF',
          quantity: 150,
          purchasePrice: 400.00,
          currentPrice: 420.00,
          purchaseDate: new Date('2023-01-10').toISOString(),
          assetType: 'etf'
        }
      ];
      
      localStorage.setItem('wealthtracker_accounts', JSON.stringify(accounts));
      localStorage.setItem('wealthtracker_investments', JSON.stringify(investments));
    });
    
    await page.reload();
  });

  test('View investment portfolio overview', async ({ page }) => {
    // Navigate to investments
    await page.getByRole('link', { name: /investment/i }).click();
    await expect(page.getByRole('heading', { name: /investment/i })).toBeVisible();

    // Verify portfolio summary
    await expect(page.getByText(/total.*portfolio.*value/i)).toBeVisible();
    await expect(page.getByText(/125,000/i)).toBeVisible(); // Total of both accounts

    // Verify individual holdings
    await expect(page.getByText('Apple Inc.')).toBeVisible();
    await expect(page.getByText('AAPL')).toBeVisible();
    await expect(page.getByText(/100.*shares/i)).toBeVisible();

    // Check for performance metrics
    await expect(page.getByText(/gain.*loss/i)).toBeVisible();
    await expect(page.getByText(/\+16\.67%/i)).toBeVisible(); // AAPL gain percentage
  });

  test('Add new investment holding', async ({ page }) => {
    // Navigate to investments
    await page.getByRole('link', { name: /investment/i }).click();

    // Click add investment button
    await page.getByRole('button', { name: /add.*investment|add.*holding/i }).click();

    // Fill investment details
    await page.getByLabel(/account/i).selectOption('inv-acc-1');
    await page.getByLabel(/symbol|ticker/i).fill('MSFT');
    await page.getByLabel(/name|company/i).fill('Microsoft Corporation');
    await page.getByLabel(/quantity|shares/i).fill('75');
    await page.getByLabel(/purchase.*price|cost.*basis/i).fill('300.00');
    await page.getByLabel(/purchase.*date/i).fill('2024-01-15');
    
    const assetType = page.getByLabel(/type|asset.*type/i);
    if (await assetType.isVisible()) {
      await assetType.selectOption('stock');
    }

    // Save investment
    await page.getByRole('button', { name: /save|add/i }).click();

    // Verify investment was added
    await expect(page.getByText('Microsoft Corporation')).toBeVisible();
    await expect(page.getByText('MSFT')).toBeVisible();
    await expect(page.getByText(/75.*shares/i)).toBeVisible();
  });

  test('Update investment prices', async ({ page }) => {
    // Navigate to investments
    await page.getByRole('link', { name: /investment/i }).click();

    // Click update prices button
    const updateButton = page.getByRole('button', { name: /update.*price|refresh.*price/i });
    if (await updateButton.isVisible()) {
      await updateButton.click();
      
      // Wait for price update
      await expect(page.getByText(/updating|refreshing/i)).toBeVisible();
      await expect(page.getByText(/updated|refreshed/i)).toBeVisible({ timeout: 10000 });
    }

    // Alternatively, manually update a single holding
    const appleRow = page.locator('tr', { hasText: 'AAPL' });
    const editButton = appleRow.getByRole('button', { name: /edit|update/i });
    
    if (await editButton.isVisible()) {
      await editButton.click();
      
      // Update current price
      await page.getByLabel(/current.*price|market.*price/i).fill('180.00');
      await page.getByRole('button', { name: /save|update/i }).click();
      
      // Verify price was updated
      await expect(page.getByText(/180\.00/)).toBeVisible();
    }
  });

  test('Record investment transaction (buy)', async ({ page }) => {
    // Navigate to investments
    await page.getByRole('link', { name: /investment/i }).click();

    // Click on specific holding or add transaction
    const transactionButton = page.getByRole('button', { name: /transaction|buy.*sell/i }).first();
    if (await transactionButton.isVisible()) {
      await transactionButton.click();
    } else {
      // Alternative: click on holding then transaction
      await page.getByText('AAPL').click();
      await page.getByRole('button', { name: /add.*transaction|buy.*sell/i }).click();
    }

    // Select transaction type
    await page.getByLabel(/type|action/i).selectOption('buy');

    // Fill transaction details
    await page.getByLabel(/quantity|shares/i).fill('25');
    await page.getByLabel(/price.*share|unit.*price/i).fill('178.00');
    await page.getByLabel(/date/i).fill('2024-02-01');
    
    const fees = page.getByLabel(/fee|commission/i);
    if (await fees.isVisible()) {
      await fees.fill('9.99');
    }

    // Save transaction
    await page.getByRole('button', { name: /save|confirm/i }).click();

    // Verify quantity updated
    await expect(page.getByText(/125.*shares/i)).toBeVisible(); // 100 + 25
  });

  test('Record investment transaction (sell)', async ({ page }) => {
    // Navigate to investments
    await page.getByRole('link', { name: /investment/i }).click();

    // Find GOOGL holding
    const googlRow = page.locator('tr', { hasText: 'GOOGL' });
    await googlRow.getByRole('button', { name: /transaction|sell/i }).click();

    // Select sell transaction
    await page.getByLabel(/type|action/i).selectOption('sell');

    // Fill sell details
    await page.getByLabel(/quantity|shares/i).fill('20');
    await page.getByLabel(/price.*share|sale.*price/i).fill('130.00');
    await page.getByLabel(/date/i).fill('2024-02-05');

    // Save transaction
    await page.getByRole('button', { name: /save|confirm/i }).click();

    // Verify quantity updated and gain/loss calculated
    await expect(page.getByText(/30.*shares/i)).toBeVisible(); // 50 - 20
    await expect(page.getByText(/realized.*gain/i)).toBeVisible();
  });

  test('View investment performance analytics', async ({ page }) => {
    // Navigate to investments
    await page.getByRole('link', { name: /investment/i }).click();

    // Click on performance or analytics tab
    const analyticsTab = page.getByRole('tab', { name: /performance|analytics/i });
    if (await analyticsTab.isVisible()) {
      await analyticsTab.click();
    } else {
      // Alternative: look for performance section
      await page.getByRole('button', { name: /view.*performance|analytics/i }).click();
    }

    // Verify performance metrics
    await expect(page.getByText(/total.*return/i)).toBeVisible();
    await expect(page.getByText(/annualized.*return/i)).toBeVisible();
    await expect(page.getByText(/unrealized.*gain/i)).toBeVisible();

    // Check for performance chart
    await expect(page.locator('canvas, svg').first()).toBeVisible();

    // Time period selector
    const periodSelector = page.getByLabel(/period|timeframe/i);
    if (await periodSelector.isVisible()) {
      await periodSelector.selectOption('1Y');
      // Chart should update
      await page.waitForTimeout(500);
    }
  });

  test('Portfolio allocation analysis', async ({ page }) => {
    // Navigate to investments
    await page.getByRole('link', { name: /investment/i }).click();

    // Click on allocation view
    const allocationButton = page.getByRole('button', { name: /allocation|diversification/i });
    if (await allocationButton.isVisible()) {
      await allocationButton.click();
    }

    // Verify allocation breakdown
    await expect(page.getByText(/asset.*allocation/i)).toBeVisible();
    
    // By asset type
    await expect(page.getByText(/stocks.*\d+%/i)).toBeVisible();
    await expect(page.getByText(/etf.*\d+%/i)).toBeVisible();

    // By account
    await expect(page.getByText(/brokerage.*\d+%/i)).toBeVisible();
    await expect(page.getByText(/retirement.*\d+%/i)).toBeVisible();

    // Check for allocation pie chart
    await expect(page.locator('canvas, svg').first()).toBeVisible();
  });

  test('Set and track investment goals', async ({ page }) => {
    // Navigate to investments
    await page.getByRole('link', { name: /investment/i }).click();

    // Access goals section
    const goalsButton = page.getByRole('button', { name: /goal|target/i });
    if (await goalsButton.isVisible()) {
      await goalsButton.click();

      // Set portfolio target
      await page.getByLabel(/target.*value|goal.*amount/i).fill('200000');
      await page.getByLabel(/target.*date/i).fill('2025-12-31');
      
      // Set allocation targets
      const stockTarget = page.getByLabel(/stock.*target|equity.*target/i);
      if (await stockTarget.isVisible()) {
        await stockTarget.fill('60');
      }
      
      const bondTarget = page.getByLabel(/bond.*target/i);
      if (await bondTarget.isVisible()) {
        await bondTarget.fill('30');
      }

      // Save goals
      await page.getByRole('button', { name: /save|set.*goal/i }).click();

      // Verify goal tracking
      await expect(page.getByText(/goal.*progress/i)).toBeVisible();
      await expect(page.getByText(/62\.5%/i)).toBeVisible(); // 125k/200k
    }
  });

  test('Dividend tracking', async ({ page }) => {
    // Add dividend data to test
    await page.evaluate(() => {
      const dividends = [
        {
          id: 'div-1',
          investmentId: 'inv-1',
          amount: 150.00,
          payDate: new Date('2024-01-15').toISOString(),
          exDate: new Date('2024-01-10').toISOString()
        },
        {
          id: 'div-2',
          investmentId: 'inv-3',
          amount: 420.00,
          payDate: new Date('2024-01-20').toISOString(),
          exDate: new Date('2024-01-15').toISOString()
        }
      ];
      localStorage.setItem('wealthtracker_dividends', JSON.stringify(dividends));
    });
    
    await page.reload();
    await page.getByRole('link', { name: /investment/i }).click();

    // View dividend income
    const dividendTab = page.getByRole('tab', { name: /dividend/i });
    if (await dividendTab.isVisible()) {
      await dividendTab.click();
    } else {
      await page.getByRole('button', { name: /dividend/i }).click();
    }

    // Verify dividend history
    await expect(page.getByText(/dividend.*income/i)).toBeVisible();
    await expect(page.getByText(/570\.00/i)).toBeVisible(); // Total dividends

    // Check individual dividend entries
    await expect(page.getByText(/AAPL.*150\.00/i)).toBeVisible();
    await expect(page.getByText(/VOO.*420\.00/i)).toBeVisible();
  });

  test('Investment research and notes', async ({ page }) => {
    // Navigate to investments
    await page.getByRole('link', { name: /investment/i }).click();

    // Click on a specific investment
    await page.getByText('AAPL').click();

    // Add research note
    const notesSection = page.getByRole('button', { name: /note|research/i });
    if (await notesSection.isVisible()) {
      await notesSection.click();
      
      // Add note
      const noteInput = page.getByLabel(/note|comment/i);
      await noteInput.fill('Strong Q4 earnings report. Consider increasing position if price dips below $170.');
      
      await page.getByRole('button', { name: /save|add.*note/i }).click();
      
      // Verify note saved
      await expect(page.getByText(/Strong Q4 earnings/i)).toBeVisible();
    }
  });

  test('Export investment data', async ({ page }) => {
    // Navigate to investments
    await page.getByRole('link', { name: /investment/i }).click();

    // Click export button
    const exportButton = page.getByRole('button', { name: /export/i });
    
    if (await exportButton.isVisible()) {
      // Set up download promise
      const downloadPromise = page.waitForEvent('download');
      
      await exportButton.click();
      
      // Select export format if prompted
      const csvOption = page.getByText(/csv/i);
      if (await csvOption.isVisible()) {
        await csvOption.click();
      }
      
      const download = await downloadPromise;
      
      // Verify download
      expect(download.suggestedFilename()).toMatch(/investment|portfolio/i);
      expect(download.suggestedFilename()).toMatch(/\.(csv|xlsx)$/);
    }
  });
});