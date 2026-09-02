import React, { useMemo, useState } from 'react';
import PageWrapper from '../components/PageWrapper';
import { useApp } from '../contexts/AppContextSupabase';
import { useHistoricalAccounts } from '../hooks/useHistoricalAccounts';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal } from '../utils/decimal';
import { buildCategoryKindLookup, classifyFlow } from '../utils/incomeExpense';
import { transferCategoryAccounts } from '../utils/portfolioSummary';
import TransferSweepModal from '../components/TransferSweepModal';
import { formatCount } from '../utils/localeFormat';

/**
 * Transfer Links — the audit-trail chore, as its own Manage page.
 *
 * The owner's ask (20 Aug): "from an audit trail point of view … every
 * transfer in reality should be linked. I would like to set a page up under
 * 'Manage' just like we have done for Payees, and Category tidy up etc. To
 * be able to try and 'link' old transfers to one another. Would we be able
 * to read the transactions of closed accounts for this?" — yes: the ledger
 * holds every closed account's rows, and the sweep beneath this page runs
 * over all of them.
 *
 * TWO KINDS OF ONE-SIDEDNESS, and this page says which is which:
 *
 *  - NEW transfers are never one-sided — the quick-add and the editor mint
 *    the counterpart through createTransferCounterpart. One-sided legs are
 *    IMPORTED history (Money/QIF/OFX), where only one bank's statement
 *    carried the movement.
 *  - A leg can also merely LOOK one-sided: filed under "To/From <account>"
 *    with the counterpart account closed, the editor's picker used to show
 *    an empty box (the owner's 2016 example). Naming is fixed in the editor;
 *    linking the actual rows is this page's job.
 *
 * The heavy machinery is the existing TransferSweepModal — pair matching,
 * split-line matches, stranded findings, refusals remembered — reached from
 * here as a first-class door rather than from inside Categorisation alone.
 * The figures above the door are counted from the same classification the
 * sweep uses, so the door never promises work the sweep cannot see.
 */
export default function TransferLinks(): React.JSX.Element {
  const { transactions, categories, accounts: openAccounts } = useApp();
  const accounts = useHistoricalAccounts(openAccounts);
  const { formatCurrency } = useCurrencyDecimal();
  const [showSweep, setShowSweep] = useState(false);

  const survey = useMemo(() => {
    const kinds = buildCategoryKindLookup(categories);
    const hintAccounts = transferCategoryAccounts(categories);
    const openIds = new Set(openAccounts.map(a => a.id));
    const knownIds = new Set(accounts.map(a => a.id));

    let unlinked = 0;
    let hinted = 0;
    let onClosed = 0;
    let magnitude = toDecimal(0);
    for (const row of transactions) {
      if (row.linkedTransferId) continue;
      if (classifyFlow(row, kinds) !== 'transfer') continue;
      unlinked += 1;
      magnitude = magnitude.plus(toDecimal(row.amount).abs());
      if (row.transferAccountId || hintAccounts.has(row.category)) hinted += 1;
      if (knownIds.has(row.accountId) && !openIds.has(row.accountId)) onClosed += 1;
    }
    return { unlinked, hinted, onClosed, magnitude };
  }, [transactions, categories, openAccounts, accounts]);

  return (
    <PageWrapper title="Transfer Links">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-6">
          <h2 className="text-label uppercase tracking-wider font-medium text-gray-500 dark:text-gray-400">
            Every transfer should have two sides
          </h2>
          <p className="text-dense text-gray-500 dark:text-gray-400 mt-1">
            New transfers always get both sides — the app writes the matching
            row in the other account as you save. One-sided legs come from
            imported history, where only one bank&rsquo;s statement carried the
            movement. Until a leg is linked, the performance and contribution
            figures treat it as money crossing into or out of your accounts
            from outside — which overstates both directions when its other
            half is really sitting in another of your own accounts. Closed
            accounts are included throughout.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-6">
          {survey.unlinked === 0 ? (
            <p className="text-body text-gray-700 dark:text-gray-300">
              Every transfer in your ledger has its other side. Nothing to do here.
            </p>
          ) : (
            <>
              <p className="text-body text-gray-900 dark:text-white">
                <span className="font-bold tabular-nums">{formatCount(survey.unlinked)}</span>
                {' '}transfer {survey.unlinked === 1 ? 'leg has' : 'legs have'} no linked other side
                — {formatCurrency(survey.magnitude)} of movement resting on the
                outside-money assumption.
              </p>
              <ul className="mt-2 space-y-1 text-dense text-gray-500 dark:text-gray-400">
                {survey.hinted > 0 && (
                  <li>
                    {formatCount(survey.hinted)} name the account they moved to or from —
                    the sweep can hunt their other sides there first.
                  </li>
                )}
                {survey.onClosed > 0 && (
                  <li>
                    {formatCount(survey.onClosed)} sit in closed accounts — read, matched
                    and linkable like any other.
                  </li>
                )}
              </ul>
              <button
                type="button"
                onClick={() => setShowSweep(true)}
                className="mt-4 px-4 py-2 bg-[#1a2332] text-white text-body font-medium rounded-lg hover:bg-[#2d3a4d] transition-colors shadow-sm"
              >
                Find and link the pairs
              </button>
              <p className="mt-2 text-dense text-gray-500 dark:text-gray-400">
                Nothing links without your tick — the sweep proposes
                equal-and-opposite pairs, you review, it links what you accept
                and remembers what you refuse.
              </p>
            </>
          )}
        </div>

        <TransferSweepModal isOpen={showSweep} onClose={() => setShowSweep(false)} />
      </div>
    </PageWrapper>
  );
}
