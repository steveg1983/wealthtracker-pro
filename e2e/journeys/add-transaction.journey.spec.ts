import { test, expect } from '@playwright/test';
import { gotoDemo, waitForApp } from './helpers';

/**
 * The core money journey: add a transaction and see it land.
 *
 * Opens the add-transaction modal from the dashboard quick action, fills the
 * required fields (account, description, amount), saves, and verifies the new
 * transaction can be found. A regression here means users cannot record money —
 * the product's reason to exist.
 *
 * The proof used to be "it appears on the global transactions page". That page
 * is retired (transactions are worked on in their account's register), so the
 * proof is Find, which searches every account at once — the same question,
 * asked of the app that exists now.
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

  // The new transaction can be found — from any account, by its description.
  await gotoDemo(page, `/find?q=${encodeURIComponent(uniqueDescription)}`);
  await waitForApp(page);
  await expect(page.getByText(uniqueDescription).first()).toBeVisible({ timeout: 10_000 });
});
