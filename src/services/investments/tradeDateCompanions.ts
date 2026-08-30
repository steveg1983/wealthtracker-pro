/**
 * WHAT MOVES WITH A TRADE'S DATE — and what a deleted holding takes with it.
 *
 * A recorded buy or sell is never one row. The event carries the trade; the
 * REGISTER carries its money — a funded buy's transfer legs, an unfunded
 * buy's opening-position row (openingPosition.ts), a sale's proceeds and its
 * realised-gain line — and the price table carries the price the trade
 * implied. Move the event's date alone and the ledger says the money arrived
 * on one day while the valuation says the position existed from another: the
 * exact disagreement the opening-position work exists to prevent.
 *
 * This module is the single answer to "which register rows belong to this
 * trade". It matches by the same descriptions the writers write — built here
 * from the same formatter, so a drift in either place fails the tests rather
 * than silently orphaning rows — plus the trade's own date, which is what
 * separates two identical buys a month apart.
 *
 * The owner's first live use is also the motivating counterexample: a row
 * whose date was already changed BY HAND matches nothing here, and that is
 * correct — this helper must never guess at rows the owner has taken over.
 * The caller says so instead of moving something it cannot vouch for.
 */

import { toDecimal } from '../../utils/decimal';
import { formatDecimal } from '../../utils/decimal-format';

/** The slice of Transaction this decision reads. */
export interface TransactionForTradeMove {
  id: string;
  accountId: string;
  /** YYYY-MM-DD or Date — normalised inside. */
  date: string | Date;
  description: string;
}

/** The slice of InvestmentEvent this decision reads. */
export interface EventForTradeMove {
  /** YYYY-MM-DD. */
  date: string;
  kind: 'buy' | 'sell' | 'write_off';
  /** Decimal string. */
  quantity: string;
  symbol: string | null;
}

/**
 * LOCAL calendar day, the house idiom (categorySpendSummary et al) — never
 * toISOString, which shifts a local-midnight Date across the boundary in any
 * timezone east of Greenwich and matched nothing in BST.
 */
const dayOf = (date: string | Date): string => {
  if (typeof date === 'string') return date.slice(0, 10);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/**
 * Every description a trade's register rows can carry, verbatim from the
 * writers: Investments.tsx's buy/sell legs use formatDecimal(qty, 4); the
 * opening-position row uses the quantity's own toString.
 */
export function tradeRowDescriptions(event: EventForTradeMove): string[] {
  if (event.symbol === null) return [];
  const quantity = toDecimal(event.quantity);
  const formatted = formatDecimal(quantity, 4);
  if (event.kind === 'buy') {
    return [
      `Buy ${formatted} ${event.symbol}`,
      `Opening position — ${quantity.toString()} ${event.symbol}`,
    ];
  }
  if (event.kind === 'sell') {
    return [
      `Sell ${formatted} ${event.symbol}`,
      // The sale's income leg, dated the same day by the same write.
      `Realised gain — ${event.symbol}`,
      `Realised loss — ${event.symbol}`,
    ];
  }
  return [];
}

/**
 * The register rows that move with this trade: same day, and a description
 * the trade's own writers produced. Both legs of a transfer match (the
 * counterpart copies the description), which is the point — a date that
 * moved on one side only would strand the pair across days.
 */
export function tradeDateCompanions(
  event: EventForTradeMove,
  transactions: readonly TransactionForTradeMove[]
): string[] {
  const wanted = new Set(tradeRowDescriptions(event));
  if (wanted.size === 0) return [];
  return transactions
    .filter((row) => dayOf(row.date) === event.date && wanted.has(row.description))
    .map((row) => row.id);
}

/**
 * The opening-position rows a DELETED holding leaves behind — matched by
 * shape and symbol, deliberately NOT by date or quantity: a row the owner
 * has redated (or a holding whose units were edited) is still this
 * position's cost, and a deleted position's cost left standing double-counts
 * the moment the holding is re-added.
 *
 * Only the synthetic opening rows. A funded buy's transfer stays: it records
 * money that genuinely moved between two accounts, and deleting the holding
 * does not unmove it.
 */
export function openingPositionRowsFor(
  accountId: string,
  symbol: string,
  transactions: readonly TransactionForTradeMove[]
): string[] {
  return transactions
    .filter(
      (row) =>
        row.accountId === accountId &&
        row.description.startsWith('Opening position — ') &&
        row.description.endsWith(` ${symbol}`)
    )
    .map((row) => row.id);
}
