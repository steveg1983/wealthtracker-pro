/**
 * A holding's quantity events — the rows of investment_events, typed.
 *
 * An event is the ONLY thing that changes how many units a position holds:
 * a buy, a sell, or a write-off (a worthless delisting — quantity removed at
 * no value; the owner's Money file has exactly one). Dividends and returns
 * of capital are cash and live in the ledger, never here — the owner's
 * ruling, 26 Aug. Events are a view-layer lane: importing them writes no
 * transactions, and a register derives from events + the price series.
 *
 * Figures are register figures in the ACCOUNT's currency; `amount` is a
 * positive magnitude (paid or received) with direction carried by `kind`.
 */

export type InvestmentEventKind = 'buy' | 'sell' | 'write_off';

export interface InvestmentEvent {
  id: string;
  accountId: string;
  /** null for the securities Money held without a ticker — name identifies. */
  symbol: string | null;
  securityName: string;
  /** YYYY-MM-DD. */
  date: string;
  kind: InvestmentEventKind;
  /** Decimal string, always positive. */
  quantity: string;
  /** Per unit, decimal string; a write-off has none. */
  price: string | null;
  /** Commission and charges, decimal string, when recorded. */
  fees: string | null;
  /** Positive magnitude — paid (buy) or received (sell); '0' for a write-off. */
  amount: string;
  currency: string;
  source: 'import' | 'manual';
}

/** A row headed for the store — an import's unit of work. */
export interface InvestmentEventDraft {
  accountId: string;
  symbol: string | null;
  securityName: string;
  date: string;
  kind: InvestmentEventKind;
  quantity: string;
  price: string | null;
  fees: string | null;
  amount: string;
  currency: string;
  /** The originating program's per-row id — the store's idempotency key. */
  sourceRef: string;
}

/** The store row, snake-cased — one place owns the mapping. */
export function toInvestmentEvent(row: Record<string, unknown>): InvestmentEvent | null {
  const id = typeof row.id === 'string' ? row.id : null;
  const accountId = typeof row.account_id === 'string' ? row.account_id : null;
  const securityName = typeof row.security_name === 'string' ? row.security_name : null;
  const date = row.event_date == null ? null : String(row.event_date);
  const kind = row.kind === 'buy' || row.kind === 'sell' || row.kind === 'write_off' ? row.kind : null;
  if (id === null || accountId === null || securityName === null || date === null || kind === null) {
    return null;
  }
  return {
    id,
    accountId,
    symbol: typeof row.symbol === 'string' && row.symbol !== '' ? row.symbol : null,
    securityName,
    date,
    kind,
    quantity: String(row.quantity ?? '0'),
    price: row.price == null ? null : String(row.price),
    fees: row.fees == null ? null : String(row.fees),
    amount: String(row.amount ?? '0'),
    currency: typeof row.currency === 'string' && row.currency !== '' ? row.currency : 'GBP',
    source: row.source === 'manual' ? 'manual' : 'import'
  };
}
