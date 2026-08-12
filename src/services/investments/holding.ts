/**
 * A HOLDING — what one is, and how a stored row becomes one.
 *
 * ── WHY THIS IS A MODULE OF ITS OWN ─────────────────────────────────────────
 *
 * It is the lift slice 27 performed on the backup format, for the same reason
 * and with the same rule: `services/api/investmentService.ts` begins
 * `import { supabase }`, so anything that reaches it reaches a Supabase client,
 * and a device bundle may not contain one. Until this slice nothing needed the
 * holding types outside that file, because holdings never went through the seam
 * at all — the Investments page called the service directly, which is exactly
 * what `src/desktop/routes.ts` recorded as the reason its route could not mount.
 *
 * Now three things need them and only one of the three may see a cloud client:
 *
 *   `services/port/dataPort.ts`   — types only, and erased at build;
 *   `services/local/mappers/`     — the asset-type list, at RUNTIME, in a
 *                                   desktop bundle;
 *   `services/api/investmentService.ts` — the cloud half, which re-exports
 *                                   every name below so that not one importer
 *                                   moved.
 *
 * That last line is the 70-importer lesson written down: a file move is only
 * safe when the old path keeps answering.
 *
 * ── WHAT IS HERE AND WHAT IS NOT ────────────────────────────────────────────
 *
 * Here: the shapes, the asset-type list, and {@link toHolding} — the one
 * translation from a stored row to the app's object. There is no client, no
 * query, no error handling and no decision about where a row came from.
 *
 * Not here: the four writes. They are the CLOUD's half and they stay in
 * `investmentService.ts`, because each one is a PostgREST call.
 *
 * ── ONE MAPPER, BOTH ENGINES ────────────────────────────────────────────────
 *
 * {@link toHolding} is read by the cloud implementation and by the local one,
 * which is the arrangement `mappers/rows.ts` already has for an account
 * (`toAccount` IS `mapAccountFromDb` — *"the read direction is not 'another
 * interpretation of this table', it is literally the same function the signed-in
 * boot uses"*). It works here for a reason worth stating rather than assuming:
 * the crate's `list_investments` answers with the CLOUD's own `SELECTED_COLUMNS`,
 * so the two engines hand this function the same keys.
 *
 * They do not hand it the same JSON TYPES, and that is why every reader below
 * accepts both. PostgREST sends `numeric` as a JSON number; the ledger crate
 * sends every figure as a decimal STRING, because a JSON number is an IEEE-754
 * double the moment a parser touches it. `asDecimal` takes either and goes
 * through `Decimal` in both cases, so no float arithmetic happens on this path
 * whichever engine answered.
 */

import { toDecimal, type DecimalInstance } from '../../utils/decimal';

/** The asset kinds `public.investments` admits (`investments_asset_type_check`). */
export const INVESTMENT_ASSET_TYPES = [
  'stock',
  'bond',
  'etf',
  'mutual_fund',
  'crypto',
  'commodity',
  'real_estate',
  'other'
] as const;

export type InvestmentAssetType = (typeof INVESTMENT_ASSET_TYPES)[number];

export interface InvestmentHolding {
  id: string;
  /** Nullable in the schema; every row this app writes names an account. */
  accountId: string | null;
  symbol: string;
  name: string;
  quantity: DecimalInstance;
  /** What the whole position cost. */
  costBasis: DecimalInstance;
  /** costBasis ÷ quantity, or zero for a zero-quantity row. */
  averageCost: DecimalInstance;
  /**
   * Last known price of ONE unit, in `currency`'s MAJOR unit — pence are
   * normalised to pounds at the proxy (api/_lib/quotes.ts), never here.
   * null means "never priced", which the UI must say rather than show 0.
   */
  currentPrice: DecimalInstance | null;
  /** quantity × currentPrice, or null when there is no price. */
  marketValue: DecimalInstance | null;
  currency: string;
  assetType: InvestmentAssetType;
  purchaseDate: Date | null;
  purchasePrice: DecimalInstance | null;
  /** When the price was taken from the exchange. null when never priced. */
  lastUpdated: Date | null;
  notes: string;
}

/** A new holding, as the user describes it. */
export interface InvestmentDraft {
  accountId: string;
  symbol: string;
  name: string;
  quantity: DecimalInstance;
  /** Per unit. costBasis is derived from it so the two can never disagree. */
  averageCost: DecimalInstance;
  currency: string;
  assetType?: InvestmentAssetType;
  purchaseDate?: Date | null;
  notes?: string;
}

/** Fields an edit may change. Absent means "leave alone". */
export interface InvestmentChanges {
  symbol?: string;
  name?: string;
  quantity?: DecimalInstance;
  averageCost?: DecimalInstance;
  currency?: string;
  assetType?: InvestmentAssetType;
  notes?: string;
}

/** One price to write back, as /api/quotes returned it. */
export interface QuoteWriteback {
  symbol: string;
  /** Decimal string in the major unit. */
  price: string;
  /** ISO 8601. */
  asOf: string;
}

const asText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

/**
 * A numeric column as a Decimal.
 *
 * PostgREST sends `numeric` as a JSON number and the ledger crate sends a
 * decimal string; both are accepted, and neither is trusted to be the only
 * shape. The wire format is not worth trusting on the fields that decide what a
 * portfolio is worth.
 */
const asDecimal = (value: unknown): DecimalInstance | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return toDecimal(value);
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = toDecimal(value);
    return parsed.isNaN() ? null : parsed;
  }
  return null;
};

const asDate = (value: unknown): Date | null => {
  const text = asText(value);
  if (text === null) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
};

const asAssetType = (value: unknown): InvestmentAssetType =>
  INVESTMENT_ASSET_TYPES.find((type) => type === value) ?? 'other';

const ZERO = toDecimal(0);

/**
 * A stored row as the app's holding, or null when it is unreadable.
 *
 * A row with no symbol or no quantity cannot be valued or priced, so it is
 * dropped rather than shown as a zero — a holding that reads "0 units" is a
 * statement about the portfolio, and it would be a false one.
 *
 * `marketValue` is COMPUTED here rather than read, on every engine. The column
 * exists in both schemas and neither writes it, because a stored copy of
 * quantity × price goes stale the moment the price does — see
 * `crate::row::investment` for the file's half of the same decision.
 */
export function toHolding(row: Record<string, unknown>): InvestmentHolding | null {
  const id = asText(row.id);
  const symbol = asText(row.symbol);
  const quantity = asDecimal(row.quantity);
  if (!id || !symbol || quantity === null) return null;

  const costBasis = asDecimal(row.cost_basis) ?? ZERO;
  const currentPrice = asDecimal(row.current_price);

  return {
    id,
    accountId: asText(row.account_id),
    symbol,
    name: asText(row.name) ?? symbol,
    quantity,
    costBasis,
    averageCost: quantity.isZero() ? ZERO : costBasis.dividedBy(quantity),
    currentPrice,
    marketValue: currentPrice === null ? null : currentPrice.times(quantity),
    currency: asText(row.currency) ?? 'GBP',
    assetType: asAssetType(row.asset_type),
    purchaseDate: asDate(row.purchase_date),
    purchasePrice: asDecimal(row.purchase_price),
    lastUpdated: asDate(row.last_updated),
    notes: asText(row.notes) ?? ''
  };
}

/**
 * Every readable holding of a list of stored rows.
 *
 * The loop both engines run after their own read, written once so that "a row
 * this app cannot read is dropped rather than shown as a zero" is one rule
 * rather than two copies of one.
 */
export function toHoldings(rows: ReadonlyArray<Record<string, unknown>>): InvestmentHolding[] {
  const holdings: InvestmentHolding[] = [];
  for (const row of rows) {
    const holding = toHolding(row);
    if (holding) holdings.push(holding);
  }
  return holdings;
}
