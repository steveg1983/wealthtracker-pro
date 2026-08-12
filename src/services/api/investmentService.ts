/**
 * Holdings — the cloud half.
 *
 * public.investments has existed since the initial schema and NOTHING wrote to
 * it. Holdings were kept on `Account.holdings`, which api/accountMapping.ts
 * strips on every write (it is not a column of `accounts`), so every holding
 * anyone ever entered was discarded the moment the modal closed. This service
 * is where a holding actually goes.
 *
 * ── IT IS NOW THE PORT'S CLOUD HALF, NOT THE PAGE'S SERVICE ─────────────────
 *
 * `pages/Investments.tsx` used to call these four methods directly, with a
 * `userIdService` lookup at every call site — the last region of the data layer
 * that had never gone through `dataPort`. `src/desktop/routes.ts` recorded the
 * consequence as a measurement rather than an opinion: *"holdings are the one
 * part of the ledger that never went through the seam, so this page talks to
 * Supabase DIRECTLY"*, which is what kept the Investments route out of a device
 * window.
 *
 * The queries below are UNCHANGED — the same columns, the same `.eq()` pairs,
 * the same refusals, byte for byte. What changed is who calls them:
 * `DataServiceImpl` does, on its cloud branch, exactly as it delegates budgets
 * and goals to `PlanningService`. The page asks the seam.
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
 * ── THE SHAPES LIVE NEXT DOOR, AND THIS FILE RE-EXPORTS THEM ────────────────
 *
 * `services/investments/holding.ts` holds the types, the asset-type list and
 * `toHolding`, because this module's first line is `import { supabase }` and a
 * desktop bundle may not contain one. Every name is re-exported here so that no
 * importer moved — the same arrangement `backupService.ts` has with
 * `backup/format.ts` since slice 27, and for the same reason.
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
import { toHolding, toHoldings, type InvestmentHolding } from '../investments/holding';

export {
  INVESTMENT_ASSET_TYPES,
  toHolding,
  toHoldings
} from '../investments/holding';
export type {
  InvestmentAssetType,
  InvestmentChanges,
  InvestmentDraft,
  InvestmentHolding,
  QuoteWriteback
} from '../investments/holding';

import type {
  InvestmentChanges,
  InvestmentDraft,
  QuoteWriteback
} from '../investments/holding';

/**
 * ONE STRING LITERAL, not a concatenation: supabase-js parses this at the type
 * level to shape the row it returns, and a computed string collapses every
 * result to GenericStringError. Keep it on one line however long it gets.
 */
const SELECTED_COLUMNS = 'id, account_id, symbol, name, quantity, cost_basis, current_price, currency, asset_type, purchase_date, purchase_price, last_updated, notes';

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

    return toHoldings(data ?? []);
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
