import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRightLeftIcon } from './icons';
import { formatCurrency } from '../utils/currency-decimal';
import { toDecimal, type DecimalInstance } from '../utils/decimal';
import {
  AMOUNT_DP,
  RATE_DP,
  destinationForRate,
  rateForDestination,
  rateToStorageString,
} from '../utils/fx';
import { useFxQuote } from '../hooks/useFxQuote';
import type { ConfirmedConversion } from '../utils/crossCurrencyTransfer';

/**
 * The one question a cross-currency transfer has to ask, asked once.
 *
 * ── WHY THIS DIALOG EXISTS AT ALL ───────────────────────────────────────────
 *
 * Writing the other leg of a transfer means writing a figure into a second
 * account. Within one currency that figure is known — it is the same number,
 * negated — and the app writes it without asking. Across a currency boundary it
 * is NOT known: what a bank actually gave includes a spread and possibly a fee,
 * and no mid-market quote is that number. The engines refuse to guess it (the
 * counterpart mint guard, which this feature does not touch and never will), so
 * the only honest source is the person who has the statement in front of them.
 *
 * So: prefill from a quote, show where the quote came from and when, and let
 * either box be the one they edit. Whatever they confirm is what gets written,
 * and `metadata.fx` records which of those two things happened.
 *
 * ── THE TWO BOXES ARE ONE FACT ──────────────────────────────────────────────
 *
 * Rate and destination amount are not independent fields; they are two views of
 * the same conversion, and each is derived from the other through `fx.ts`.
 * Typing in one recomputes the other, and the box being typed in is never
 * rewritten under the cursor — `lastEdited` exists for that alone. A field that
 * reformats what you are halfway through typing is the classic money-input bug
 * and it is worse here, where the two fields would fight each other.
 *
 * ── DESIGN ──────────────────────────────────────────────────────────────────
 *
 * DESIGN_PASS_2026-08: modal radius 10 (`rounded-xl`), controls radius 6
 * (`rounded`), one hairline `border-line` doing the separating work, and
 * `shadow-overlay` — the one place §2.5 still allows a shadow, because an
 * overlay floating IS the meaning. No amber anywhere (P3: the yellow thread is
 * the only amber in the building, and this dialog is not it). The unavailable-
 * quote line is consequence then remedy (P6). Amounts are tabular (P5).
 */
interface CrossCurrencyTransferDialogProps {
  isOpen: boolean;
  /** The leg the money leaves, ABSOLUTE, as the person entered it. */
  sourceAmount: DecimalInstance | number | string;
  sourceCurrency: string;
  sourceAccountName: string;
  destinationCurrency: string;
  destinationAccountName: string;
  busy: boolean;
  onConfirm: (conversion: ConfirmedConversion) => void;
  onCancel: () => void;
}

/** Two decimal places for money, and nothing clever about a half-typed box. */
const asMoneyText = (value: DecimalInstance): string => value.toFixed(AMOUNT_DP);

/**
 * A box's contents as a positive finite Decimal, or `null`.
 *
 * Everything typed here is a magnitude — direction belongs to the legs, and
 * `destinationLegAmount` applies it. A negative or zero entry is therefore not
 * a value to be corrected but an entry that is not finished, which is why this
 * returns `null` rather than clamping.
 */
function readPositive(text: string): DecimalInstance | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  try {
    const value = toDecimal(trimmed);
    if (!value.isFinite() || value.isNaN() || value.isZero() || value.isNegative()) return null;
    return value;
  } catch {
    return null;
  }
}

export default function CrossCurrencyTransferDialog({
  isOpen,
  sourceAmount,
  sourceCurrency,
  sourceAccountName,
  destinationCurrency,
  destinationAccountName,
  busy,
  onConfirm,
  onCancel,
}: CrossCurrencyTransferDialogProps): React.JSX.Element | null {
  const quote = useFxQuote(isOpen ? sourceCurrency : null, isOpen ? destinationCurrency : null);

  const [rateText, setRateText] = useState('');
  const [destinationText, setDestinationText] = useState('');
  /**
   * Which box the person last typed in — and therefore which one must not be
   * rewritten, and which provenance the record carries.
   *
   * `null` means they have touched neither, which is the only state in which a
   * quote may still be accepted as `'api'`. One keystroke in either box makes
   * the figure theirs.
   */
  const [lastEdited, setLastEdited] = useState<'rate' | 'destination' | null>(null);
  const rateBoxRef = useRef<HTMLInputElement>(null);

  const magnitude = useMemo(() => toDecimal(sourceAmount).abs(), [sourceAmount]);

  // Seed both boxes from the quote, but only while the person has typed
  // nothing. A quote that resolves late must not overwrite a rate they have
  // already entered — on a slow connection that is a figure changing under a
  // confirmed decision.
  useEffect(() => {
    if (!isOpen || lastEdited !== null) return;
    if (quote.status !== 'ready') return;
    setRateText(rateToStorageString(quote.rate));
    const destination = destinationForRate(magnitude, quote.rate);
    setDestinationText(destination.ok ? asMoneyText(destination.value) : '');
  }, [isOpen, quote, magnitude, lastEdited]);

  // Nothing to accept and nothing prefilled: put the cursor where the only
  // usable control is, rather than making them find it.
  useEffect(() => {
    if (isOpen && quote.status === 'unavailable') rateBoxRef.current?.focus();
  }, [isOpen, quote.status]);

  // A fresh open is a fresh conversion. Without this a second transfer inherits
  // the first one's rate AND its `lastEdited`, so the new quote never lands.
  useEffect(() => {
    if (!isOpen) {
      setRateText('');
      setDestinationText('');
      setLastEdited(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRateChange = (next: string): void => {
    setRateText(next);
    setLastEdited('rate');
    const rate = readPositive(next);
    if (!rate) return;
    const destination = destinationForRate(magnitude, rate);
    if (destination.ok) setDestinationText(asMoneyText(destination.value));
  };

  const handleDestinationChange = (next: string): void => {
    setDestinationText(next);
    setLastEdited('destination');
    const destination = readPositive(next);
    if (!destination) return;
    const rate = rateForDestination(magnitude, destination);
    if (rate.ok) setRateText(rateToStorageString(rate.value));
  };

  const destinationAmount = readPositive(destinationText);
  const rate = readPositive(rateText);
  const canConfirm = destinationAmount !== null && rate !== null && !busy;

  /**
   * `'api'` only if a LIVE quote was accepted with no edit at all.
   *
   * A fallback rate comes from the hardcoded table in `currency-decimal.ts`,
   * which is wrong the day after it was written. Stamping that `'api'` would
   * put the provider's name on a figure it never quoted. Accepting it is still
   * allowed — the person is told, right under the box — but the record then
   * says `'manual'`, because they are the one answering for it.
   */
  const provenance = lastEdited === null && quote.status === 'ready' && quote.source === 'api'
    ? 'api' as const
    : 'manual' as const;

  const handleConfirm = (): void => {
    if (!destinationAmount || !rate) return;
    onConfirm({
      destinationAmount: destinationAmount.toDecimalPlaces(AMOUNT_DP),
      rate: rate.toDecimalPlaces(RATE_DP),
      source: provenance,
      // A quote's own timestamp when it is still the quote; otherwise now,
      // which is when the person's figure became true.
      asOf: provenance === 'api' && quote.status === 'ready' ? quote.asOf : new Date(),
    });
  };

  const quotedAt = quote.status === 'ready'
    ? quote.asOf.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : '';

  const controlClass =
    'w-full px-3 py-2 h-[42px] text-right tabular-nums bg-white dark:bg-gray-800 ' +
    'border border-line dark:border-gray-600 rounded ' +
'focus:border-transparent'+
    'text-gray-900 dark:text-white';

  // Portalled to document.body for the reason TransferMatchDialog gives: a
  // transformed ancestor re-anchors position:fixed and traps the z-index under
  // the modal that opened this.
  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cross-currency-title"
        className="bg-white dark:bg-gray-800 rounded-xl shadow-overlay p-6 w-full max-w-lg mx-4"
      >
        <div className="flex items-center gap-3 mb-2">
          <ArrowRightLeftIcon size={20} className="text-primary dark:text-blue-400" />
          <h3 id="cross-currency-title" className="text-card font-semibold text-gray-900 dark:text-white">
            These accounts hold different currencies
          </h3>
        </div>
        {/* Consequence, then remedy (P6): what is about to be written, and the
            fact that the second figure is the one nobody knows yet. */}
        <p className="text-body text-gray-600 dark:text-gray-400 mb-5">
          <span className="tabular-nums">{formatCurrency(magnitude, sourceCurrency)}</span>
          {' '}leaves {sourceAccountName}. {destinationAccountName} is in {destinationCurrency},
          so what arrives there is a different figure — confirm it and both sides will be
          recorded exactly as you enter them.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
          <div>
            <label
              htmlFor="cross-currency-rate"
              className="block text-label uppercase text-gray-500 dark:text-gray-400 mb-1"
            >
              Rate
            </label>
            <div className="flex items-center gap-2">
              <span className="text-body text-gray-500 dark:text-gray-400 whitespace-nowrap">
                1 {sourceCurrency} =
              </span>
              <input
                id="cross-currency-rate"
                ref={rateBoxRef}
                type="text"
                inputMode="decimal"
                value={rateText}
                onChange={(e) => handleRateChange(e.target.value)}
                disabled={busy}
                aria-label={`Rate, ${destinationCurrency} per 1 ${sourceCurrency}`}
                className={controlClass}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="cross-currency-destination"
              className="block text-label uppercase text-gray-500 dark:text-gray-400 mb-1"
            >
              Arrives in {destinationAccountName}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-body text-gray-500 dark:text-gray-400">{destinationCurrency}</span>
              <input
                id="cross-currency-destination"
                type="text"
                inputMode="decimal"
                value={destinationText}
                onChange={(e) => handleDestinationChange(e.target.value)}
                disabled={busy}
                aria-label={`Amount arriving in ${destinationAccountName}, in ${destinationCurrency}`}
                className={controlClass}
              />
            </div>
          </div>
        </div>

        {/* Provenance, in the sentence the design pass asks for: who quoted it
            and when. Neutral grey — a rate that is merely old is not a warning,
            and an amber here would spend the one the yellow thread owns. */}
        <p className="text-dense text-gray-500 dark:text-gray-400 mb-5 min-h-[16px]">
          {quote.status === 'loading' && 'Fetching a rate…'}
          {quote.status === 'ready' && quote.source === 'api' && (
            <>1 {sourceCurrency} = <span className="tabular-nums">{rateToStorageString(quote.rate)}</span>{' '}
            {destinationCurrency} — {quote.provider}, {quotedAt}</>
          )}
          {quote.status === 'ready' && quote.source === 'fallback' && (
            <>No live rate right now, so this one is approximate — check it against your
            statement before confirming.</>
          )}
          {quote.status === 'unavailable' && (
            <>No rate available offline. Enter the rate or the amount that arrived — either
            one fills in the other.</>
          )}
        </p>

        <div className="flex flex-wrap gap-3 justify-end items-center">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 border border-line dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Recording…' : 'Record both sides'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
