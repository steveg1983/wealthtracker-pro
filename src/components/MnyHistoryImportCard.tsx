/**
 * The door for Money INVESTMENT HISTORY — beside the full migration, never
 * inside it.
 *
 * The full .mny flow REPLACES everything, which is exactly right for a
 * migration and exactly wrong for someone whose ledger has lived here for
 * months and who only wants what Money kept about their investments: the
 * price table (SP) and the trades (the TRN rows that carry a security, with
 * quantity and unit price in TRN_INV). This card reads ONLY those and writes
 * ONLY history — prices where existing rows win, trades keyed by Money's own
 * per-row GUID — so it cannot disturb a ledger, and running it twice is a
 * no-op. Trades write NO transactions: the cash side of every historical buy,
 * sell and dividend arrived with the full migration and the closed accounts
 * already balance.
 *
 * The readers are imported ON CLICK, not at module top: mdb-reader and the
 * decryptor already ship in the (lazy) migration chunk, and this page must
 * not pull them into its own.
 *
 * Two-step, because the counts are the point: the confirm block says what was
 * found AND what was left out (symbol-less securities for prices, dividends
 * counted as cash, Money accounts with no matching account here) before
 * anything is written — the no-silent-caps rule, made visible.
 *
 * OPEN POSITIONS ARE THE OWNER'S CALL. Measured against the owner's file,
 * every genuinely-closed position folds to exactly zero and the only
 * positions the events leave open are three round-number, zero-commission
 * buys that look like test entries. This code cannot know which history is
 * real, so any position the file leaves open is listed with a tick-box —
 * unticked by default, because importing it makes the app say those units
 * are STILL HELD.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dataPort } from '@data';
import { useApp } from '../contexts/AppContextSupabase';
import { useHistoricalAccounts } from '../hooks/useHistoricalAccounts';
import { TrendingUpIcon } from './icons';
import type { MnyPriceHistory } from '../services/import/msMoney/mnyPrices';
import type { MnyEventHistory, MnyEventRow, OpenPosition } from '../services/import/msMoney/mnyEvents';
import { formatCount, compareText } from '../utils/localeFormat';

type Step =
  | { at: 'idle' }
  | { at: 'reading' }
  | { at: 'confirm'; prices: MnyPriceHistory; trades: MnyEventHistory }
  | { at: 'importing'; prices: MnyPriceHistory; trades: MnyEventHistory }
  | {
      at: 'done';
      pricesImported: number;
      pricesPresent: number;
      tradesImported: number;
      tradesPresent: number;
    }
  | { at: 'failed'; message: string };

const priceSkipSentence = (h: MnyPriceHistory): string | null => {
  const parts: string[] = [];
  if (h.skipped.noSymbol > 0) {
    parts.push(`${h.skipped.noSymbol} securit${h.skipped.noSymbol === 1 ? 'y' : 'ies'} without a ticker symbol`);
  }
  if (h.skipped.pence > 0) parts.push(`${h.skipped.pence} priced in pence`);
  if (h.skipped.unreadable > 0) parts.push(`${h.skipped.unreadable} unreadable price${h.skipped.unreadable === 1 ? '' : 's'}`);
  if (parts.length === 0) return null;
  return `Left out: ${parts.join(', ')}.`;
};

const tradeSkipSentence = (h: MnyEventHistory): string | null => {
  const parts: string[] = [];
  if (h.skipped.cashSide > 0) {
    // Dividends and returns of capital — already in the ledger as cash.
    parts.push(
      `${h.skipped.cashSide} dividend and cash row${h.skipped.cashSide === 1 ? '' : 's'} already in your ledger`
    );
  }
  if (h.skipped.missingQuantity > 0) {
    parts.push(`${h.skipped.missingQuantity} trade${h.skipped.missingQuantity === 1 ? '' : 's'} without a readable quantity`);
  }
  if (h.skipped.unreadable > 0) parts.push(`${h.skipped.unreadable} unreadable row${h.skipped.unreadable === 1 ? '' : 's'}`);
  if (parts.length === 0) return null;
  return `Not imported: ${parts.join(', ')}.`;
};

const positionKey = (p: { accountName: string; symbol: string | null; securityName: string }): string =>
  `${p.accountName}|${p.symbol ?? `name:${p.securityName}`}`;

export default function MnyHistoryImportCard(): React.JSX.Element {
  const { accounts } = useApp();
  const historicalAccounts = useHistoricalAccounts(accounts);
  const [step, setStep] = useState<Step>({ at: 'idle' });
  /** Open positions the owner has ticked to import anyway. */
  const [includedOpen, setIncludedOpen] = useState<ReadonlySet<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  /**
   * Money account name → app account id, case-insensitively, over open AND
   * closed accounts — the traded accounts are mostly closed, and that is the
   * point of the feature.
   */
  const accountIdByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const account of historicalAccounts) {
      map.set(account.name.trim().toLowerCase(), account.id);
    }
    return map;
  }, [historicalAccounts]);

  const read = useCallback(async (file: File): Promise<void> => {
    setStep({ at: 'reading' });
    try {
      const [{ readMnyPriceHistory }, { readMnyEventHistory }] = await Promise.all([
        import('../services/import/msMoney/mnyPrices'),
        import('../services/import/msMoney/mnyEvents')
      ]);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const prices = readMnyPriceHistory(bytes);
      const trades = readMnyEventHistory(bytes);
      setIncludedOpen(new Set());
      setStep({ at: 'confirm', prices, trades });
    } catch (error) {
      setStep({
        at: 'failed',
        message: error instanceof Error ? error.message : 'This file could not be read.'
      });
    }
  }, []);

  interface TradePlan {
    matched: MnyEventRow[];
    unmatchedAccounts: Array<{ name: string; trades: number }>;
    openPositions: OpenPosition[];
  }

  /** Split the file's trades into importable, unmatched, and open-position. */
  const planTrades = useCallback(
    async (trades: MnyEventHistory): Promise<TradePlan> => {
      const { foldOpenPositions } = await import('../services/import/msMoney/mnyEvents');
      const unmatchedCounts = new Map<string, number>();
      const matched: MnyEventRow[] = [];
      for (const event of trades.events) {
        if (accountIdByName.has(event.accountName.trim().toLowerCase())) {
          matched.push(event);
        } else {
          unmatchedCounts.set(event.accountName, (unmatchedCounts.get(event.accountName) ?? 0) + 1);
        }
      }
      return {
        matched,
        unmatchedAccounts: [...unmatchedCounts.entries()]
          .map(([name, count]) => ({ name, trades: count }))
          .sort((a, b) => compareText(a.name, b.name)),
        openPositions: foldOpenPositions(matched)
      };
    },
    [accountIdByName]
  );

  /**
   * The plan is derived from the confirm step's data, asynchronously (the
   * fold lives in the lazy reader chunk). Keyed on the trades OBJECT, which
   * is stable across confirm → importing, and on the matcher — the closed
   * accounts arrive async, and a plan made before they landed must be
   * remade with them.
   */
  const [plan, setPlan] = useState<TradePlan | null>(null);
  const confirmTrades = step.at === 'confirm' || step.at === 'importing' ? step.trades : null;
  useEffect(() => {
    if (confirmTrades === null) return;
    let cancelled = false;
    setPlan(null);
    void planTrades(confirmTrades).then((next) => {
      if (!cancelled) setPlan(next);
    });
    return () => {
      cancelled = true;
    };
  }, [confirmTrades, planTrades]);

  const runImport = useCallback(
    async (prices: MnyPriceHistory, trades: MnyEventHistory, tradePlan: TradePlan): Promise<void> => {
      setStep({ at: 'importing', prices, trades });
      try {
        const pricesImported = await dataPort.importInvestmentPriceHistory(
          prices.prices.map((p) => ({ symbol: p.symbol, date: p.date, price: p.price, currency: p.currency }))
        );

        // An unticked open position's SECURITY stays out entirely — importing
        // its closing trades alone would fabricate a short position.
        const excluded = new Set(
          tradePlan.openPositions.filter((p) => !includedOpen.has(positionKey(p))).map(positionKey)
        );
        const drafts = tradePlan.matched
          .filter((event) => !excluded.has(positionKey(event)))
          .map((event) => ({
            accountId: accountIdByName.get(event.accountName.trim().toLowerCase())!,
            symbol: event.symbol,
            securityName: event.securityName,
            date: event.date,
            kind: event.kind,
            quantity: event.quantity,
            price: event.price,
            fees: event.fees,
            amount: event.amount,
            currency: event.currency,
            sourceRef: event.sourceRef
          }));
        const tradesImported = await dataPort.importInvestmentEvents(drafts);

        setStep({
          at: 'done',
          pricesImported,
          pricesPresent: prices.prices.length - pricesImported,
          tradesImported,
          tradesPresent: drafts.length - tradesImported
        });
      } catch (error) {
        setStep({
          at: 'failed',
          message: error instanceof Error ? error.message : 'The history could not be saved.'
        });
      }
    },
    [accountIdByName, includedOpen]
  );

  return (
    <div className="w-full mb-6 rounded-2xl border border-line dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
      <div className="flex items-center gap-4">
        <span className="shrink-0 grid place-items-center h-12 w-12 rounded-xl bg-primary-action text-on-primary-action">
          <TrendingUpIcon size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 dark:text-white">
            Import investment history from Microsoft Money
          </p>
          <p className="text-body text-gray-500 dark:text-gray-400">
            Reads the price history and the buys and sells from a <code>.mny</code> file — nothing
            about your accounts or transactions is touched, and history already recorded here is kept.
          </p>
        </div>
        {step.at === 'idle' || step.at === 'failed' ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="shrink-0 px-4 py-2 rounded-lg border border-line dark:border-gray-600 text-body text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            Choose file
          </button>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept=".mny"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Same file re-chosen must fire change again after a failure.
            e.target.value = '';
            if (file) void read(file);
          }}
        />
      </div>

      {step.at === 'reading' && (
        <p className="mt-4 text-body text-gray-500 dark:text-gray-400">Reading the file…</p>
      )}

      {step.at === 'confirm' && (
        <div className="mt-4 border-t border-line dark:border-gray-700 pt-4 space-y-3">
          {step.prices.prices.length === 0 && step.trades.events.length === 0 ? (
            <p className="text-body text-gray-500 dark:text-gray-400">
              No investment history in this file.{' '}
              {priceSkipSentence(step.prices) ?? tradeSkipSentence(step.trades) ?? ''}
            </p>
          ) : plan === null ? (
            <p className="text-body text-gray-500 dark:text-gray-400">Matching accounts…</p>
          ) : (
            <>
              <div>
                <p className="text-body text-gray-900 dark:text-white">
                  {formatCount(step.prices.prices.length)} price
                  {step.prices.prices.length === 1 ? '' : 's'} for {step.prices.securities} securit
                  {step.prices.securities === 1 ? 'y' : 'ies'}
                  {step.prices.from ? `, ${step.prices.from} to ${step.prices.to}` : ''}.
                </p>
                {priceSkipSentence(step.prices) && (
                  <p className="mt-1 text-body text-gray-500 dark:text-gray-400">
                    {priceSkipSentence(step.prices)}
                  </p>
                )}
              </div>

              <div>
                <p className="text-body text-gray-900 dark:text-white">
                  {formatCount(plan.matched.length)} trade{plan.matched.length === 1 ? '' : 's'} —
                  buys, sells and write-offs — across {step.trades.securities} securit
                  {step.trades.securities === 1 ? 'y' : 'ies'}
                  {step.trades.from ? `, ${step.trades.from} to ${step.trades.to}` : ''}. Trades record
                  history only; no transactions are written.
                </p>
                {tradeSkipSentence(step.trades) && (
                  <p className="mt-1 text-body text-gray-500 dark:text-gray-400">
                    {tradeSkipSentence(step.trades)}
                  </p>
                )}
                {step.trades.figuresDisagree > 0 && (
                  <p className="mt-1 text-body text-gray-500 dark:text-gray-400">
                    {step.trades.figuresDisagree} trade{step.trades.figuresDisagree === 1 ? '' : 's'}{' '}
                    where quantity × price disagrees with the recorded total — the total is kept.
                  </p>
                )}
                {plan.unmatchedAccounts.length > 0 && (
                  <p className="mt-1 text-body text-gray-500 dark:text-gray-400">
                    Not imported — no account here matches:{' '}
                    {plan.unmatchedAccounts
                      .map((a) => `${a.name} (${a.trades} trade${a.trades === 1 ? '' : 's'})`)
                      .join(', ')}
                    . Renaming the account here to match lets a re-run pick them up.
                  </p>
                )}
              </div>

              {plan.openPositions.length > 0 && (
                <div>
                  <p className="text-body text-gray-900 dark:text-white">
                    {plan.openPositions.length === 1 ? 'One position is' : `${plan.openPositions.length} positions are`}{' '}
                    left open by these trades — importing one means this app will say those units are
                    still held:
                  </p>
                  <ul className="mt-2 space-y-1">
                    {plan.openPositions.map((position) => {
                      const key = positionKey(position);
                      return (
                        <li key={key}>
                          <label className="flex items-center gap-2 text-body text-gray-700 dark:text-gray-300">
                            <input
                              type="checkbox"
                              checked={includedOpen.has(key)}
                              onChange={(e) => {
                                setIncludedOpen((current) => {
                                  const next = new Set(current);
                                  if (e.target.checked) next.add(key);
                                  else next.delete(key);
                                  return next;
                                });
                              }}
                            />
                            <span>
                              {position.securityName}
                              {position.symbol ? ` (${position.symbol})` : ''} —{' '}
                              {position.quantity} units in {position.accountName}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => void runImport(step.prices, step.trades, plan)}
                  className="px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary transition-colors"
                >
                  Import this history
                </button>
                <button
                  type="button"
                  onClick={() => setStep({ at: 'idle' })}
                  className="px-4 py-2 rounded-lg border border-line dark:border-gray-600 text-body text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {step.at === 'importing' && (
        <p className="mt-4 text-body text-gray-500 dark:text-gray-400">Saving investment history…</p>
      )}

      {step.at === 'done' && (
        <p className="mt-4 text-body text-gray-900 dark:text-white" role="status">
          {formatCount(step.pricesImported)} price{step.pricesImported === 1 ? '' : 's'} and{' '}
          {formatCount(step.tradesImported)} trade{step.tradesImported === 1 ? '' : 's'} imported
          {step.pricesPresent + step.tradesPresent > 0
            ? ` — ${formatCount(step.pricesPresent + step.tradesPresent)} already recorded here and kept as they were.`
            : '.'}
        </p>
      )}

      {step.at === 'failed' && (
        <p className="mt-4 text-body text-red-700 dark:text-red-400" role="alert">
          {step.message}
        </p>
      )}
    </div>
  );
}
