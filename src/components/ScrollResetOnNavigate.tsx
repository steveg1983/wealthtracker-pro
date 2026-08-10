import { useLayoutEffect, useRef } from 'react';
import { NavigationType, useLocation, useNavigationType } from 'react-router-dom';

/**
 * Arriving at a page at the top of it.
 *
 * ─ WHAT WAS WRONG ──────────────────────────────────────────────────────────
 * Nothing in the app ever reset the scroll position, and a client-side
 * navigation does not do it for you: React Router swaps the routed subtree and
 * leaves the window exactly where it was. Leave a long register two thousand
 * pixels down, click Reports, and Reports opens two thousand pixels down —
 * below its own heading, so the first thing the new page asks of the reader is
 * to scroll UP to find out where they are.
 *
 * ─ WHAT ACTUALLY SCROLLS ───────────────────────────────────────────────────
 * The WINDOW. There is no inner scrolling container to reset instead: #root is
 * `min-height:100vh` with no cap (index.html), Layout's root is `min-h-screen`,
 * and its <main> is a plain block with no height and no overflow of its own —
 * so the document itself is what grows past the viewport. Inner scrollers do
 * exist (the virtualised register, the comboboxes), but each mounts with its
 * page and starts at the top already; none of them is the offset that survives
 * a navigation.
 *
 * The two-argument call is an INSTANT jump, which this depends on: no rule in
 * the app sets `scroll-behavior: smooth` (index.css mentions it only to force
 * `auto` under prefers-reduced-motion). Add one and this must become an
 * explicit `behavior: 'instant'` — an animated reset would still be travelling
 * when the arrival scrolls described below run, and would land on top of them.
 *
 * ─ THE THREE BOUNDARIES ────────────────────────────────────────────────────
 * 1. PUSH and REPLACE reset. Going somewhere new means starting at the top of
 *    it. useLayoutEffect rather than useEffect so the reset is part of the same
 *    paint as the new page: with useEffect the browser is free to show one
 *    frame of the new page at the old offset first, which is a visible jolt.
 *
 * 2. POP does NOT. Back and Forward belong to the browser, which already
 *    restores the offset of the entry it is returning to — `scrollRestoration`
 *    is left at its default of 'auto', because nothing in this app touches it.
 *    Going back to a list should return you to where you were in it.
 *    THE HONEST LIMIT: native restoration is best-effort in a code-split SPA.
 *    The browser restores as soon as the document is tall enough, and a lazily
 *    loaded page that is still a skeleton at that moment may not be tall enough
 *    yet, so a deep offset can come back short. What this component guarantees
 *    is that nothing here FIGHTS it. Storing an offset per history entry and
 *    replaying it once the page has its height is a different piece of work,
 *    and pretending otherwise here would be the wrong place for it.
 *
 * 3. Only a change of PATHNAME counts. Query parameters are how pages talk to
 *    themselves: filters write to them, and the arrival deep links consume
 *    themselves with a same-pathname replace (the reports hub's drill
 *    parameters, the register's ?txn=). Firing on those would yank a reader who
 *    is mid-page back to the top for something they never navigated. The
 *    previous pathname is held in a ref rather than inferred from the
 *    dependency list, because the navigation type changes on its own — POP to
 *    REPLACE on that very first consume — and would otherwise re-run this for a
 *    pathname that never moved.
 *
 *    The cost of that rule, stated plainly: clicking the nav item for the page
 *    you are already on does not jump to the top either. Nothing can tell that
 *    apart from a filter rewriting the address bar, and of the two mistakes,
 *    moving a reader who did not ask to be moved is much the worse.
 *
 * ─ WHAT STILL WINS ─────────────────────────────────────────────────────────
 * The deliberate arrival scrolls — useArrivalRowFocus's callback ref, the
 * register's ?txn= row centring, the accounts list centring the row you came
 * back from, the duplicate sweep resuming — all run after their page has
 * mounted, and a code-split page mounts in a later commit than this one. Where
 * they do share a commit this still goes first: it is rendered as the router's
 * first child, and React commits layout effects and refs in tree order. Reset,
 * then land on the target.
 *
 * Fragment links (the skip links at the top of Layout) are untouched: they
 * change the hash only, the pathname is unmoved, and so this does nothing.
 */
export default function ScrollResetOnNavigate(): null {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  /**
   * The pathname this last ran for. Null until the first run, which makes the
   * opening page of a session count as a change — harmless, because the
   * opening navigation type is POP and returns below without scrolling.
   */
  const lastPathname = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (lastPathname.current === pathname) return;
    lastPathname.current = pathname;
    if (navigationType === NavigationType.Pop) return;
    window.scrollTo(0, 0);
  }, [pathname, navigationType]);

  return null;
}
