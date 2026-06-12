/**
 * Cookie/tracking consent state (PECR + GDPR).
 *
 * 'essential'  — strictly-necessary only: Clerk auth/session, error capture
 *                with PII scrubbing (legitimate interest, data minimised).
 * 'all'        — additionally enables Sentry session replay and performance
 *                tracing (non-essential diagnostics → require opt-in).
 * null         — no choice made yet; banner shows, non-essential stays OFF.
 */

export type ConsentLevel = 'essential' | 'all';

const CONSENT_KEY = 'wt_consent';

export function getConsent(): ConsentLevel | null {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === 'all' || value === 'essential' ? value : null;
  } catch {
    return null;
  }
}

export function setConsent(level: ConsentLevel): void {
  try {
    localStorage.setItem(CONSENT_KEY, level);
  } catch {
    // Private-browsing storage failures: treat as session-only consent.
  }
}

export function hasAnalyticsConsent(): boolean {
  return getConsent() === 'all';
}
