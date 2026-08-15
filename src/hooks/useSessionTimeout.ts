import { useEffect, useRef } from 'react';
import { securityService } from '../services/securityService';

/**
 * SIGN OUT AFTER A PERIOD OF INACTIVITY — the thing the setting always claimed.
 *
 * `securityService` has had `checkSession()` and `updateLastActivity()` since it
 * was written, and both are correct. Nothing called either, so the Session
 * Timeout dropdown stored a number that decided nothing: a person could set
 * "5 minutes", leave the app open for a week, and come back signed in.
 *
 * That is the dead-toggle problem on the one page where it makes a claim about
 * safety rather than about confetti. This is what winds the clock.
 *
 * ─ WHAT COUNTS AS ACTIVITY ─────────────────────────────────────────────────
 *
 * Pointer, keyboard, scroll and touch, on the window. Deliberately NOT a timer
 * that resets itself: the point is inactivity by the PERSON, not by the app, so
 * a page polling in the background must not keep a session alive.
 *
 * ─ WHY IT CHECKS ON A TIMER AND ON WAKE ────────────────────────────────────
 *
 * A laptop shut for two hours runs no timers. `visibilitychange` is what
 * catches the case the interval cannot — the tab comes back and the elapsed
 * time is read from the clock rather than from how often we were scheduled.
 *
 * ─ NEVER ───────────────────────────────────────────────────────────────────
 *
 * `sessionTimeout === 0` means never, and the hook does nothing at all: no
 * listeners, no interval. The owner asked for the option, and a "never" that
 * quietly kept measuring would be the same kind of lie in the other direction.
 */
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;

/** How often to compare the clock against the last activity. */
const CHECK_INTERVAL_MS = 30_000;

export function useSessionTimeout(onTimeout: () => void): void {
  // Held in a ref so a caller passing an inline arrow does not re-subscribe
  // every render — which would reset the listeners, not the session, but would
  // churn for no reason.
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    const settings = securityService.getSecuritySettings();
    if (settings.sessionTimeout <= 0) return; // Never

    // Starting the clock on mount, not on the last sign-in: a reload is the
    // person being here, and treating it as elapsed time would sign somebody
    // out for refreshing the page.
    securityService.updateLastActivity();

    const markActive = (): void => securityService.updateLastActivity();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, markActive, { passive: true });
    }

    const check = (): void => {
      if (!securityService.checkSession()) onTimeoutRef.current();
    };

    const interval = window.setInterval(check, CHECK_INTERVAL_MS);
    // The case the interval cannot see: a machine asleep runs no timers, so the
    // elapsed time has to be read when the tab comes back rather than counted
    // while it was away.
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, markActive);
      }
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // Re-read on every mount. The setting is changed on a page that stays
    // mounted, so the caller re-keys this hook when it changes — see App.
  }, []);
}
