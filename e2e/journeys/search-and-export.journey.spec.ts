import { test, expect } from '@playwright/test';
import { gotoDemo, waitForApp } from './helpers';

/**
 * Two supporting journeys:
 *  - global search returns results (the header combobox)
 *  - GDPR "export everything" produces a complete JSON download (portability)
 */

test('global search surfaces matching results', async ({ page }) => {
  await gotoDemo(page, '/dashboard');
  await waitForApp(page);

  // The header search combobox is present directly on desktop (the separate
  // "Search" button is the mobile trigger).
  const searchBox = page.getByRole('combobox', { name: /search/i });
  await expect(searchBox).toBeVisible();
  await searchBox.fill('a');

  // A results panel appears (demo data guarantees matches for "a").
  await expect(page.locator('#global-search-results')).toBeVisible({ timeout: 10_000 });
});

test('export everything downloads a complete JSON bundle', async ({ page }) => {
  await gotoDemo(page, '/export-manager');
  await waitForApp(page);

  const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });
  await page.getByRole('button', { name: /export everything/i }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/wealthtracker-complete-export-.*\.json/);

  // The bundle contains the expected top-level entity keys.
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c as Buffer);
  const json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  expect(json.data).toHaveProperty('accounts');
  expect(json.data).toHaveProperty('transactions');
  expect(json.data).toHaveProperty('budgets');
  expect(json.data).toHaveProperty('goals');
  expect(json.data).toHaveProperty('categories');
});
