import { useCallback, useSyncExternalStore } from 'react';

/**
 * The phone viewport, as a media query.
 *
 * The complement of Tailwind's `md:` (which begins at exactly 768px), so a
 * component that switches here switches at the same width as every stylesheet
 * in the app. The `.98` is not superstition: a viewport can land on a
 * fractional CSS pixel through browser zoom or a device pixel ratio that does
 * not divide cleanly, and `max-width: 767px` would leave 767.5px matching
 * NEITHER this query nor `md:` — a band where the app has no opinion about its
 * own form factor.
 */
export const MOBILE_VIEWPORT_QUERY = '(max-width: 767.98px)';

/**
 * A media query as LIVE STATE rather than a reading taken once.
 *
 * `window.innerWidth < 768` evaluated in a render body is a snapshot: correct
 * at mount and never corrected. React has no reason to re-render when the
 * viewport changes, so the value rots silently — the component keeps whichever
 * shape it happened to be born with until something unrelated re-renders it.
 * That is what put `ResponsiveModal` a rotation behind the device.
 *
 * `useSyncExternalStore` is the right primitive here rather than
 * useState + useEffect: `matchMedia` IS an external store, and subscribing
 * through React means the first paint reads the live value instead of
 * rendering a default and correcting it in an effect (a visible flash of the
 * wrong form factor).
 *
 * `fallback` is what to report where `matchMedia` does not exist — a server
 * render, or a test environment that has not shimmed it. It is explicit
 * because the safe answer depends on the query: for a max-width phone query
 * the safe answer is "not a phone", which is what the old `typeof window`
 * guard also concluded.
 */
export function useMediaQuery(query: string, fallback: boolean = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void): (() => void) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return () => {};
      }
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query]
  );

  const getSnapshot = useCallback((): boolean => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return fallback;
    }
    return window.matchMedia(query).matches;
  }, [query, fallback]);

  const getServerSnapshot = useCallback((): boolean => fallback, [fallback]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * True while the viewport is phone-width, and it CHANGES when the device is
 * rotated or the window dragged across 768.
 *
 * Reach for this only where the choice cannot be made in CSS — a component
 * swap, not a style swap. Everything else in this app is a Tailwind `md:` /
 * `lg:` class, which is precisely why nothing else had the stale-breakpoint
 * bug.
 */
export function useIsMobileViewport(): boolean {
  return useMediaQuery(MOBILE_VIEWPORT_QUERY);
}
