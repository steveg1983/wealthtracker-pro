import { useMemo } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useBankConnectionSnapshot } from './useBankConnectionSnapshot';
import { useReconciliation } from './useReconciliation';
import { countAwaitingReview } from '../utils/transactionReview';
import { computeCategoryHealth } from '../utils/categoryHealth';
import { computeIncomeExpense } from '../utils/incomeExpense';
import { expandSplitTransactions } from '../utils/transactionSplits';
import {
  activeRung,
  rungWearsAmber,
  type AttentionRung,
  type AttentionState,
} from '../utils/attentionLadder';

/**
 * WHAT THE APP IS POINTING AT, asked from anywhere.
 *
 * Every consuming surface reads THIS rather than its own count, which is
 * the whole mechanism: a page cannot know it is the next thing by looking
 * only at itself. Accounts' feed button knew nothing about Categorisation's
 * backlog, Categorisation knew nothing about a dead feed, and on a real
 * ledger both were amber at once — each correctly, by its own lights, and
 * wrongly together.
 *
 * The rung order and the reasoning live in utils/attentionLadder; this hook
 * only gathers the state. Keeping the rule in a pure module is deliberate:
 * the ordering is the part worth testing exhaustively, and it should not
 * need React to do it.
 *
 * ── COST ───────────────────────────────────────────────────────────────────
 * Every input here is already computed by the pages that consume it, and all
 * four are memoised on the same context arrays those pages read, so this is
 * arithmetic over data already in hand — not a second pass over the ledger.
 *
 * ── EDITIONS ───────────────────────────────────────────────────────────────
 * The desktop edition has no bank feeds at all (see docs/edition-gating), so
 * its feed rung is permanently zero and the ladder degrades to review-first.
 * That falls out of the snapshot returning nothing rather than needing a
 * branch here.
 */
export interface AttentionLadder {
  /** The one rung that may wear amber, or null when nothing is outstanding. */
  active: AttentionRung | null;
  /** Every rung's outstanding count — surfaces still SHOW theirs. */
  state: AttentionState;
  /**
   * "May I wear amber?" — asked by the rung a surface reports, so the answer
   * cannot be accidentally inverted.
   */
  wearsAmber: (rung: AttentionRung) => boolean;
}

export function useAttentionLadder(): AttentionLadder {
  const { accounts, transactions, transactionSplits, categories } = useApp();
  const connections = useBankConnectionSnapshot();
  const { totalUnreconciledCount } = useReconciliation(accounts, transactions);

  const state = useMemo((): AttentionState => {
    const feed = connections.filter(
      c => c.status === 'error' || c.status === 'reauth_required'
    ).length;

    const review = countAwaitingReview(transactions);

    // CATEGORISE IS ONE RUNG ACROSS TWO SURFACES (Design's ruling): the
    // unfiled backlog and the data-health findings are the same kind of
    // work, so they are summed into one rung rather than competing as two.
    const rows = expandSplitTransactions(transactions, transactionSplits);
    const flows = computeIncomeExpense(rows, [], categories);
    const health = computeCategoryHealth(transactions, transactionSplits, categories);
    const categorise =
      flows.uncategorizedRows.length +
      health.emptyCategoryCount +
      health.transferFilingMismatchCount;

    return { feed, review, reconcile: totalUnreconciledCount, categorise };
  }, [connections, transactions, transactionSplits, categories, totalUnreconciledCount]);

  return useMemo(() => ({
    active: activeRung(state),
    state,
    wearsAmber: (rung: AttentionRung) => rungWearsAmber(state, rung),
  }), [state]);
}
