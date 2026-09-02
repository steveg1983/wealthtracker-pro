/**
 * A portfolio's traded securities — the door to each one's register.
 *
 * Renders under a portfolio card when imported trading history exists for
 * that account: one row per security ever traded there, with its span and
 * its realised result (derived from events alone — the pooled basis needs
 * no prices), each opening the full register. This is the answer to the
 * owner's question — "how can I look back at the buys / sells of EMG?" —
 * asked about portfolios that closed years ago.
 *
 * The component also owns the closed-card EMPTY sentence: it alone knows
 * whether events exist, and a filtered- or empty-looking card must say what
 * is true ("no holdings were recorded") rather than render a silence.
 */
import { useEffect, useMemo, useState } from 'react';
import { dataPort } from '@data';
import { buildSecurityRegister } from '../services/investments/securityRegister';
import type { InvestmentEvent } from '../services/investments/events';
import SecurityHistoryModal from './SecurityHistoryModal';
import { formatCurrency } from '../utils/currency-decimal';
import { compareText } from '../utils/localeFormat';

interface PortfolioTradingHistoryProps {
  accountId: string;
  /** Whether the card above already shows holdings — decides the empty story. */
  hasHoldings: boolean;
}

interface TradedSecurity {
  key: string;
  symbol: string | null;
  securityName: string;
  currency: string;
  events: InvestmentEvent[];
  firstYear: string;
  lastYear: string;
  realised: ReturnType<typeof buildSecurityRegister>['realisedGain'];
  stillHeld: boolean;
}

export default function PortfolioTradingHistory({
  accountId,
  hasHoldings
}: PortfolioTradingHistoryProps): React.JSX.Element | null {
  const [events, setEvents] = useState<InvestmentEvent[] | null>(null);
  const [openSecurity, setOpenSecurity] = useState<TradedSecurity | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await dataPort.listInvestmentEvents(accountId);
        if (!cancelled) setEvents(rows);
      } catch {
        // Non-fatal: the card above still stands. Degrades to "no history",
        // which is what a failed read honestly knows.
        if (!cancelled) setEvents([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const securities = useMemo((): TradedSecurity[] => {
    if (events === null || events.length === 0) return [];
    const grouped = new Map<string, InvestmentEvent[]>();
    for (const event of events) {
      const key = event.symbol ?? `name:${event.securityName}`;
      (grouped.get(key) ?? grouped.set(key, []).get(key)!).push(event);
    }
    return [...grouped.entries()]
      .map(([key, group]): TradedSecurity => {
        const register = buildSecurityRegister(group, []);
        const dates = group.map((e) => e.date).sort();
        return {
          key,
          symbol: group[0].symbol,
          securityName: group[0].securityName,
          currency: group[0].currency,
          events: group,
          firstYear: dates[0].slice(0, 4),
          lastYear: dates[dates.length - 1].slice(0, 4),
          realised: register.realisedGain,
          stillHeld: !register.endQuantity.isZero()
        };
      })
      .sort((a, b) => compareText(a.securityName, b.securityName));
  }, [events]);

  // Still reading: say nothing yet rather than flash a wrong empty story.
  if (events === null) return null;

  if (securities.length === 0) {
    if (hasHoldings) return null;
    return (
      <p className="text-body text-gray-500 dark:text-gray-400">
        No holdings were recorded for this portfolio. Its transactions are still in its register,
        reachable from Closed Accounts on the Accounts page.
      </p>
    );
  }

  return (
    <div className={hasHoldings ? 'mt-4 border-t border-line dark:border-gray-700 pt-4' : ''}>
      <p className="text-body font-medium text-gray-900 dark:text-white mb-2">Securities traded</p>
      <ul className="divide-y divide-gray-100 dark:divide-gray-700/50">
        {securities.map((security) => (
          <li key={security.key}>
            <button
              type="button"
              onClick={() => setOpenSecurity(security)}
              className="w-full flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors rounded"
            >
              <span className="text-body text-gray-900 dark:text-white">
                {security.securityName}
                {security.symbol ? ` (${security.symbol})` : ''}
              </span>
              <span className="text-body text-gray-500 dark:text-gray-400 tabular-nums">
                {security.firstYear === security.lastYear
                  ? security.firstYear
                  : `${security.firstYear}–${security.lastYear}`}
                {' · '}
                {security.events.length} trade{security.events.length === 1 ? '' : 's'}
                {/* Nothing sold yet realises nothing — a £0.00 there is
                    noise, not information. */}
                {security.stillHeld && security.realised.isZero()
                  ? ''
                  : ` · Realised ${formatCurrency(security.realised, security.currency)}`}
                {security.stillHeld ? ' · still held' : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {openSecurity && (
        <SecurityHistoryModal
          symbol={openSecurity.symbol}
          securityName={openSecurity.securityName}
          currency={openSecurity.currency}
          events={openSecurity.events}
          onClose={() => setOpenSecurity(null)}
        />
      )}
    </div>
  );
}
