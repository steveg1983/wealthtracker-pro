import { useMemo } from 'react';
import type { Account } from '../types';
import type { FlowFactorResolver } from '../utils/incomeExpense';
import { useNetWorthConversion } from './useNetWorthConversion';

/**
 * THE FLOWS SEAM'S RESOLVER (the disclosure ruling, 22 Aug §7 phase 1):
 * each row's factor into the display currency at the row's OWN date, from
 * the same ECB history the net-worth series values itself against — so a
 * 2017 dollar purchase converts at 2017's rate, never today's.
 *
 * ONE hook for every surface that aggregates flows — the report dataset,
 * the dashboard's income-and-expenses card, the report widgets — which is
 * ruling C by construction: surfaces that share the resolver cannot sum the
 * same money on different bases.
 *
 * Undefined while the history is unavailable: the aggregators then stay
 * NATIVE and the surface's mixed-currency disclosure keeps saying so. The
 * seam converts on the real basis or not at all, never on a third one
 * nobody stated. The whole history is fetched (one small cached request),
 * so a row outside any particular window still resolves at its own date.
 */
export function useFlowConvert(accounts: readonly Account[]): FlowFactorResolver | undefined {
  const { conversionAt, historical } = useNetWorthConversion(accounts, {
    range: { from: null, to: null },
  });
  return useMemo<FlowFactorResolver | undefined>(() => {
    if (!historical || conversionAt === null) return undefined;
    return row => conversionAt(new Date(row.date))?.factors.get(row.accountId) ?? null;
  }, [historical, conversionAt]);
}
