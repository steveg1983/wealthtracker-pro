import { test, expect } from '@playwright/test';
import { gotoDemo, waitForApp } from './helpers';

/**
 * The core money journey: add a transaction and see it land.
 *
 * Opens the add-transaction modal from the dashboard quick action, fills the
 * required fields (account, description, amount), saves, and verifies the new
 * transaction appears in the transactions list. A regression here means users
 * cannot record money — the product's reason to exist.
 */

test('add a transaction from the dashboard and find it in the list', async ({ page }) => {
  await gotoDemo(page, '/dashboard');
  await waitForApp(page);

  const uniqueDescription = `E2E Coffee ${Date.now()}`;

  await page.getByRole('button', { name: /add a new transaction/i }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Use the form's stable element ids (the amount label is dynamic —
  // "Amount (£)" once an account is chosen — so a label match is brittle).
  // Account is required; index 0 is the "Select account" placeholder.
  await dialog.locator('#account-select').selectOption({ index: 1 });
  await dialog.locator('#description-input').fill(uniqueDescription);
  await dialog.locator('#amount-input').fill('4.50');

  // Category requires a type → sub → detail drill-down. Pick the first real
  // sub-category, then the first real detail under it.
  await dialog.locator('#category-select').selectOption({ index: 1 });
  const subcategory = dialog.locator('#subcategory-select');
  await expect(subcategory).toBeVisible();
  await subcategory.selectOption({ index: 1 });

  await dialog.getByRole('button', { name: /^add transaction$/i }).click();

  // Modal closes on a successful save.
  await expect(dialog).toBeHidden({ timeout: 10_000 });

  // The new transaction shows up on the transactions page.
  await gotoDemo(page, '/transactions');
  await waitForApp(page);
  await expect(page.getByText(uniqueDescription).first()).toBeVisible({ timeout: 10_000 });
});
