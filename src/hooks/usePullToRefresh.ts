import { useEffect, useRef, useState } from 'react';

/**
 * Pull down at the top of the page to reload — but only in an INSTALLED app.
 *
 * ── WHY THIS EXISTS AT ALL ──────────────────────────────────────────────────
 *
 * The owner added WealthTracker to his home screen, and two days later the
 * Accounts page was drawing itself the way it had before that morning's fixes:
 * the header under the iOS clock, the controls squashed. Fully closing the app
 * and reopening it fixed everything.
 *
 * That is not a caching bug, and it was worth measuring before assuming one —
 * production serves `cache-control: public, max-age=0, must-revalidate` on both
 * `/` and `/accounts` (checked 2026-08-13), so the HTML revalidates whenever it
 * is actually requested. The point is that it stops being requested: iOS keeps a
 * standalone web app's page ALIVE between launches. Reopening from the app
 * switcher resumes the document that is already there, so a session can run for
 * days on the build it happened to start with.
 *
 * And a standalone app has no address bar and no Safari pull-to-refresh, so
 * there was no way out of it from inside. His words: "I dont have a pull down to
 * refresh option... But no refresh."
 *
 * ── WHY ONLY WHEN INSTALLED ─────────────────────────────────────────────────
 *
 * In a browser tab Safari already does this, better, at the OS level. Adding a
 * second gesture on top of the platform's own is how a page ends up fighting
 * its user for a scroll. The check is `display-mode: standalone` plus the
 * `navigator.standalone` flag that iOS uses instead — the same pair
 * `mobileService.isPWAInstalled` already reads.
 *
 * ── WHAT IT DOES NOT DO ─────────────────────────────────────────────────────
 *
 * It does not re-fetch data and leave the page running. A refetch would answer
 * a different complaint — stale FIGURES — and would have left him exactly where
 * he was, on a stale BUILD. `location.reload()` is the honest action for what
 * this is for.
 */

/** How far the finger must travel before a release counts as a pull. */
const TRIGGER_DISTANCE = 72;

/**
 * How far the indicator is allowed to travel, so a long drag does not run the
 * spinner down the page. Resistance below makes the last pixels expensive.
 */
const MAX_DISTANCE = 96;

/** Below this, a drag is a scroll that happened to start at the top. */
const ENGAGE_SLOP = 8;

export interface PullToRefresh {
  /** How far the pull has been dragged, in px. 0 when idle. */
  distance: number;
  /** True once released past the threshold, while the reload is in flight. */
  refreshing: boolean;
  /** True when a release now would reload. Drives the indicator's readiness. */
  ready: boolean;
}

/**
 * True in an installed app, where the platform offers no refresh of its own.
 *
 * Three signals, because the owner's iOS 27 wrapper (1 Sep 2026) answers
 * false to BOTH declared ones — the same lie that broke the safe-area
 * zeroing — which silently killed this gesture on the one surface it exists
 * for, leaving close-and-reopen as his only refresh. The class is main.tsx's
 * behavioural detection (it catches the wrapper paying a top inset while the
 * window falls short of the screen), and it can arrive SECONDS after mount
 * there, which is why the caller asks per gesture rather than once.
 */
function isInstalledApp(): boolean {
  if (typeof window === 'undefined') return false;
  const standaloneDisplay = window.matchMedia?.('(display-mode: standalone)').matches === true;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return (
    standaloneDisplay ||
    iosStandalone ||
    document.documentElement.classList.contains('wt-installed-app')
  );
}

export function usePullToRefresh(reload: () => void = () => window.location.reload()): PullToRefresh {
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Where the finger started, or null when this touch is not a candidate.
   * A ref rather than state: it is written from a touch handler on every move
   * and nothing renders from it, so making it state would re-render the whole
   * layout per frame to store a number the layout never reads.
   */
  const startY = useRef<number | null>(null);
  const engaged = useRef(false);

  useEffect(() => {
    const onTouchStart = (event: TouchEvent): void => {
      // Asked per GESTURE, not once at mount: on the owner's wrapper the
      // installed-app class lands only when the webview is finally inset —
      // seconds after this effect has run — so a mount-time gate stayed
      // false forever and the gesture never existed there. In Safari this
      // stays false on every touch and the listeners below are inert, which
      // preserves the original rule: Safari has its own pull-to-refresh and
      // stacking a second gesture fights the user for the scroll.
      if (!isInstalledApp()) {
        startY.current = null;
        return;
      }
      // Only a gesture that begins AT the top can be a pull. Starting anywhere
      // else is a scroll, and a scroll that later reaches the top must stay one.
      if (window.scrollY > 0 || event.touches.length !== 1) {
        startY.current = null;
        return;
      }
      // A SCROLL-LOCKED BODY IS NOT A PAGE AT ITS TOP. The shared Modal pins
      // the body (`position: fixed`, top -scrollY) while a dialog is open, and
      // scrollY reads 0 for the whole of that — not because the user is at the
      // top of the page but because there is no scrollable page. Without this
      // guard every touch inside an open dialog was a pull candidate: scrolling
      // UP at the bottom of Edit Transaction first had its scroll eaten by the
      // preventDefault below (reported as "the page freezes") and the release
      // then reloaded the app out from under the editor ("refreshes the page
      // and kicks me back to the register" — owner, 21 Aug, reproduced in the
      // installed app on a simulator; the WebContent process never died, this
      // listener was the whole of the 'crash'). While an overlay owns the
      // screen there is nothing here to refresh.
      if (document.body.style.position === 'fixed') {
        startY.current = null;
        return;
      }
      startY.current = event.touches[0].clientY;
      engaged.current = false;
    };

    const onTouchMove = (event: TouchEvent): void => {
      const start = startY.current;
      if (start === null || refreshing) return;

      const travelled = event.touches[0].clientY - start;
      if (travelled <= ENGAGE_SLOP) {
        // Upward, or too small to mean anything. If the user has started
        // scrolling up, this touch is done being a candidate.
        if (travelled < 0) startY.current = null;
        return;
      }

      // Resistance: the pull follows the finger at first and then increasingly
      // resists, so the gesture has a floor and cannot be flung open.
      const pulled = Math.min(MAX_DISTANCE, travelled * 0.5);
      engaged.current = true;
      setDistance(pulled);

      // Only now — once this is definitely a pull rather than a scroll — is it
      // right to take the gesture away from the page. Calling preventDefault
      // any earlier would stop ordinary scrolling from the top of the page.
      if (event.cancelable) event.preventDefault();
    };

    const onTouchEnd = (): void => {
      const shouldReload = engaged.current && distance >= TRIGGER_DISTANCE;
      startY.current = null;
      engaged.current = false;

      if (!shouldReload) {
        setDistance(0);
        return;
      }
      // Held open while the document goes away, so the gesture does not snap
      // back and read as "nothing happened" in the moment before the reload.
      setRefreshing(true);
      setDistance(TRIGGER_DISTANCE);
      reload();
    };

    // NOT passive: this listener conditionally calls preventDefault, and a
    // passive listener that does so is ignored with a console warning.
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [distance, refreshing, reload]);

  return { distance, refreshing, ready: distance >= TRIGGER_DISTANCE };
}
