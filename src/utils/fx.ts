import { Decimal, toDecimal } from './decimal';
import type { DecimalInstance } from './decimal';

/**
 * The arithmetic of one cross-currency transfer, and nothing else.
 *
 * ── WHY THIS IS A FILE AND NOT A COUPLE OF LINES IN THE DIALOG ──────────────
 *
 * The engine REFUSES to mint a transfer counterpart across a currency boundary,
 * and the refusal is right: `create_transfer_counterpart` writes −amount into
 * the other ledger with no conversion, so a $1,336.25 source would move a
 * sterling account by £1,336.25 (see the guard's own words in
 * `supabase/migrations/20260721090000_transfer_counterpart_currency_guard.sql`
 * and its local twin `crates/wealth-core/src/verbs/create_transfer_counterpart.rs`).
 *
 * This module does not work around that. It is the arithmetic behind a dialog
 * that asks the PERSON what the other side was worth, so that by the time two
 * rows exist neither of them was invented by the app. Joining two rows that
 * already exist is explicitly allowed in every engine — `link_transfer_pair`
 * lists "two accounts in different currencies | linked" among the things it
 * does NOT refuse, because "joining two rows that already exist moves nothing,
 * so there is nothing to convert". That is the seam this feature uses.
 *
 * ── A RATE IS A RATIO, NOT MONEY ────────────────────────────────────────────
 *
 * Every function here keeps money and rates apart, because they round
 * differently and the difference is the whole point. Money is exact to the
 * penny; a rate is a ratio that carries as many places as we can hold. Rounding
 * a rate to 2dp then multiplying by a five-figure amount loses pounds.
 *
 * Amounts round to {@link AMOUNT_DP}. Rates round to {@link RATE_DP} — ten
 * places, chosen to match the local edition's `fx_rate_e10` column
 * (`scripts/local-sqlite/schema.sql`), which stores a rate as an integer scaled
 * by 10^10. A rate produced here can therefore move into that typed column
 * later without losing a digit.
 *
 * ── EVERY RATE HERE IS POSITIVE ─────────────────────────────────────────────
 *
 * Rates are computed from ABSOLUTE amounts. A transfer's two legs are signed
 * oppositely — money leaves one account and arrives in the other — so a signed
 * ratio would be negative every time and would mean nothing. The sign belongs
 * to the legs, and the caller applies it. This also matches the local schema's
 * `fx_rate_e10 > 0` CHECK, which would refuse a negative rate outright.
 */

/** Places a money amount is held to. Pennies, like every other amount. */
export const AMOUNT_DP = 2;

/**
 * Places a RATE is held to.
 *
 * Ten, because the local edition's `fx_rate_e10` column scales a rate by 10^10
 * and a rate that survives this module should survive that column unchanged. It
 * is also far more than any published rate carries, so no real quote is
 * truncated by it.
 */
export const RATE_DP = 10;

/** Where a rate came from. Stored, so a figure can always be accounted for. */
export type FxRateSource =
  /** A live quote from the rates provider. */
  | 'api'
  /** The person typed it, or edited what the provider offered. */
  | 'manual'
  /**
   * Neither — computed from two amounts that were ALREADY REAL, by dividing
   * one by the other. The truest of the three: it is what the money actually
   * did, spread and fees included, rather than what a mid-market quote says it
   * should have done.
   */
  | 'derived';

/**
 * What a linked cross-currency pair records about its own conversion, stored on
 * BOTH legs under `metadata.fx`.
 *
 * `rate` is a STRING and that is deliberate: JSON has one number type and it is
 * a float, so a rate written as a number is a float the moment it is
 * serialised. The local edition's schema makes the same judgement in the
 * opposite direction — it BANS the old float `transferMetadata.exchangeRate`
 * from the metadata blob by CHECK constraint, having promoted it out into a
 * scaled integer column. An exact decimal string is the representation both
 * editions can hold losslessly.
 */
export interface FxRecord {
  /** Destination units per ONE source unit, as an exact decimal string. */
  rate: string;
  source: FxRateSource;
  /** When the rate was true, ISO 8601. */
  asOf: string;
}

/** The currency pair a rate belongs to, so a stored rate reads unambiguously. */
export interface FxPair {
  from: string;
  to: string;
}

/**
 * A rate could not be computed, and why.
 *
 * Returned rather than thrown: every caller here is a keystroke handler, and a
 * half-typed box is not an exceptional condition. `null` alone would not say
 * which of the two impossible things happened.
 */
export type FxFailure =
  /** The source amount is zero — every rate divides by it. */
  | 'zero-source'
  /** One of the amounts was not a number at all. */
  | 'not-a-number';

export type FxResult<T> = { ok: true; value: T } | { ok: false; reason: FxFailure };

const ok = <T,>(value: T): FxResult<T> => ({ ok: true, value });
const fail = <T,>(reason: FxFailure): FxResult<T> => ({ ok: false, reason });

/**
 * Whether a value can be read as a finite decimal.
 *
 * Decimal.js accepts a string and yields NaN rather than throwing, so this is
 * the gate every entry point runs before doing arithmetic on user typing.
 */
function readAmount(value: DecimalInstance | number | string): DecimalInstance | null {
  try {
    const decimal = toDecimal(value);
    return decimal.isFinite() && !decimal.isNaN() ? decimal : null;
  } catch {
    return null;
  }
}

/**
 * The rate two REAL amounts imply: |destination| ÷ |source|.
 *
 * This is the 'derived' case, and it is the most trustworthy number this module
 * produces because neither input was invented. Two legs that came from bank
 * feeds have already had the spread and any fee taken out of them, so their
 * ratio is the rate the person actually got — not the mid-market rate they
 * didn't.
 *
 * Rounded to {@link RATE_DP}. Sign is discarded: see the header.
 */
export function deriveRate(
  sourceAmount: DecimalInstance | number | string,
  destinationAmount: DecimalInstance | number | string
): FxResult<DecimalInstance> {
  const source = readAmount(sourceAmount);
  const destination = readAmount(destinationAmount);
  if (source === null || destination === null) return fail('not-a-number');
  if (source.isZero()) return fail('zero-source');

  return ok(
    destination
      .abs()
      .dividedBy(source.abs())
      .toDecimalPlaces(RATE_DP, Decimal.ROUND_HALF_UP)
  );
}

/**
 * The destination amount a rate implies: |source| × rate, to the penny.
 *
 * The dialog's left-to-right direction. Rounded HALF_UP at
 * {@link AMOUNT_DP} — the same rounding `formatCurrency` uses, so the figure
 * the person confirms is the figure they will later read back.
 */
export function destinationForRate(
  sourceAmount: DecimalInstance | number | string,
  rate: DecimalInstance | number | string
): FxResult<DecimalInstance> {
  const source = readAmount(sourceAmount);
  const rateValue = readAmount(rate);
  if (source === null || rateValue === null) return fail('not-a-number');

  return ok(
    source
      .abs()
      .times(rateValue.abs())
      .toDecimalPlaces(AMOUNT_DP, Decimal.ROUND_HALF_UP)
  );
}

/**
 * The rate a destination amount implies, for the dialog's other direction.
 *
 * Identical arithmetic to {@link deriveRate}; named separately because the two
 * call sites mean different things — this one is a person editing a figure,
 * that one is two feeds being compared — and a stored `source` of 'manual'
 * versus 'derived' turns on which happened.
 */
export function rateForDestination(
  sourceAmount: DecimalInstance | number | string,
  destinationAmount: DecimalInstance | number | string
): FxResult<DecimalInstance> {
  return deriveRate(sourceAmount, destinationAmount);
}

/**
 * The source amount a rate implies: |destination| ÷ rate, to the penny —
 * {@link destinationForRate} run backwards.
 *
 * The buy form's reverse entry is what needs it: a figure typed in the money
 * that PAYS (the destination side) converted back into the currency the thing
 * is PRICED in. Same rounding discipline as the forward direction: one
 * HALF_UP rounding at {@link AMOUNT_DP}, after the division.
 *
 * A rate that is zero or negative fails as 'not-a-number' rather than
 * dividing: no real currency pair has one (the local schema's
 * `fx_rate_e10 > 0` CHECK says the same thing in storage), so a caller
 * holding such a rate is holding a parsing mistake, not a conversion.
 */
export function sourceForRate(
  destinationAmount: DecimalInstance | number | string,
  rate: DecimalInstance | number | string
): FxResult<DecimalInstance> {
  const destination = readAmount(destinationAmount);
  const rateValue = readAmount(rate);
  if (destination === null || rateValue === null) return fail('not-a-number');
  if (rateValue.lessThanOrEqualTo(0)) return fail('not-a-number');

  return ok(
    destination
      .abs()
      .dividedBy(rateValue)
      .toDecimalPlaces(AMOUNT_DP, Decimal.ROUND_HALF_UP)
  );
}

/**
 * A rate as it is STORED: an exact decimal string, trailing zeros removed.
 *
 * `toFixed` would pad "0.79" to "0.7900000000", which stores ten digits of
 * precision the quote never had. Decimal's own `toString` is exact and carries
 * only the digits that exist — and because the value has already been rounded
 * to {@link RATE_DP}, it can never arrive here in exponential form for any rate
 * a real currency pair produces.
 */
export function rateToStorageString(rate: DecimalInstance): string {
  return rate.toDecimalPlaces(RATE_DP, Decimal.ROUND_HALF_UP).toString();
}

/** Decimal places a rate is QUOTED in. The FX convention, and Claude Design's §9.1. */
export const RATE_DISPLAY_DP = 4;

/**
 * A rate as it is SHOWN — four decimal places, trailing zeros gone.
 *
 * Distinct from {@link rateToStorageString}, and the split is the point.
 * Storage keeps {@link RATE_DP} because a DERIVED rate is a division and
 * division does not terminate: $100 arriving as £74.07 gives 0.7407407407…,
 * and the stored figure has to reproduce the amounts it came from.
 *
 * Display has the opposite duty. Ten places presented a float artefact as
 * precision the quote never had — in an app that measures its numbers
 * carefully everywhere else — so the reader was shown ten digits of confidence
 * about a number that is really "about 0.74".
 *
 * WHAT IS AUTHORITATIVE IS THE AMOUNTS, not the rate. Both legs record their
 * own currency's figure to the penny, and the rate is provenance for how they
 * relate. So rounding the DISPLAY cannot make the ledger disagree with itself:
 * $100 x 0.7407 is £74.07, which is the figure recorded, which is Design's
 * requirement that "the recorded figures reconcile against the displayed rate".
 *
 * The significant-digits fallback is for the pairs where four places is not a
 * convention but a deletion — 1 JPY = 0.0000052 GBP rounds to 0.0000 at four,
 * and a rate shown as zero is worse than a long one.
 */
export function rateToDisplayString(rate: DecimalInstance | string): string {
  const value = typeof rate === 'string' ? new Decimal(rate) : rate;
  const rounded = value.toDecimalPlaces(RATE_DISPLAY_DP, Decimal.ROUND_HALF_UP);
  if (!rounded.isZero() || value.isZero()) return rounded.toString();
  return value.toSignificantDigits(RATE_DISPLAY_DP, Decimal.ROUND_HALF_UP).toString();
}

/**
 * The `metadata.fx` object for one linked pair. Written to BOTH legs unchanged:
 * the rate is a property of the CONVERSION, not of either row, so two legs that
 * disagreed about it would be a bug with no correct reading.
 */
export function buildFxRecord(
  rate: DecimalInstance,
  source: FxRateSource,
  asOf: Date
): FxRecord {
  return {
    rate: rateToStorageString(rate),
    source,
    asOf: asOf.toISOString(),
  };
}

/**
 * Read back an `metadata.fx` written by {@link buildFxRecord}.
 *
 * Defensive because metadata is an open jsonb blob that other writers share:
 * anything shaped wrong reads as absent rather than throwing inside a render.
 */
export function readFxRecord(metadata: unknown): FxRecord | null {
  if (typeof metadata !== 'object' || metadata === null) return null;
  const fx = (metadata as Record<string, unknown>).fx;
  if (typeof fx !== 'object' || fx === null) return null;

  const candidate = fx as Record<string, unknown>;
  const { rate, source, asOf } = candidate;
  if (typeof rate !== 'string' || rate === '') return null;
  if (source !== 'api' && source !== 'manual' && source !== 'derived') return null;
  if (typeof asOf !== 'string' || asOf === '') return null;
  if (readAmount(rate) === null) return null;

  return { rate, source, asOf };
}

/**
 * "1 USD = 0.79 GBP" — the sentence a rate is quoted in.
 *
 * Trailing zeros are already gone (see {@link rateToStorageString}), so a rate
 * of exactly 2 reads "1 GBP = 2 USD" rather than "2.0000000000".
 */
export function describeRate(rate: DecimalInstance | string, pair: FxPair): string {
  return `1 ${pair.from} = ${rateToDisplayString(rate)} ${pair.to}`;
}
