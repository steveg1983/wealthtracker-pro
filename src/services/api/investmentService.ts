/**
 * Holdings — the cloud half.
 *
 * public.investments has existed since the initial schema and NOTHING wrote to
 * it. Holdings were kept on `Account.holdings`, which api/accountMapping.ts
 * strips on every write (it is not a column of `accounts`), so every holding
 * anyone ever entered was discarded the moment the modal closed. This service
 * is where a holding actually goes.
 *
 * ── WHAT A HOLDING IS AND IS NOT ────────────────────────────────────────────
 * A row here is a POSITION: a symbol, how many units, what they cost. It is NOT
 * the value of the account. The Investments page's headline figures come from
 * utils/portfolioSummary, which totals the LEDGER (opening balance plus
 * transactions across the investment↔cash pair) — that is the page's source of
 * truth and this table must never be added to it. Holdings × price is a
 * separate, clearly-labelled MARKET view that sits alongside the ledger figure.
 * Adding the two would count the same money twice.
 *
 * ── SECURITY ────────────────────────────────────────────────────────────────
 * RLS does the enforcing: investments_all_own (FOR ALL TO authenticated, USING
 * and WITH CHECK on user_id = public.requesting_user_id()) was created by
 * 20260610130000_restore_rls_data_isolation.sql and RLS is enabled on the
 * table. The explicit `.eq('user_id', userId)` on every read and write is
 * defence in depth in the same style as the rest of the data layer — a
 * mis-routed id fails to match a row instead of relying on the policy alone.
 *
 * Every method THROWS on failure. A holding that silently fails to save is the
 * exact bug this service exists to end.
 */

import { supabase, handleSupabaseError } from './supabaseClient';
import { createScopedLogger } from '../../loggers/scopedLogger';
import { toDecimal, type DecimalInstance } from '../../utils/decimal';

/** The asset kinds public.investments admits (investments_asset_type_check). */
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
  /** Nullable in the schema; every row this service writes names an account. */
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

/**
 * ONE STRING LITERAL, not a concatenation: supabase-js parses this at the type
 * level to shape the row it returns, and a computed string collapses every
 * result to GenericStringError. Keep it on one line however long it gets.
 */
const SELECTED_COLUMNS = 'id, account_id, symbol, name, quantity, cost_basis, current_price, currency, asset_type, purchase_date, purchase_price, last_updated, notes';

const asText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

/**
 * A numeric column as a Decimal. PostgREST sends `numeric` as a JSON number,
 * but a string is accepted too — the wire format is not worth trusting on the
 * one field that decides what a portfolio is worth.
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
 */
function toHolding(row: Record<string, unknown>): InvestmentHolding | null {
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

const requireClient = (action: string) => {
  if (!supabase) {
    throw new Error(`Not connected — ${action} could not be saved.`);
  }
  return supabase;
};

/** A row that came back unreadable is a save we cannot confirm. Say so. */
const readBack = (data: Record<string, unknown> | null): InvestmentHolding => {
  const holding = data ? toHolding(data) : null;
  if (!holding) {
    throw new Error('This holding was saved but could not be read back — reload and check.');
  }
  return holding;
};

export class InvestmentService {
  private static logger = createScopedLogger('InvestmentService');

  /** Every holding this user owns, newest symbol order-independent. */
  static async list(userId: string): Promise<InvestmentHolding[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('investments')
      .select(SELECTED_COLUMNS)
      .eq('user_id', userId)
      .order('symbol', { ascending: true });

    if (error) {
      this.logger.error('Failed to load holdings', error);
      throw new Error(handleSupabaseError(error));
    }

    const holdings: InvestmentHolding[] = [];
    for (const row of data ?? []) {
      const holding = toHolding(row);
      if (holding) holdings.push(holding);
    }
    return holdings;
  }

  static async create(userId: string, draft: InvestmentDraft): Promise<InvestmentHolding> {
    const client = requireClient('this holding');

    // cost_basis is DERIVED from quantity × averageCost rather than stored
    // beside it: two numbers that must agree are two numbers that will not.
    const costBasis = draft.quantity.times(draft.averageCost);

    const { data, error } = await client
      .from('investments')
      .insert({
        user_id: userId,
        account_id: draft.accountId,
        symbol: draft.symbol.trim().toUpperCase(),
        name: draft.name.trim() || draft.symbol.trim().toUpperCase(),
        // Numerics go over the wire as STRINGS: a JSON number would round-trip
        // 8-decimal quantities and sub-penny prices through a float first.
        quantity: draft.quantity.toString(),
        cost_basis: costBasis.toString(),
        purchase_price: draft.averageCost.toString(),
        purchase_date: draft.purchaseDate ? draft.purchaseDate.toISOString().slice(0, 10) : null,
        currency: draft.currency,
        asset_type: draft.assetType ?? 'stock',
        notes: draft.notes ?? null
      })
      .select(SELECTED_COLUMNS)
      .single();

    if (error) {
      this.logger.error('Failed to add holding', error);
      throw new Error(handleSupabaseError(error));
    }
    return readBack(data);
  }

  static async update(
    userId: string,
    id: string,
    changes: InvestmentChanges
  ): Promise<InvestmentHolding> {
    const client = requireClient('this change');

    const columns: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (changes.symbol !== undefined) columns.symbol = changes.symbol.trim().toUpperCase();
    if (changes.name !== undefined) columns.name = changes.name.trim();
    if (changes.currency !== undefined) columns.currency = changes.currency;
    if (changes.assetType !== undefined) columns.asset_type = changes.assetType;
    if (changes.notes !== undefined) columns.notes = changes.notes;

    // Quantity and unit cost move cost_basis together or not at all — writing
    // one without recomputing the other would leave the row describing a
    // position that was never held.
    if (changes.quantity !== undefined || changes.averageCost !== undefined) {
      const current = await this.findOne(userId, id);
      if (!current) {
        throw new Error('That holding no longer exists — reload the page.');
      }
      const quantity = changes.quantity ?? current.quantity;
      const averageCost = changes.averageCost ?? current.averageCost;
      columns.quantity = quantity.toString();
      columns.cost_basis = quantity.times(averageCost).toString();
      columns.purchase_price = averageCost.toString();
    }

    const { data, error } = await client
      .from('investments')
      .update(columns)
      .eq('id', id)
      .eq('user_id', userId)
      .select(SELECTED_COLUMNS)
      .single();

    if (error) {
      this.logger.error('Failed to update holding', error);
      throw new Error(handleSupabaseError(error));
    }
    return readBack(data);
  }

  static async remove(userId: string, id: string): Promise<void> {
    const client = requireClient('this deletion');

    const { error } = await client
      .from('investments')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      this.logger.error('Failed to delete holding', error);
      throw new Error(handleSupabaseError(error));
    }
  }

  /**
   * Write fetched prices back onto this user's rows.
   *
   * Only current_price and last_updated move: quantity, cost basis and account
   * are the user's data and a price refresh has no business touching them.
   * `market_value` is deliberately NOT written — it is quantity × price, and a
   * stored copy of a derived number is a copy that goes stale. The screen
   * computes it, so a holding can never display a value its own price
   * contradicts.
   *
   * Returns how many rows were repriced, so the caller can say "3 of 5 updated"
   * rather than claiming success it did not verify.
   */
  static async applyQuotes(userId: string, quotes: readonly QuoteWriteback[]): Promise<number> {
    if (quotes.length === 0) return 0;
    const client = requireClient('these prices');

    let updated = 0;
    for (const quote of quotes) {
      const { data, error } = await client
        .from('investments')
        .update({
          current_price: quote.price,
          last_updated: quote.asOf,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('symbol', quote.symbol)
        .select('id');

      if (error) {
        this.logger.error('Failed to store price', error);
        throw new Error(handleSupabaseError(error));
      }
      updated += data?.length ?? 0;
    }
    return updated;
  }

  private static async findOne(userId: string, id: string): Promise<InvestmentHolding | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('investments')
      .select(SELECTED_COLUMNS)
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return null;
    return toHolding(data);
  }
}
