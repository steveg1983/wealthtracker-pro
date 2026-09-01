import { useMemo, useSyncExternalStore } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { preferences } from '../../services/preferencesService';
import { countAwaitingReview } from '../../utils/transactionReview';

/**
 * IS THE HISTORY GUIDE ON SCREEN? — one question, one answer, two readers
 * (owner's ruling, 1 Sep 2026).
 *
 * ── WHY IT LEFT THE CARD ────────────────────────────────────────────────────
 *
 * In a narrow window — a fresh ledger, a year of statements imported, nothing
 * filed yet — the dashboard showed the first-steps card AND HistoryPathCard, one
 * under the other, saying overlapping things in two voices. The owner's ruling:
 * while the guide is visible, First steps hides, because the guide's first two
 * steps ARE First steps done better and its remaining five are the part that was
 * missing.
 *
 * That makes the guide's visibility a fact TWO components need — the card, to
 * decide whether to draw itself, and ImprovedDashboard, to decide whether to
 * mount its predecessor — so it lives here and is derived exactly once. A gate
 * that re-derived it on the dashboard would be two surfaces disagreeing about
 * which card the reader is looking at, which is the same family of bug as the
 * two counters that disagreed in front of the owner the same week.
 *
 * ── THE RULE, IN THE ORDER IT IS APPLIED ────────────────────────────────────
 *
 *  1. a DISMISSAL is final — whatever the ledger says afterwards;
 *  2. a ledger that has not arrived is not a finished one. Every fact the card
 *     states is read off `transactions`, which is an empty array both while the
 *     boot is in flight and when the load failed outright, so an engaged reader
 *     would otherwise be congratulated — "Nothing left to review", the settled
 *     card, job done — for a second, over a ledger the app had not read yet.
 *     This clause is also what keeps First steps behaving exactly as it always
 *     has during a boot: the guide cannot be up, so the gate is open;
 *  3. otherwise it is up once it has EVER been earned (`engaged`), and earned at
 *     {@link APPEARS_AT_BACKLOG} rows awaiting review. The latch is the point:
 *     the guide's own advice shrinks the number that summoned it, so a card
 *     gated on the live count would vanish at step three of seven.
 *
 * The backlog is asked through `countAwaitingReview` — the app's ONE To Review
 * predicate, the same one the register bolds by and the same one its counter and
 * filter use. A second derivation here would be a fourth answer to one question.
 *
 * Nothing is WRITTEN from here. The latch belongs to the card (it is the thing
 * that appears, and it is mounted whether or not it draws), so this stays a pure
 * read and asking it from another surface costs nothing but the count.
 */

/** The backlog at which the sequence is worth teaching. The owner's number. */
export const APPEARS_AT_BACKLOG = 100;

// Entries in the preferences document rather than in localStorage: the latch and
// the dismissal are statements about the USER, not about this browser, so they
// travel between the phone and the desktop. Read through `subscribe` rather than
// once at mount, because the account's document lands a few hundred milliseconds
// into boot — a dismissal read too early is a dismissed card on screen for the
// whole session. Registered in PORTABLE_PREFERENCE_KEYS with every other
// portable key.
export const ENGAGED_PREFERENCE = 'historyPath.engaged.v1';
export const DISMISSED_PREFERENCE = 'historyPath.dismissed.v1';

/** What the guide knows about itself, and what the dashboard asks it. */
export interface HistoryPathState {
  /**
   * Is the guide ON SCREEN? THE answer — the card returns null when it is false
   * and the dashboard hides First steps when it is true, and neither of them
   * derives it a second time.
   */
  visible: boolean;
  /** The live To Review backlog, in the app's one predicate's terms. */
  backlog: number;
  /** Has the pile ever been big enough to be worth teaching a sequence for? */
  engaged: boolean;
  /** Has the reader put the guide away for good? */
  dismissed: boolean;
}

export function useHistoryPath(): HistoryPathState {
  const { transactions, isLoading, transactionsLoadFailed } = useApp();

  // Re-render when the account's preferences change — including the moment the
  // stored document lands, which is after the first paint. The document object
  // is only the identity React compares; the values are read below.
  useSyncExternalStore(preferences.subscribe, preferences.getDocument, preferences.getDocument);

  const engaged = preferences.getItem(ENGAGED_PREFERENCE) === 'true';
  const dismissed = preferences.getItem(DISMISSED_PREFERENCE) === 'true';
  const backlog = useMemo(() => countAwaitingReview(transactions), [transactions]);

  const visible =
    !dismissed &&
    !isLoading &&
    !transactionsLoadFailed &&
    (engaged || backlog >= APPEARS_AT_BACKLOG);

  return { visible, backlog, engaged, dismissed };
}
