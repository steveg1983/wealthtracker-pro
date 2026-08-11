import { test, expect } from '@playwright/test';
import { gotoDemo, waitForApp } from './helpers';

/**
 * Core navigation journey — every primary page must load without crashing.
 * This is the cheapest, highest-value regression net: a broken lazy chunk,
 * context error, or render crash on any main page fails here.
 */

const PAGES: Array<{ route: string; expect: RegExp }> = [
  { route: '/dashboard', expect: /net worth|assets|dashboard/i },
  // Find replaced the global transactions page; with nothing typed it states
  // what it is for, which is the content this net is looking for.
  { route: '/find', expect: /find looks through every account/i },
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
  // Find lives in the Accounts menu, and that menu's items exist only while it
  // is open — so the menu is opened first, which is also what a user does.
  await page.getByRole('button', { name: /accounts menu/i }).click();
  const findLink = page.getByRole('link', { name: /^find transactions$/i }).first();
  await expect(findLink).toBeVisible();
  await findLink.dispatchEvent('click');
  await expect(page).toHaveURL(/\/find/);

  const acctLink = page.getByRole('link', { name: /^accounts$/i }).first();
  await expect(acctLink).toBeVisible();
  await acctLink.dispatchEvent('click');
  await expect(page).toHaveURL(/\/accounts/);
});
