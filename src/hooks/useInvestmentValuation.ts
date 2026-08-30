/**
 * The investment valuation, fetched once and shared by every value surface.
 *
 * One hook because the penny-identical-trio guard demands one answer: the
 * net-worth series, the balance reports, the dashboard trio and the
 * Investments headline all take their valuation term from the SAME build
 * over the SAME three reads (every event, every price, every holding), so
 * two surfaces cannot value the same position differently by fetching at
 * different moments.
 *
 * Until the reads land — and on the device edition, whose seam answers all
 * three with an honest empty — the valuation is EMPTY: deltaAt is zero
 * everywhere, and every surface renders exactly the ledger figures it
 * always did. No loading state leaks: a chart drawn from the ledger is not
 * wrong, it is the pre-3b truth, and the valued redraw follows in one
 * render when the term arrives.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { dataPort } from '@data';
import {
  buildInvestmentValuation,
  type InvestmentValuation,
  type SymbolPricePoint
} from '../services/investments/investmentValuation';
import type { InvestmentEvent } from '../services/investments/events';
import type { InvestmentHolding } from '../services/investments/holding';
import { toDecimal } from '../utils/decimal';

// One shared zero — a fresh Decimal per deltaAt call would churn in the walks.
const zero = toDecimal('0');

/**
 * THE STALENESS SIGNAL (owner, 30 Aug, watching a deleted position keep its
 * −£374.71 on the Overview while the register stood empty: "The 3 areas
 * should all be the same, all the time"). The hook used to fetch once per
 * mount, so a surface that outlived a mutation kept valuing positions that
 * no longer existed until a full page reload. Every mutation now bumps this
 * version; every mounted instance of the hook re-reads. Module-level on
 * purpose: the hook's whole contract is one shared answer, and the signal
 * that answer has changed must be exactly as shared.
 */
let valuationVersion = 0;
const valuationListeners = new Set<() => void>();
export function bumpInvestmentValuation(): void {
  valuationVersion += 1;
  for (const listener of valuationListeners) listener();
}
const subscribeToValuation = (listener: () => void): (() => void) => {
  valuationListeners.add(listener);
  return () => valuationListeners.delete(listener);
};
const readValuationVersion = (): number => valuationVersion;

const EMPTY: InvestmentValuation = {
  deltaAt: () => zero,
  accountIds: new Set<string>(),
  unpricedPositions: 0,
  currencyMismatches: 0
};

export function useInvestmentValuation(): InvestmentValuation {
  const version = useSyncExternalStore(subscribeToValuation, readValuationVersion, readValuationVersion);
  const [inputs, setInputs] = useState<{
    events: InvestmentEvent[];
    holdings: InvestmentHolding[];
    prices: SymbolPricePoint[];
  } | null>(null);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [events, prices, holdings] = await Promise.all([
          dataPort.listAllInvestmentEvents(),
          dataPort.listAllInvestmentPrices(),
          dataPort.listInvestments()
        ]);
        if (!cancelled && isMounted.current) setInputs({ events, holdings, prices });
      } catch {
        // Non-fatal, and it degrades to exactly the pre-3b behaviour: the
        // surfaces value the ledger alone. Better an at-cost chart than a
        // report that refuses to render.
        if (!cancelled && isMounted.current) setInputs({ events: [], holdings: [], prices: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [version]);

  return useMemo(() => {
    if (inputs === null) return EMPTY;
    return buildInvestmentValuation(inputs.events, inputs.holdings, inputs.prices);
  }, [inputs]);
}
