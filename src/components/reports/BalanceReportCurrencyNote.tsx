import React, { useMemo } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { useNetWorthConversion } from '../../hooks/useNetWorthConversion';
import { useLedgerSpansCurrencies } from '../../hooks/useLedgerSpansCurrencies';
import MixedCurrencyDisclosure from '../MixedCurrencyDisclosure';
import HistoricRatesRestatementNotice from '../HistoricRatesRestatementNotice';
import { getDateLocale } from '../../utils/dateFormatter';

/**
 * The rate-basis line for the two balance reports (Net worth, Account
 * balances), whose figures carry TWO bases since the one-net-worth ruling
 * (Design, 24 Aug §1, refined by the owner):
 *
 * - CLOSING figures are a snapshot, valued at the rates of the statement's
 *   own as-at day — today's rates as at today (the Accounts page's exact
 *   factors, so the two surfaces give one answer), that day's ECB reference
 *   rate for a statement as at a past day.
 * - MOVEMENT figures keep the per-day basis: each movement at its own day's
 *   ECB reference rate.
 *
 * The hub's generic ReportCurrencyNote states one basis, which would now be
 * wrong here — so these reports are 'self' on the registry ladder and this
 * note states both. Same ladder of states as the hub's note: nothing for a
 * single-currency ledger; the two-bases line when the history is in force; a
 * balances-convert-but-movements-don't line while the history is loading;
 * the Phase 0 disclosure when there are no rates at all.
 */
export default function BalanceReportCurrencyNote({ asOf }: { asOf: Date }): React.JSX.Element | null {
  const { accounts, transactions } = useApp();
  const spans = useLedgerSpansCurrencies();
  const { historical, provenance } = useNetWorthConversion(accounts, { range: { from: null, to: null } });

  const reachesPreEpoch = useMemo(() => {
    if (!historical) return false;
    const epoch = new Date(1999, 0, 4).getTime();
    return transactions.some(t => new Date(t.date).getTime() < epoch);
  }, [transactions, historical]);

  if (!spans) return null;
  // No display rates at all: nothing converts anywhere — the Phase 0
  // disclosure is the whole truth.
  if (provenance === null) return <MixedCurrencyDisclosure />;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const balancesBasis = asOf.getTime() < startOfToday.getTime()
    ? `the ECB reference rate for ${asOf.toLocaleDateString(getDateLocale(), { day: 'numeric', month: 'long', year: 'numeric' })}`
    : 'today’s rates';

  if (!historical) {
    // Balances already convert (today's rates); the movements cannot until
    // the history arrives — say exactly that, never the blanket Phase 0
    // sentence, which would deny the conversion the balances carry.
    return (
      <p className="text-dense text-gray-500 dark:text-gray-400" data-testid="report-currency-basis">
        ≈ Balances converted at today&rsquo;s rates. Movements in other currencies are
        counted unit-for-unit until the rate history loads.
      </p>
    );
  }

  return (
    <>
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
        ≈ Balances converted at {balancesBasis}; the period&rsquo;s movements at each
        day&rsquo;s ECB reference rate. Weekends and holidays carry the previous
        business day&rsquo;s rate.
        {reachesPreEpoch ? <> Amounts before 4 Jan 1999 use the earliest rate available.</> : null}
      </p>
    </>
  );
}
