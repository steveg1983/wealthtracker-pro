/**
 * Where the top of the window has already been spent, expressed as CSS the
 * browser evaluates rather than numbers this file has to keep up to date.
 *
 * ─ WHY THIS IS ITS OWN MODULE ───────────────────────────────────────────────
 * These began life inside `components/Layout.tsx`, which is the right place for
 * them right up until a PAGE needs one. Layout renders the router's `Outlet`,
 * so every page is downstream of it; a page importing back from Layout closes
 * a cycle, and an ES module in a cycle hands out its bindings before it has
 * evaluated them. Measured, when `Accounts` imported the sticky offset from
 * Layout directly: `ReferenceError: STICKY_UNDER_APP_BAR is not defined`, the
 * page dead behind the error boundary.
 *
 * Note what did NOT catch that — `npm run lint` and `npm run typecheck:strict`
 * both passed, because a cycle is legal TypeScript and legal ESM. Only loading
 * the page found it. A leaf module with no component imports cannot be part of
 * such a cycle, which is the whole reason this file exists.
 */

/**
 * Everything pinned to the top of the window starts BELOW the phone's status
 * bar — the clock, the signal bars, the battery.
 *
 * `index.html` asks for `apple-mobile-web-app-status-bar-style:
 * black-translucent` with `viewport-fit=cover`, and that pairing means exactly
 * what it says: once the app is installed to a home screen, the page is drawn
 * UNDER the status bar rather than beneath it. In a browser tab the inset
 * resolves to 0px, so it only pays out where the status bar actually overlaps.
 */
export const SAFE_AREA_TOP = 'env(safe-area-inset-top, 0px)';

/**
 * The vertical room the demo banner needs, or nothing at all when it is not
 * showing. Set by whatever `@chrome` resolves `DemoBanner` to, which is the
 * only thing that can measure it — see the comment on BANNER_HEIGHT_VAR in
 * `components/DemoModeIndicator.tsx`. An edition with no demo mode publishes
 * nothing and every consumer here falls back to 0px, which is exactly what a
 * browser outside demo mode already does.
 */
export const DEMO_BANNER_OFFSET = 'var(--wt-demo-banner-height, 0px)';

/** Below the status bar, and below the demo banner when there is one. */
export const TOP_CHROME_OFFSET = `calc(${SAFE_AREA_TOP} + ${DEMO_BANNER_OFFSET})`;

/**
 * How tall the app bar is — published BY the app bar (see the layout effect in
 * `Layout.tsx`), for the same reason and by the same means as the demo banner
 * publishes its own height: the bar is the only thing that knows.
 *
 * Only one of the two bars is displayed at a time (`hidden md:block` against
 * `md:hidden`), so the hidden one measures 0 and the larger of the pair is
 * whichever is on screen. That is what lets a consumer survive a breakpoint
 * change without knowing where the breakpoint is.
 */
export const APP_BAR_HEIGHT_VAR = '--wt-app-bar-height';

/**
 * Where a page may park chrome of its own: clear of the status bar, the demo
 * banner and the app bar, whatever each of them happens to be right now.
 * Import this rather than writing another `top-16 md:top-12`.
 *
 * Those two literals are what the reconciliation page still uses, and they are
 * wrong three ways — all measured 2026-08-14 at 1280×700 and 390×760. They are
 * the bar HEIGHTS with the status-bar inset and the demo banner left out, so
 * parked chrome slides under the app bar by the banner's height in demo mode
 * and by the status bar's on an installed home-screen app. And the mobile
 * figure is not even the right height: that header is `p-4` around its content
 * and measures 76px, not the 64 of `top-16`.
 */
export const STICKY_UNDER_APP_BAR =
  `calc(${SAFE_AREA_TOP} + ${DEMO_BANNER_OFFSET} + var(${APP_BAR_HEIGHT_VAR}, 0px))`;
