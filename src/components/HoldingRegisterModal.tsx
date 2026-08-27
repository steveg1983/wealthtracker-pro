/**
 * One holding's register — the Microsoft Money shape, derived live.
 *
 * Opened by clicking a holding on the Portfolio tab. TWO derivations, one
 * choice (slice 4): when the holding's (account, symbol) has EVENTS — a buy
 * recorded at creation, imported history, later trades — the register is
 * buildSecurityRegister over them, drawn by the same SecurityRegisterTable
 * the history modal uses, so a live holding and an imported story can never
 * disagree about a trade. The valuation module makes the same choice
 * (events over the holding row), and the register must agree with what net
 * worth counts. Without events — holdings from before the event lane — the
 * original constant-quantity derivation stands, exactly as before.
 *
 * Revalue is the register's one write: the owner types a price, it files as
 * MANUAL provenance — the strongest, overwriting its day — and everything
 * reloads so the new line lands where it will always land. The snapshot on
 * the holding row follows only when the typed date is the newest.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { dataPort } from '@data';
import { Modal, ModalBody } from './common/Modal';
import { buildHoldingRegister, type HoldingPricePoint } from '../services/investments/holdingRegister';
import { buildSecurityRegister } from '../services/investments/securityRegister';
import SecurityRegisterTable from './SecurityRegisterTable';
import type { InvestmentEvent } from '../services/investments/events';
import type { InvestmentHolding } from '../services/investments/holding';
import { formatCurrency, formatUnitPrice } from '../utils/currency-decimal';
import { toDecimal, type DecimalInstance } from '../utils/decimal';

/** A live buy, as the register's form collects it (slice 4). */
export interface LiveBuyDetails {
  quantity: DecimalInstance;
  /** Per unit, in the account's currency. */
  price: DecimalInstance;
  charges: DecimalInstance;
  date: Date;
  /** null: just record — no cash leg. */
  fundingAccountId: string | null;
}

/** A live sale. */
export interface LiveSellDetails {
  quantity: DecimalInstance;
  price: DecimalInstance;
  fees: DecimalInstance;
  date: Date;
  /** null: just record — no cash leg. */
  destinationAccountId: string | null;
}

interface HoldingRegisterModalProps {
  holding: InvestmentHolding;
  onClose: () => void;
  /** The snapshot may have moved (a newest-date revalue) — the page re-reads. */
  onPricesChanged: () => void;
  /** The portfolio's currency — trades only offered when the holding's agrees. */
  accountCurrency?: string;
  /** The portfolio's own nested cash, for Paid from / Proceeds to. */
  fundingAccounts?: ReadonlyArray<{ id: string; name: string }>;
  onBuyMore?: (trade: LiveBuyDetails) => Promise<void>;
  /** Resolves true when the position is fully sold — the page closes this. */
  onSell?: (trade: LiveSellDetails) => Promise<boolean>;
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
  onPricesChanged,
  accountCurrency,
  fundingAccounts = [],
  onBuyMore,
  onSell
}: HoldingRegisterModalProps): React.JSX.Element {
  const [series, setSeries] = useState<HoldingPricePoint[] | null>(null);
  const [events, setEvents] = useState<InvestmentEvent[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [revaluePrice, setRevaluePrice] = useState('');
  const [revalueDate, setRevalueDate] = useState(today());
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /** Which action form is open: Revalue always exists; trades when offered. */
  const [mode, setMode] = useState<'revalue' | 'buy' | 'sell'>('revalue');
  const [tradeQty, setTradeQty] = useState('');
  const [tradePrice, setTradePrice] = useState('');
  const [tradeCosts, setTradeCosts] = useState('');
  const [tradeDate, setTradeDate] = useState(today());
  /** '' = just record, no cash leg; otherwise the sleeve's account id. */
  const [tradeCashId, setTradeCashId] = useState('');

  /**
   * Trades are offered only when the holding prices in the ACCOUNT's own
   * currency — the event lane's invariant (events carry account money). A
   * foreign-priced holding records its trades through Add a holding, where
   * the FX machinery lives.
   */
  const canTrade =
    (onBuyMore !== undefined || onSell !== undefined) &&
    (accountCurrency === undefined || accountCurrency === holding.currency);

  const load = useCallback(async (): Promise<void> => {
    try {
      const [prices, accountEvents] = await Promise.all([
        dataPort.listInvestmentPrices(holding.symbol),
        holding.accountId === null
          ? Promise.resolve([] as InvestmentEvent[])
          : dataPort.listInvestmentEvents(holding.accountId)
      ]);
      setSeries(prices);
      setEvents(accountEvents.filter((event) => event.symbol === holding.symbol));
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'The price history could not be read.');
    }
  }, [holding.accountId, holding.symbol]);

  useEffect(() => {
    void load();
  }, [load]);

  /** The events derivation, when the position has any — see the header. */
  const securityRegister = useMemo(
    () =>
      series === null || events === null || events.length === 0
        ? null
        : buildSecurityRegister(events, series),
    [events, series]
  );

  const register = useMemo(
    () =>
      series === null || securityRegister !== null
        ? null
        : buildHoldingRegister(holding, series),
    [holding, series, securityRegister]
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

  /** Parse a typed figure; null when it is not a plain non-negative number. */
  const parsed = (raw: string, { allowZero = true } = {}): DecimalInstance | null => {
    const text = raw.trim();
    if (text === '' || Number.isNaN(Number(text)) || Number(text) < 0) return null;
    const value = toDecimal(text);
    if (!allowZero && value.isZero()) return null;
    return value;
  };

  const submitTrade = useCallback(async (): Promise<void> => {
    const quantity = parsed(tradeQty, { allowZero: false });
    const price = parsed(tradePrice);
    const costs = tradeCosts.trim() === '' ? toDecimal('0') : parsed(tradeCosts);
    if (quantity === null || price === null || costs === null) {
      setSaveError('Units, price and charges must be plain numbers; units above zero.');
      return;
    }
    if (mode === 'sell' && quantity.greaterThan(holding.quantity)) {
      setSaveError(`Only ${holding.quantity.toString()} units are held.`);
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const date = new Date(`${tradeDate}T00:00:00`);
      if (mode === 'buy' && onBuyMore) {
        await onBuyMore({
          quantity,
          price,
          charges: costs,
          date,
          fundingAccountId: tradeCashId === '' ? null : tradeCashId
        });
      } else if (mode === 'sell' && onSell) {
        const fullySold = await onSell({
          quantity,
          price,
          fees: costs,
          date,
          destinationAccountId: tradeCashId === '' ? null : tradeCashId
        });
        if (fullySold) {
          onClose();
          return;
        }
      }
      setTradeQty('');
      setTradeCosts('');
      await load();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'The trade could not be recorded.');
    } finally {
      setIsSaving(false);
    }
  }, [holding.quantity, load, mode, onBuyMore, onClose, onSell, tradeCashId, tradeCosts, tradeDate, tradePrice, tradeQty]);

  /** The sale's realised preview — pooled basis, same maths the page writes. */
  const sellPreview = useMemo(() => {
    if (mode !== 'sell') return null;
    const quantity = parsed(tradeQty, { allowZero: false });
    const price = parsed(tradePrice);
    const fees = tradeCosts.trim() === '' ? toDecimal('0') : parsed(tradeCosts);
    if (quantity === null || price === null || fees === null) return null;
    if (quantity.greaterThan(holding.quantity)) return null;
    const proceeds = quantity.times(price).minus(fees);
    return { proceeds, realised: proceeds.minus(holding.averageCost.times(quantity)) };
  }, [holding.averageCost, holding.quantity, mode, tradeCosts, tradePrice, tradeQty]);

  const fieldClass =
    'px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300/50 dark:border-gray-600/50 rounded-lg text-gray-900 dark:text-white';

  const tradeForm = (kind: 'buy' | 'sell'): React.JSX.Element => (
    <div className="mt-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Units</span>
          <input
            type="text"
            inputMode="decimal"
            value={tradeQty}
            onChange={(e) => setTradeQty(e.target.value)}
            placeholder={kind === 'sell' ? holding.quantity.toString() : '0'}
            className={`w-28 ${fieldClass}`}
          />
        </label>
        <label className="block">
          <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            Price per unit ({holding.currency})
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={tradePrice}
            onChange={(e) => setTradePrice(e.target.value)}
            placeholder="0.00"
            className={`w-32 ${fieldClass}`}
          />
        </label>
        <label className="block">
          <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            {kind === 'buy' ? 'Charges' : 'Fees'}
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={tradeCosts}
            onChange={(e) => setTradeCosts(e.target.value)}
            placeholder="0.00"
            className={`w-24 ${fieldClass}`}
          />
        </label>
        <label className="block">
          <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">On</span>
          <input
            type="date"
            value={tradeDate}
            max={today()}
            onChange={(e) => setTradeDate(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            {kind === 'buy' ? 'Paid from' : 'Proceeds to'}
          </span>
          <select
            value={tradeCashId}
            onChange={(e) => setTradeCashId(e.target.value)}
            className={fieldClass}
          >
            <option value="">Just record the trade</option>
            {fundingAccounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void submitTrade()}
          disabled={isSaving}
          className="px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary transition-colors disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : kind === 'buy' ? 'Record buy' : 'Record sale'}
        </button>
      </div>
      {kind === 'sell' && sellPreview && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Proceeds {formatCurrency(sellPreview.proceeds, holding.currency)} · Realised{' '}
          {formatCurrency(sellPreview.realised, holding.currency)} on the pooled cost.
        </p>
      )}
      {saveError && (
        <p role="alert" className="mt-2 text-body text-red-700 dark:text-red-400">{saveError}</p>
      )}
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {kind === 'buy'
          ? 'Records the buy in this register; a chosen cash account writes the transfer too.'
          : 'Records the sale: proceeds to the chosen cash account, and the realised result as income.'}
      </p>
    </div>
  );

  const revalueForm = (
    <div>
      <p className="sr-only">Revalue</p>
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
        A price you set replaces that day&rsquo;s figure. The register recalculates from the series,
        so the line lands where the date puts it.
      </p>
    </div>
  );

  /** The register's actions: Revalue always; Buy more / Sell when offered. */
  const modeButton = (value: 'revalue' | 'buy' | 'sell', label: string): React.JSX.Element => (
    <button
      type="button"
      onClick={() => { setMode(value); setSaveError(null); }}
      aria-pressed={mode === value}
      className={
        mode === value
          ? 'px-3 py-1.5 rounded-lg bg-[#1a2332] text-white text-body'
          : 'px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-body text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors'
      }
    >
      {label}
    </button>
  );

  const actionArea = (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {modeButton('revalue', 'Revalue')}
        {canTrade && modeButton('buy', 'Buy more')}
        {canTrade && modeButton('sell', 'Sell')}
      </div>
      {!canTrade && (onBuyMore !== undefined || onSell !== undefined) && (
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          This holding prices in {holding.currency}, not the portfolio&rsquo;s own currency — record
          its trades through Add a holding, where the conversion machinery lives.
        </p>
      )}
      {mode === 'revalue' && revalueForm}
      {mode === 'buy' && canTrade && tradeForm('buy')}
      {mode === 'sell' && canTrade && tradeForm('sell')}
    </div>
  );

  return (
    <Modal isOpen onClose={onClose} title={`${holding.symbol} — register`} size="lg">
      <ModalBody>
      <div className="space-y-4">
        {loadError && (
          <p role="alert" className="text-body text-red-700 dark:text-red-400">{loadError}</p>
        )}

        {register === null && securityRegister === null && !loadError && (
          <p className="text-body text-gray-500 dark:text-gray-400">Reading the price history…</p>
        )}

        {securityRegister && (
          <>
            <SecurityRegisterTable
              register={securityRegister}
              currency={holding.currency}
              symbol={holding.symbol}
            />
            {actionArea}
          </>
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

            {actionArea}
          </>
        )}
      </div>
      </ModalBody>
    </Modal>
  );
}
