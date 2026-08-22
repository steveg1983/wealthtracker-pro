import { useEffect, useMemo, useState } from 'react';
import type { Account } from '../types';
import type { PeriodRange } from './usePeriod';
import {
  buildNetWorthConversion,
  type NetWorthConversion,
  type NetWorthConversionByDate,
} from '../utils/netWorthSeries';
import { getExchangeRatesWithProvenance, type RatesProvenance } from '../utils/currency-decimal';
import { getHistoricalRates, fxDayKey, type HistoricalRates } from '../services/historicalRatesService';
import { toDecimal, type DecimalInstance } from '../utils/decimal';
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
 * WITH `history` (the owner's backdated-rates ask, 22 Aug): the hook also
 * loads the ECB's daily reference-rate history for the window and returns a
 * dated conversion — each snapshot then converts at ITS OWN day's rate, a
 * 2017 balance at 2017's rate, and "today's rates applied to that day's
 * balances" retires as a caveat. When the history cannot be had (offline,
 * first run with no cache) the hook degrades to exactly the pre-history
 * behaviour — today's rates throughout, the old caveat still true — rather
 * than degrade to silence. `historical` says which basis is in force, so the
 * page states the right one.
 *
 * `conversion` is null while every account is already in the display currency
 * — the single-currency majority pays nothing and sees no note. Until rates
 * arrive (or if they never do) the foreign currencies are reported as
 * UNCONVERTED rather than guessed: ConvertedTotalNote's serious state, said
 * out loud.
 */
export function useNetWorthConversion(
  accounts: readonly Account[],
  history?: { range: PeriodRange }
): {
  /** Today's-rates factors — for current balances and as the degraded basis. */
  conversion: NetWorthConversion | null;
  /** What the series walk should take: dated when history is in force. */
  seriesConversion: NetWorthConversion | NetWorthConversionByDate | null;
  /** Per-date factors for a drill into one day; null while degraded. */
  conversionAt: ((date: Date) => NetWorthConversion | null) | null;
  /** True when per-date reference rates are in force for the series. */
  historical: boolean;
  provenance: RatesProvenance | null;
  displayCurrency: string;
} {
  const { displayCurrency } = useCurrencyDecimal();
  const [ratesState, setRatesState] = useState<{ rates: Record<string, number>; provenance: RatesProvenance } | null>(null);
  const [historyState, setHistoryState] = useState<HistoricalRates | null>(null);

  const foreignCurrencies = useMemo(
    () => [...new Set(
      accounts
        .map(a => a.currency || displayCurrency)
        .filter(c => c !== displayCurrency)
    )].sort(),
    [accounts, displayCurrency]
  );
  const wantsHistory = history !== undefined && foreignCurrencies.length > 0;
  // Primitives, so the effect below re-runs on a real change of window and
  // not on every render's fresh range object.
  const historyFromKey = history?.range.from ? fxDayKey(history.range.from) : null;
  const historyToKey = history?.range.to ? fxDayKey(history.range.to) : null;

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

  useEffect(() => {
    if (!wantsHistory) {
      setHistoryState(null);
      return;
    }
    let live = true;
    void (async () => {
      // A window with no stated start reaches for the whole series — the ECB
      // epoch is the floor and the fetch is one small cached request. The
      // currencies include the display one when it is not the GBP pivot,
      // because every factor needs both legs' rates. Keys parse by triple,
      // never by ISO string — an ISO string parses as UTC and moves a day
      // boundary on any machine not on it.
      const parseKey = (key: string): Date => {
        const [y, m, d] = key.split('-').map(Number);
        return new Date(y, m - 1, d);
      };
      const from = historyFromKey ? parseKey(historyFromKey) : new Date(1999, 0, 4);
      const to = historyToKey ? parseKey(historyToKey) : new Date();
      const wanted = displayCurrency === 'GBP'
        ? foreignCurrencies
        : [...new Set([...foreignCurrencies, displayCurrency])];
      const result = await getHistoricalRates(wanted, from, to);
      if (live) setHistoryState(result.provenance === null ? null : result);
    })();
    return () => { live = false; };
    // foreignCurrencies is derived and array-fresh each render; its JOIN is
    // the stable identity of what is actually wanted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsHistory, historyFromKey, historyToKey, displayCurrency, foreignCurrencies.join(',')]);

  const conversion = useMemo((): NetWorthConversion | null => {
    if (foreignCurrencies.length === 0) return null;
    if (!ratesState) {
      return {
        factors: new Map(),
        unconverted: foreignCurrencies,
      };
    }
    return buildNetWorthConversion(accounts, ratesState.rates, displayCurrency);
  }, [accounts, ratesState, displayCurrency, foreignCurrencies]);

  const dated = useMemo((): {
    byDate: NetWorthConversionByDate;
    at: (date: Date) => NetWorthConversion | null;
  } | null => {
    if (!wantsHistory || historyState === null) return null;
    const unavailable = new Set(historyState.unavailable);
    // The display currency's own series missing means NO factor can be built:
    // degrade to the live-rates basis rather than half-convert.
    if (displayCurrency !== 'GBP' && unavailable.has(displayCurrency)) return null;
    const unconverted = foreignCurrencies.filter(c => unavailable.has(c));
    const byDay = new Map<string, NetWorthConversion>();
    const at = (date: Date): NetWorthConversion | null => {
      const key = fxDayKey(date);
      const held = byDay.get(key);
      if (held) return held;
      const factors = new Map<string, DecimalInstance>();
      const displayRate = historyState.rateOn(date, displayCurrency);
      for (const account of accounts) {
        const currency = account.currency || displayCurrency;
        if (currency === displayCurrency) continue;
        const accountRate = historyState.rateOn(date, currency);
        if (accountRate === null || displayRate === null) continue;
        // Units-per-GBP both sides, GBP the pivot: A→display is
        // rate(display)/rate(A) — the app's one conversion arithmetic.
        factors.set(account.id, toDecimal(displayRate).dividedBy(toDecimal(accountRate)));
      }
      const built: NetWorthConversion = { factors, unconverted };
      byDay.set(key, built);
      return built;
    };
    return { byDate: { at, unconverted }, at };
  }, [wantsHistory, historyState, accounts, displayCurrency, foreignCurrencies]);

  return {
    conversion,
    seriesConversion: dated?.byDate ?? conversion,
    conversionAt: dated?.at ?? null,
    historical: dated !== null,
    provenance: ratesState?.provenance ?? null,
    displayCurrency,
  };
}
