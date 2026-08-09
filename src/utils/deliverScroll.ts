/**
 * How often to ask again while there is still nothing to scroll, and for how
 * long to keep asking.
 *
 * The thing being waited for is ONE ResizeObserver round trip — AutoSizer
 * measures its parent, and react-window is not rendered at all until it has
 * (see its `bailoutOnChildren`). On an idle machine that is a frame. On the
 * register it is a frame queued behind eleven thousand rows being filtered,
 * sorted and run through a Decimal running balance in the same flush, and that
 * can be most of a second.
 *
 * A second and a half is therefore "a very bad frame, generously" rather than a
 * guess: long enough that no real measurement misses it, short enough that a
 * request which can never be satisfied — a list on a page the user has since
 * left, a row that will never render — stops asking rather than polling on for
 * ever.
 */
const ATTEMPT_INTERVAL_MS = 50;
const ATTEMPT_BUDGET_MS = 1500;

/**
 * Two more goes once it HAS landed.
 *
 * A scroll can be computed correctly and still end up in the wrong place, if
 * the thing it was computed against is re-measured immediately afterwards — the
 * sort's explanatory line appearing above the table, the dock swapping to the
 * selection bar, the window being dragged. These two absorb that.
 */
const SETTLE_DELAYS_MS = [100, 300];

/**
 * Deliver a scroll to a list that may not be there yet.
 *
 * ─ WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * The register asks for a row to be brought into view from an effect, and an
 * effect runs the moment React has committed — which on the virtualised path is
 * BEFORE the browser has told AutoSizer how big the list is, and therefore
 * before react-window exists to be scrolled at all. The old answer was a blind
 * retry: run it now, and again at 100ms and 300ms, whether or not anything was
 * listening. Two things were wrong with that. It kept scrolling a list that was
 * already exactly where it should be (harmless), and — the part that showed —
 * once past 300ms it simply gave up, so a register whose first frame was slow
 * lost the request entirely and stayed where an unscrolled list starts: the
 * top, which on a long account is its oldest transaction.
 *
 * So the retry is MEASURED instead of blind. `apply` reports whether it had
 * anything to scroll; it is asked again until it says yes, and only then does
 * the pair of settling passes run. The caller gets back a cancel function and
 * must call it (it is an effect's cleanup), or a request the user has moved on
 * from will land on top of wherever they moved to.
 *
 * @param apply performs the scroll, and returns whether there was a list (or a
 *              container, on the non-virtualised path) to perform it against.
 *              It must be safe to call more than once — every alignment this
 *              app scrolls with is absolute, so re-applying is a no-op.
 * @returns a cancel function; call it from the effect's cleanup.
 */
export function deliverScroll(apply: () => boolean): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  let cancelled = false;

  const schedule = (run: () => void, delay: number): void => {
    timers.push(setTimeout(() => {
      if (!cancelled) run();
    }, delay));
  };

  const settle = (): void => {
    for (const delay of SETTLE_DELAYS_MS) schedule(() => { apply(); }, delay);
  };

  const attempt = (waited: number): void => {
    if (apply()) {
      settle();
      return;
    }
    if (waited >= ATTEMPT_BUDGET_MS) return;
    schedule(() => attempt(waited + ATTEMPT_INTERVAL_MS), ATTEMPT_INTERVAL_MS);
  };

  attempt(0);

  return () => {
    cancelled = true;
    for (const timer of timers) clearTimeout(timer);
  };
}
