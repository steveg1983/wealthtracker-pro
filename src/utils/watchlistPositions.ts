/**
 * THE WATCHLIST'S DUMMY POSITIONS (owner, 16 August): "we want to be able to
 * track a number of shares and the 'starting price' so that the user can
 * almost use it as a dummy portfolio."
 *
 * A watched symbol may carry a hypothetical position — how many shares, and
 * the price they were notionally taken at. Nothing here touches the ledger:
 * no account, no transactions, no effect on any total. It is the "what if I
 * had bought" view, and it lives where the watchlist lives, in the browser.
 *
 * Pure functions in a leaf module, because two things here can go quietly
 * wrong and both deserve tests: the MIGRATION (the stored shape used to be a
 * plain array of symbol strings, and a reader that mishandles it empties
 * somebody's list), and the ARITHMETIC (gains are money, and float maths on
 * money is banned in this codebase).
 */
import { toDecimal } from './decimal';
import type { DecimalInstance } from './decimal';

export interface WatchedItem {
  symbol: string;
  /**
   * Decimal STRINGS, not numbers — they multiply into money, and this repo
   * does not do float arithmetic on money. Absent = watched with no position,
   * which is exactly what every item was before this feature.
   */
  shares?: string;
  /** In the same unit the quote displays — USD for AAPL, whatever the card says. */
  startPrice?: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const numericString = (v: unknown): string | undefined => {
  if (typeof v !== 'string' && typeof v !== 'number') return undefined;
  const text = String(v).trim();
  if (text === '') return undefined;
  const n = Number(text);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return text;
};

/**
 * Whatever is in storage → a clean list.
 *
 * Three generations may be found under the key: the original `string[]`, the
 * new `WatchedItem[]`, and (because localStorage is hand-editable) junk. A
 * string becomes a position-less item — the exact meaning it always had — and
 * junk is dropped rather than crashing the list it sits in. Duplicate symbols
 * keep the FIRST occurrence, which is the one the user has seen at the top.
 */
export function normaliseWatchlist(raw: unknown): WatchedItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: WatchedItem[] = [];
  for (const entry of raw) {
    let item: WatchedItem | null = null;
    if (typeof entry === 'string' && entry.trim() !== '') {
      item = { symbol: entry.trim().toUpperCase() };
    } else if (isRecord(entry) && typeof entry.symbol === 'string' && entry.symbol.trim() !== '') {
      const shares = numericString(entry.shares);
      const startPrice = numericString(entry.startPrice);
      item = {
        symbol: entry.symbol.trim().toUpperCase(),
        ...(shares === undefined ? {} : { shares }),
        ...(startPrice === undefined ? {} : { startPrice }),
      };
    }
    if (item === null || seen.has(item.symbol)) continue;
    seen.add(item.symbol);
    out.push(item);
  }
  return out;
}

export interface PositionMetrics {
  /** shares × start price — what the dummy position notionally cost. */
  cost: DecimalInstance;
  /** shares × current price. */
  value: DecimalInstance;
  /** shares × (current − start). Signed — a loss is negative. */
  gain: DecimalInstance;
  /** (current − start) / start × 100. Null when the start price is zero. */
  gainPercent: DecimalInstance | null;
}

/**
 * What the position is worth against a live price — or null when the item
 * carries no complete position, which renders as the plain card it always was.
 *
 * BOTH fields or neither: shares without a start price could still show a
 * value, but it could not show a gain, and a card that answers half the
 * question it was configured to ask reads as broken rather than as partial.
 * The form enforces the same rule, so this is defence in depth, not the UX.
 */
export function positionMetrics(
  item: WatchedItem,
  currentPrice: string | number
): PositionMetrics | null {
  if (item.shares === undefined || item.startPrice === undefined) return null;
  const shares = toDecimal(item.shares);
  const start = toDecimal(item.startPrice);
  const price = toDecimal(currentPrice);
  if (shares.lessThanOrEqualTo(0) || start.lessThan(0)) return null;

  const value = shares.times(price);
  const gain = shares.times(price.minus(start));
  return {
    cost: shares.times(start),
    value,
    gain,
    gainPercent: start.isZero() ? null : price.minus(start).dividedBy(start).times(100),
  };
}
