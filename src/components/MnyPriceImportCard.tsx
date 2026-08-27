/**
 * The door for Money PRICE HISTORY — beside the full migration, never inside it.
 *
 * The full .mny flow REPLACES everything, which is exactly right for a
 * migration and exactly wrong for someone whose ledger has lived here for
 * months and who only wants the eight years of prices Money kept in its SP
 * table. This card reads ONLY prices (mnyPrices.ts touches CRNC, SEC, SP and
 * nothing else) and writes ONLY price history, where existing rows win — so
 * it cannot disturb a ledger, and running it twice is a no-op.
 *
 * The reader is imported ON CLICK, not at module top: mdb-reader and the
 * decryptor already ship in the (lazy) migration chunk, and this page must
 * not pull them into its own.
 *
 * Two-step, because the counts are the point: the confirm sentence says what
 * was found AND what was skipped (symbol-less securities, pence-flagged ones,
 * unreadable rows) before anything is written — the no-silent-caps rule, made
 * visible. Measured against the owner's real file: 131 usable prices, 30
 * symbol-less securities counted rather than vanished.
 */
import { useCallback, useRef, useState } from 'react';
import { dataPort } from '@data';
import { TrendingUpIcon } from './icons';
import type { MnyPriceHistory } from '../services/import/msMoney/mnyPrices';

type Step =
  | { at: 'idle' }
  | { at: 'reading' }
  | { at: 'confirm'; history: MnyPriceHistory }
  | { at: 'importing'; history: MnyPriceHistory }
  | { at: 'done'; imported: number; alreadyPresent: number }
  | { at: 'failed'; message: string };

const skippedSentence = (h: MnyPriceHistory): string | null => {
  const parts: string[] = [];
  if (h.skipped.noSymbol > 0) {
    parts.push(`${h.skipped.noSymbol} securit${h.skipped.noSymbol === 1 ? 'y' : 'ies'} without a ticker symbol`);
  }
  if (h.skipped.pence > 0) parts.push(`${h.skipped.pence} priced in pence`);
  if (h.skipped.unreadable > 0) parts.push(`${h.skipped.unreadable} unreadable price${h.skipped.unreadable === 1 ? '' : 's'}`);
  if (parts.length === 0) return null;
  return `Left out: ${parts.join(', ')}.`;
};

export default function MnyPriceImportCard(): React.JSX.Element {
  const [step, setStep] = useState<Step>({ at: 'idle' });
  const fileRef = useRef<HTMLInputElement>(null);

  const read = useCallback(async (file: File): Promise<void> => {
    setStep({ at: 'reading' });
    try {
      const { readMnyPriceHistory } = await import('../services/import/msMoney/mnyPrices');
      const history = readMnyPriceHistory(new Uint8Array(await file.arrayBuffer()));
      setStep({ at: 'confirm', history });
    } catch (error) {
      setStep({
        at: 'failed',
        message: error instanceof Error ? error.message : 'This file could not be read.'
      });
    }
  }, []);

  const runImport = useCallback(async (history: MnyPriceHistory): Promise<void> => {
    setStep({ at: 'importing', history });
    try {
      const imported = await dataPort.importInvestmentPriceHistory(
        history.prices.map((p) => ({ symbol: p.symbol, date: p.date, price: p.price, currency: p.currency }))
      );
      setStep({ at: 'done', imported, alreadyPresent: history.prices.length - imported });
    } catch (error) {
      setStep({
        at: 'failed',
        message: error instanceof Error ? error.message : 'The prices could not be saved.'
      });
    }
  }, []);

  return (
    <div className="w-full mb-6 rounded-2xl border border-line dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
      <div className="flex items-center gap-4">
        <span className="shrink-0 grid place-items-center h-12 w-12 rounded-xl bg-primary-action text-on-primary-action">
          <TrendingUpIcon size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 dark:text-white">Import investment prices from Microsoft Money</p>
          <p className="text-body text-gray-500 dark:text-gray-400">
            Reads only the price history from a <code>.mny</code> file — nothing about your accounts or
            transactions is touched, and prices already recorded here are kept.
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
        <div className="mt-4 border-t border-line dark:border-gray-700 pt-4">
          {step.history.prices.length === 0 ? (
            <p className="text-body text-gray-500 dark:text-gray-400">
              No usable prices in this file.{' '}
              {skippedSentence(step.history) ?? 'Its price table is empty.'}
            </p>
          ) : (
            <>
              <p className="text-body text-gray-900 dark:text-white">
                {step.history.prices.length.toLocaleString()} price
                {step.history.prices.length === 1 ? '' : 's'} for {step.history.securities} securit
                {step.history.securities === 1 ? 'y' : 'ies'}, {step.history.from} to {step.history.to}.
              </p>
              {skippedSentence(step.history) && (
                <p className="mt-1 text-body text-gray-500 dark:text-gray-400">{skippedSentence(step.history)}</p>
              )}
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => void runImport(step.history)}
                  className="px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary transition-colors"
                >
                  Import these prices
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
        <p className="mt-4 text-body text-gray-500 dark:text-gray-400">Saving price history…</p>
      )}

      {step.at === 'done' && (
        <p className="mt-4 text-body text-gray-900 dark:text-white" role="status">
          {step.imported.toLocaleString()} price{step.imported === 1 ? '' : 's'} imported
          {step.alreadyPresent > 0
            ? ` — ${step.alreadyPresent.toLocaleString()} already recorded here and kept as they were.`
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
