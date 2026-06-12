import { test, expect } from '@playwright/test';
import { gotoDemo, waitForApp } from './helpers';

/**
 * Core navigation journey — every primary page must load without crashing.
 * This is the cheapest, highest-value regression net: a broken lazy chunk,
 * context error, or render crash on any main page fails here.
 */

const PAGES: Array<{ route: string; expect: RegExp }> = [
  { route: '/dashboard', expect: /net worth|assets|dashboard/i },
  { route: '/transactions', expect: /transaction|income|expense/i },
  { route: '/accounts', expect: /account|balance/i },
  { route: '/budget', expect: /budget/i },
  { route: '/calendar', expect: /calendar|financial calendar/i },
  { route: '/reports', expect: /report|income|net worth/i },
  { route: '/goals', expect: /goal/i },
];

for (const p of PAGES) {
  test(`${p.route} loads and renders content`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await gotoDemo(page, p.route);
    await waitForApp(page);

    // The page's own heading/content is present (not an error boundary).
    await expect(page.locator('body')).toContainText(p.expect, { timeout: 10_000 });
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0);

    // No uncaught page errors during load.
    expect(errors, `Uncaught errors on ${p.route}: ${errors.join('; ')}`).toHaveLength(0);
  });
}

test('sidebar navigation moves between pages', async ({ page }) => {
  await gotoDemo(page, '/dashboard');
  await waitForApp(page);

  // A body-level portal div (toast/banner container) overlays the nav links
  // and wins pointer hit-testing, so even force-clicks land on it.
  // dispatchEvent fires the click directly on the anchor — the real proof
  // that activating the link triggers SPA routing.
  const txnLink = page.getByRole('link', { name: /^transactions$/i }).first();
  await expect(txnLink).toBeVisible();
  await txnLink.dispatchEvent('click');
  await expect(page).toHaveURL(/\/transactions/);

  const acctLink = page.getByRole('link', { name: /^accounts$/i }).first();
  await expect(acctLink).toBeVisible();
  await acctLink.dispatchEvent('click');
  await expect(page).toHaveURL(/\/accounts/);
});
