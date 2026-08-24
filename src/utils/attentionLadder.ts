/**
 * THE APP'S ONE NEXT THING.
 *
 * Amber means "this one, next" — singular. It was singular per PAGE, which
 * on a real ledger meant four surfaces each claiming to be the next thing at
 * the same time: Accounts' feed button, Categorisation's panel, its seven
 * Confirm buttons, and Categories' data-health panel. Design's ruling of
 * 24 August: the ladder is evaluated **per app**, because a user does not
 * experience one page at a time.
 *
 * ── THE ORDER, AND THE TEST THAT PRODUCED IT ────────────────────────────────
 *
 *   feed → review → reconcile → categorise
 *
 * Not an importance ranking — a DEPENDENCY chain. The test for any future
 * rung, so this never needs re-deciding:
 *
 *   > Does this rung's output become untrue if the rung above it is
 *   > outstanding?
 *
 *   feed → review        passes: missing rows change the count.
 *   review → reconcile   passes: unreviewed rows make the difference
 *                        provisional.
 *   reconcile → categorise  FAILS: an uncategorised row is untidy whether or
 *                        not the account agrees.
 *
 * So categorise is last not because it matters least, but because nothing
 * depends on it — the honest reason, and a more durable one than importance.
 *
 * ── WHAT STANDING DOWN MEANS ────────────────────────────────────────────────
 *
 * COUNTS NEVER HIDE. A surface that is not the active rung keeps every
 * figure and every word it had; it gives up only the COLOUR. The work is
 * still real and still visible — it simply stops claiming to be the thing to
 * do first. Hiding the count would be a different and much worse product:
 * the app would be deciding what the user may know.
 *
 * ── WHAT THIS DOES NOT GOVERN ───────────────────────────────────────────────
 *
 * In-flow marks. The ladder answers "where should I go?"; a mark inside a
 * flow answers "where am I?", and a reader who has arrived no longer needs
 * directing. Design's boundary, so the exemption cannot become a loophole —
 * an in-flow amber qualifies only if ALL THREE hold:
 *
 *   1. the user navigated here deliberately;
 *   2. it marks position or progress rather than soliciting a click;
 *   3. it disappears when the flow completes.
 *
 * Reconciliation's row rails pass all three and are untouched. A banner
 * offering work on a page the user landed on incidentally fails (1) and
 * belongs to the ladder.
 */

/** The rungs, in dependency order. The array IS the order. */
export const ATTENTION_RUNGS = ['feed', 'review', 'reconcile', 'categorise'] as const;

export type AttentionRung = typeof ATTENTION_RUNGS[number];

/**
 * What is outstanding, per rung. A caller supplies whatever it knows;
 * anything absent is treated as "nothing outstanding" rather than unknown,
 * because a surface that cannot see a rung must not be able to silence one.
 */
export interface AttentionState {
  /** Bank connections that have stopped delivering. */
  feed?: number;
  /** Imported rows nobody has looked at yet. */
  review?: number;
  /** Accounts whose statement balance disagrees. */
  reconcile?: number;
  /**
   * Work of the CATEGORISE kind, wherever it is reported. Design's ruling:
   * a rung is a kind of work, not a location — two surfaces reporting one
   * rung is normal, where two rungs reporting one condition would
   * double-count the same outstanding work. So Categorisation's unfiled
   * rows and Categories' data-health findings are one rung between them.
   */
  categorise?: number;
}

/**
 * The single rung that may wear amber right now, or null when there is no
 * outstanding work at all.
 */
export function activeRung(state: AttentionState): AttentionRung | null {
  for (const rung of ATTENTION_RUNGS) {
    if ((state[rung] ?? 0) > 0) return rung;
  }
  return null;
}

/**
 * May this surface wear amber?
 *
 * The question every consumer asks, phrased so the answer cannot be
 * accidentally inverted: a surface names the rung it REPORTS, and gets back
 * whether it is the one the app is pointing at.
 */
export function rungWearsAmber(state: AttentionState, rung: AttentionRung): boolean {
  return activeRung(state) === rung;
}
