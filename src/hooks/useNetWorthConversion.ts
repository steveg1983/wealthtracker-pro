import { useEffect, useMemo, useState } from 'react';
import type { Account } from '../types';
import { buildNetWorthConversion, type NetWorthConversion } from '../utils/netWorthSeries';
import { getExchangeRatesWithProvenance, type RatesProvenance } from '../utils/currency-decimal';
import { useCurrencyDecimal } from './useCurrencyDecimal';

/**
 * The net-worth series' currency conversion, for every surface that draws it
 * (Claude Design, 22 Aug §1 — and the finding underneath: the walk summed
 * native units as display units, so a dollar balance counted as that many
 * pounds while the dashboard's summary converted properly).
 *
 * ONE hook, because two surfaces draw the same series — the report and the
 * dashboard card — and ruling C is precisely that they may not disagree about
 * the same money. Each computes its factors from the same rates cache every
 * other conversion in the app uses.
 *
 * `conversion` is null while every account is already in the display currency
 * — the single-currency majority pays nothing and sees no note. Until rates
 * arrive (or if they never do) the foreign currencies are reported as
 * UNCONVERTED rather than guessed: ConvertedTotalNote's serious state, said
 * out loud.
 */
export function useNetWorthConversion(accounts: readonly Account[]): {
  conversion: NetWorthConversion | null;
  provenance: RatesProvenance | null;
  displayCurrency: string;
} {
  const { displayCurrency } = useCurrencyDecimal();
  const [ratesState, setRatesState] = useState<{ rates: Record<string, number>; provenance: RatesProvenance } | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const { rates, provenance } = await getExchangeRatesWithProvenance();
        if (live) setRatesState({ rates, provenance });
      } catch {
        // No rates at all: the walk stays native and the caller's note
        // reports every foreign currency as unconverted. Nothing to throw
        // at the user.
      }
    })();
    return () => { live = false; };
  }, []);

  const conversion = useMemo((): NetWorthConversion | null => {
    const foreign = accounts.filter(a => (a.currency || displayCurrency) !== displayCurrency);
    if (foreign.length === 0) return null;
    if (!ratesState) {
      return {
        factors: new Map(),
        unconverted: [...new Set(foreign.map(a => a.currency))].sort(),
      };
    }
    return buildNetWorthConversion(accounts, ratesState.rates, displayCurrency);
  }, [accounts, ratesState, displayCurrency]);

  return { conversion, provenance: ratesState?.provenance ?? null, displayCurrency };
}
