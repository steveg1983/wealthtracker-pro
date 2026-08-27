/**
 * One security's full trading register — the Microsoft Money shape for a
 * position that was TRADED, derived live from its imported events and its
 * price series (buildSecurityRegister holds the arithmetic and the rulings;
 * nothing here is stored).
 *
 * Opened from a portfolio's "Securities traded" list. Read-only by design:
 * the trades are imported history, and revaluing belongs to the holdings
 * that exist today (HoldingRegisterModal's Revalue form), not to a closed
 * story. A symbol-less security simply has no price series — its register
 * is its trades, and that is said in the footer rather than hidden.
 */
import { useEffect, useMemo, useState } from 'react';
import { dataPort } from '@data';
import { Modal, ModalBody } from './common/Modal';
import { buildSecurityRegister } from '../services/investments/securityRegister';
import type { SecurityRegisterLine } from '../services/investments/securityRegister';
import type { InvestmentEvent } from '../services/investments/events';
import type { HoldingPricePoint } from '../services/investments/holdingRegister';
import { formatCurrency } from '../utils/currency-decimal';

interface SecurityHistoryModalProps {
  symbol: string | null;
  securityName: string;
  currency: string;
  /** This security's events in this account — the opener already has them. */
  events: InvestmentEvent[];
  onClose: () => void;
}

const EVENT_WORD: Record<SecurityRegisterLine['kind'], string> = {
  buy: 'Buy',
  sell: 'Sell',
  write_off: 'Written off — worthless',
  revaluation: 'Revaluation'
};

const SOURCE_WORD: Record<HoldingPricePoint['source'], string> = {
  quote: 'quoted',
  manual: 'you set this',
  trade: 'from a trade',
  import: 'imported'
};

export default function SecurityHistoryModal({
  symbol,
  securityName,
  currency,
  events,
  onClose
}: SecurityHistoryModalProps): React.JSX.Element {
  const [series, setSeries] = useState<HoldingPricePoint[] | null>(symbol === null ? [] : null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (symbol === null) return; // no ticker, no series — trades-only, honestly
    let cancelled = false;
    void (async () => {
      try {
        const prices = await dataPort.listInvestmentPrices(symbol);
        if (!cancelled) setSeries(prices);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'The price history could not be read.');
          setSeries([]); // the trades still stand on their own
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const register = useMemo(
    () => (series === null ? null : buildSecurityRegister(events, series)),
    [events, series]
  );

  const title = symbol === null ? `${securityName} — register` : `${symbol} — register`;

  return (
    <Modal isOpen onClose={onClose} title={title} size="lg">
      <ModalBody>
        <div className="space-y-4">
          {loadError && (
            <p role="alert" className="text-body text-red-700 dark:text-red-400">
              {loadError} The trades below still stand.
            </p>
          )}

          {register === null && (
            <p className="text-body text-gray-500 dark:text-gray-400">Reading the price history…</p>
          )}

          {register && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="py-2 pr-3 font-medium">Date</th>
                      <th className="py-2 px-3 font-medium">Event</th>
                      <th className="py-2 px-3 text-right font-medium">Units</th>
                      <th className="py-2 px-3 text-right font-medium">Price</th>
                      <th className="py-2 px-3 text-right font-medium">Amount</th>
                      <th className="py-2 pl-3 text-right font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {register.lines.map((line, index) => (
                      <tr
                        key={`${line.date}-${index}`}
                        className="border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                      >
                        {/* nowrap: a date split across lines ("2010-04-␍19")
                            is what the owner's first real screenshot showed.
                            The table's overflow container scrolls instead. */}
                        <td className="py-2 pr-3 tabular-nums whitespace-nowrap text-gray-900 dark:text-white">{line.date}</td>
                        <td className="py-2 px-3 text-gray-700 dark:text-gray-300">
                          {line.kind === 'revaluation'
                            ? `Revaluation — ${SOURCE_WORD[line.source as HoldingPricePoint['source']] ?? 'recorded'}`
                            : EVENT_WORD[line.kind]}
                          {line.realised !== null && (
                            <span className="block text-xs text-gray-500 dark:text-gray-400">
                              Realised {formatCurrency(line.realised, currency)}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-gray-900 dark:text-white">
                          {line.quantityAfter.toString()}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-gray-900 dark:text-white">
                          {line.price === null ? '—' : formatCurrency(line.price, currency)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-gray-900 dark:text-white">
                          {line.amount.isZero() && line.kind === 'write_off'
                            ? '—'
                            : formatCurrency(line.amount, currency)}
                        </td>
                        <td className="py-2 pl-3 text-right tabular-nums text-gray-900 dark:text-white">
                          {formatCurrency(line.runningValue, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-1">
                <p className="text-body text-gray-500 dark:text-gray-400">
                  Bought {formatCurrency(register.invested, currency)} · Sold{' '}
                  {formatCurrency(register.proceeds, currency)} · Realised{' '}
                  {formatCurrency(register.realisedGain, currency)}
                  {register.endQuantity.isZero()
                    ? ''
                    : ` · Still held: ${register.endQuantity.toString()} units, ${formatCurrency(register.endValue, currency)}`}
                </p>
                {symbol === null && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    This security has no ticker symbol, so there is no price history — the register is
                    its trades.
                  </p>
                )}
                {register.skipped.pricesWhileNothingHeld > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {register.skipped.pricesWhileNothingHeld} price
                    {register.skipped.pricesWhileNothingHeld === 1 ? '' : 's'} fell in a stretch when
                    nothing was held and moved nothing.
                  </p>
                )}
                {register.skipped.soldMoreThanHeld > 0 && (
                  <p className="text-xs text-red-700 dark:text-red-400">
                    {register.skipped.soldMoreThanHeld} sale
                    {register.skipped.soldMoreThanHeld === 1 ? '' : 's'} exceeded the units held and
                    {register.skipped.soldMoreThanHeld === 1 ? ' was' : ' were'} clamped — this history
                    does not fold cleanly.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </ModalBody>
    </Modal>
  );
}
