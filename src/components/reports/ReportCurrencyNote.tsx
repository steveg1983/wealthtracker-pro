import React, { useMemo } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { useNetWorthConversion } from '../../hooks/useNetWorthConversion';
import { useLedgerSpansCurrencies } from '../../hooks/useLedgerSpansCurrencies';
import MixedCurrencyDisclosure from '../MixedCurrencyDisclosure';
import HistoricRatesRestatementNotice from '../HistoricRatesRestatementNotice';

/**
 * The rate-basis line for a report whose totals convert through the flows
 * seam (the disclosure ruling, 22 Aug §6.2 and §7 phase 1) — mounted by the
 * hub for every report the registry flags 'flows', so the note and the
 * figures cannot come from different mechanisms: this reads the SAME hook
 * the report dataset builds its factors from.
 *
 * Three states, the same ladder the seam itself walks:
 * - single-currency ledger → nothing (the data-health rule);
 * - the ECB history in force → one basis line, every qualification in it,
 *   the pre-1999 clause only when the ledger actually reaches back that far;
 * - degraded (no history) → the seam does not convert, so the Phase 0
 *   mixed-currency disclosure keeps saying the totals are native. Never a
 *   third basis nobody stated.
 */
export default function ReportCurrencyNote(): React.JSX.Element | null {
  const { accounts, transactions } = useApp();
  const spans = useLedgerSpansCurrencies();
  const { historical } = useNetWorthConversion(accounts, { range: { from: null, to: null } });

  // The third clause is real only when a transaction predates the series.
  const reachesPreEpoch = useMemo(() => {
    if (!historical) return false;
    const epoch = new Date(1999, 0, 4).getTime();
    return transactions.some(t => new Date(t.date).getTime() < epoch);
  }, [transactions, historical]);

  if (!spans) return null;
  if (!historical) return <MixedCurrencyDisclosure />;

  return (
    <>
      {/* Figures a reader had already seen changed when the flows converted
          (the ruling §6.4) — said once, dismissibly, under its own key: the
          balances' restatement was a different event, already said. */}
      <HistoricRatesRestatementNotice
        visible={true}
        storageKey="money_management_fx_flows_restatement_dismissed"
      >
        <span className="font-semibold text-gray-900 dark:text-white">
          Report figures have been recalculated.
        </span>{' '}
        Amounts in other currencies are now converted at the reference rate for each
        transaction&rsquo;s own date, so totals may differ from what you saw
        previously. Your recorded transactions are unchanged.
      </HistoricRatesRestatementNotice>
      <p className="text-dense text-gray-500 dark:text-gray-400" data-testid="report-currency-basis">
        ≈ Converted at each day&rsquo;s ECB reference rate. Weekends and holidays carry
        the previous business day&rsquo;s rate.
        {reachesPreEpoch ? <> Amounts before 4 Jan 1999 use the earliest rate available.</> : null}
      </p>
    </>
  );
}
