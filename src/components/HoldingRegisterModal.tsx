/**
 * One holding's register — the Microsoft Money shape, derived live.
 *
 * Opened by clicking a holding on the Portfolio tab. Every revaluation line
 * is computed from consecutive points of the symbol's price series
 * (buildHoldingRegister holds the arithmetic and the rulings); nothing here
 * is stored, so a corrected price corrects this view on the next open.
 *
 * Revalue is the register's one write: the owner types a price, it files as
 * MANUAL provenance — the strongest, overwriting its day — and the series
 * reloads so the new line appears where it will always appear. The snapshot
 * on the holding row follows only when the typed date is the newest.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { dataPort } from '@data';
import { Modal, ModalBody } from './common/Modal';
import { buildHoldingRegister, type HoldingPricePoint } from '../services/investments/holdingRegister';
import type { InvestmentHolding } from '../services/investments/holding';
import { formatCurrency, formatUnitPrice } from '../utils/currency-decimal';

interface HoldingRegisterModalProps {
  holding: InvestmentHolding;
  onClose: () => void;
  /** The snapshot may have moved (a newest-date revalue) — the page re-reads. */
  onPricesChanged: () => void;
}

const SOURCE_WORD: Record<HoldingPricePoint['source'] | 'purchase', string> = {
  purchase: 'Buy',
  quote: 'Revaluation — quoted',
  manual: 'Revaluation — you set this',
  trade: 'Revaluation — from a trade',
  import: 'Revaluation — imported'
};

const today = (): string => new Date().toISOString().slice(0, 10);

export default function HoldingRegisterModal({
  holding,
  onClose,
  onPricesChanged
}: HoldingRegisterModalProps): React.JSX.Element {
  const [series, setSeries] = useState<HoldingPricePoint[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [revaluePrice, setRevaluePrice] = useState('');
  const [revalueDate, setRevalueDate] = useState(today());
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      setSeries(await dataPort.listInvestmentPrices(holding.symbol));
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'The price history could not be read.');
    }
  }, [holding.symbol]);

  useEffect(() => {
    void load();
  }, [load]);

  const register = useMemo(
    () => (series === null ? null : buildHoldingRegister(holding, series)),
    [holding, series]
  );

  const revalue = useCallback(async (): Promise<void> => {
    const price = revaluePrice.trim();
    if (price === '' || Number.isNaN(Number(price)) || Number(price) < 0) {
      setSaveError('Enter the price of one unit — a plain number, 0 or more.');
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      await dataPort.recordInvestmentPrice({
        symbol: holding.symbol,
        date: revalueDate,
        price,
        currency: holding.currency
      });
      setRevaluePrice('');
      await load();
      onPricesChanged();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'The price could not be saved.');
    } finally {
      setIsSaving(false);
    }
  }, [holding.currency, holding.symbol, load, onPricesChanged, revalueDate, revaluePrice]);

  return (
    <Modal isOpen onClose={onClose} title={`${holding.symbol} — register`} size="lg">
      <ModalBody>
      <div className="space-y-4">
        {loadError && (
          <p role="alert" className="text-body text-red-700 dark:text-red-400">{loadError}</p>
        )}

        {register === null && !loadError && (
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
                    <th className="py-2 px-3 text-right font-medium">Price</th>
                    <th className="py-2 px-3 text-right font-medium">Amount</th>
                    <th className="py-2 pl-3 text-right font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {register.lines.map((line, index) => (
                    <tr
                      key={`${line.date ?? 'undated'}-${index}`}
                      className="border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                    >
                      {/* nowrap, as in SecurityHistoryModal: dates must not
                          split across lines; the overflow container scrolls. */}
                      <td className="py-2 pr-3 tabular-nums whitespace-nowrap text-gray-900 dark:text-white">
                        {line.date ?? '—'}
                      </td>
                      <td className="py-2 px-3 text-gray-700 dark:text-gray-300">
                        {SOURCE_WORD[line.source]}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-gray-900 dark:text-white">
                        {line.price === null ? '—' : formatUnitPrice(line.price, holding.currency)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-gray-900 dark:text-white">
                        {formatCurrency(line.amount, holding.currency)}
                      </td>
                      <td className="py-2 pl-3 text-right tabular-nums text-gray-900 dark:text-white">
                        {formatCurrency(line.runningValue, holding.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-baseline justify-between border-t border-gray-200 dark:border-gray-700 pt-3">
              <span className="text-body text-gray-500 dark:text-gray-400">
                Value {formatCurrency(register.value, holding.currency)} · Gain{' '}
                {formatCurrency(register.gain, holding.currency)}
              </span>
              {register.pricesBeforePurchase > 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {register.pricesBeforePurchase} earlier price
                  {register.pricesBeforePurchase === 1 ? '' : 's'} predate this purchase and are not
                  counted.
                </span>
              )}
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <p className="text-body font-medium text-gray-900 dark:text-white mb-2">Revalue</p>
              <div className="flex flex-wrap items-end gap-3">
                <label className="block">
                  <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Price per unit ({holding.currency})
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={revaluePrice}
                    onChange={(e) => setRevaluePrice(e.target.value)}
                    placeholder="0.00"
                    className="w-36 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300/50 dark:border-gray-600/50 rounded-lg text-gray-900 dark:text-white"
                  />
                </label>
                <label className="block">
                  <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">On</span>
                  <input
                    type="date"
                    value={revalueDate}
                    max={today()}
                    onChange={(e) => setRevalueDate(e.target.value)}
                    className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300/50 dark:border-gray-600/50 rounded-lg text-gray-900 dark:text-white"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void revalue()}
                  disabled={isSaving}
                  className="px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Saving…' : 'Record price'}
                </button>
              </div>
              {saveError && (
                <p role="alert" className="mt-2 text-body text-red-700 dark:text-red-400">{saveError}</p>
              )}
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                A price you set replaces that day&rsquo;s figure. The register recalculates from the
                series, so the line lands where the date puts it.
              </p>
            </div>
          </>
        )}
      </div>
      </ModalBody>
    </Modal>
  );
}
