import { type Page, expect } from '@playwright/test';

/**
 * Open a route in demo mode (Clerk auth bypassed, sample data seeded).
 *
 * Pre-sets the consent choice and onboarding flags via an init script BEFORE
 * load, so the cookie-consent banner and onboarding modal never render — they
 * are fixed/overlay elements that would otherwise intercept clicks (exactly as
 * they don't appear for a returning user who already chose). This must run
 * before navigation, hence addInitScript rather than a post-load dismiss.
 *
 * Waits for 'domcontentloaded', NOT 'networkidle' — demo mode fetches merchant
 * logos continuously so the network never idles; waitForApp() is the real
 * ready signal.
 */
export async function gotoDemo(page: Page, route: string): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('wt_consent', 'essential');
      localStorage.setItem('onboardingCompleted', 'true');
      localStorage.setItem('testDataWarningDismissed', 'true');
    } catch { /* storage may be unavailable pre-load */ }
  });
  const sep = route.includes('?') ? '&' : '?';
  await page.goto(`${route}${sep}demo=true`, { waitUntil: 'domcontentloaded' });
}

/** Wait until the app shell + current page content have rendered. */
export async function waitForApp(page: Page): Promise<void> {
  await expect(page.getByRole('link', { name: /^transactions$/i }).first()).toBeVisible({ timeout: 15_000 });
}
