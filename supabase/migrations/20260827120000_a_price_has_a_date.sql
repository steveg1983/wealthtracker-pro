-- ============================================================================
-- A PRICE HAS A DATE — investment price history
-- ============================================================================
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor).
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
--
-- The app has exactly one price per holding: investments.current_price, a
-- snapshot with no date. Every refresh OVERWRITES it, so the question net
-- worth actually asks — "what was this holding worth on the 3rd of June?" —
-- is unanswerable. A net worth that cannot value investments over time is not
-- tracking wealth, which is the name over the door (owner, 27 Aug).
--
-- Microsoft Money answered it with a price table, and the owner's own .mny
-- file is the measured precedent (probed 27 Aug 2026):
--
--   * SP table: 249 rows of (security, date, price, source) against only 140
--     security-carrying transactions in 51,768 — Money stored PRICES, and
--     computed value as shares × price-as-at-date. It did not write
--     revaluation transactions.
--   * 88 distinct price dates across eight years — a person pressing refresh
--     roughly monthly, not a nightly job. History is sparse BY NATURE, and
--     every consumer must read "the last price on or before the date", never
--     expect a row per day.
--   * Prices live in the SECURITY's currency, not the account's: a sale in
--     the file appears in SP converted from the GBP register figure into the
--     security's own USD. Hence the currency column here, per row.
--
-- ── THE MODEL ───────────────────────────────────────────────────────────────
--
-- One row per (user, symbol, day); a same-day refresh replaces rather than
-- accumulates — the day's price is a fact with one value, and the upsert path
-- carries ON CONFLICT accordingly. Keyed by SYMBOL, not by holding id,
-- exactly as Money keyed SP by security: two accounts holding the same share
-- share one price series, and a holding sold and re-bought later re-attaches
-- to its history by name.
--
-- This table is the SOURCE OF TRUTH the register derives from (owner's
-- ruling, 27 Aug): revaluation lines in a holding's register are computed
-- from consecutive prices, not stored, so correcting a bad price corrects
-- history in one row and the two can never drift apart.
--
-- `source` says who asserted the figure:
--   'quote'   a live quote fetch (the refresh button)
--   'manual'  the owner typed it (the local edition's only path, by design)
--   'trade'   implied by a buy or sell at a known price
--   'import'  carried in from another program's file (e.g. Money's SP table)
--
-- numeric(20,8) matches investments.current_price after 20260809120000
-- ("a share price is not a money amount") — LSE quotes in pence carry real
-- sub-penny precision and numeric(10,2) silently rounded it away.

CREATE TABLE IF NOT EXISTS public.investment_prices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  symbol text NOT NULL CHECK (btrim(symbol) <> ''),
  price_date date NOT NULL,
  price numeric(20,8) NOT NULL CHECK (price >= 0),
  -- The SECURITY's currency — see the header.
  currency text NOT NULL DEFAULT 'GBP',
  source text NOT NULL CHECK (source IN ('quote', 'manual', 'trade', 'import')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT investment_prices_one_per_day UNIQUE (user_id, symbol, price_date)
);

-- The one query every consumer runs: this user's series for a symbol, newest
-- first, or "last on or before a date". The UNIQUE above already provides the
-- (user_id, symbol, price_date) btree; no second index needed.

-- ── RLS — the custom_reports pattern exactly ────────────────────────────────

ALTER TABLE public.investment_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS investment_prices_select_own ON public.investment_prices;
CREATE POLICY investment_prices_select_own ON public.investment_prices
  FOR SELECT TO authenticated
  USING (user_id = public.requesting_user_id());

DROP POLICY IF EXISTS investment_prices_insert_own ON public.investment_prices;
CREATE POLICY investment_prices_insert_own ON public.investment_prices
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.requesting_user_id());

DROP POLICY IF EXISTS investment_prices_update_own ON public.investment_prices;
CREATE POLICY investment_prices_update_own ON public.investment_prices
  FOR UPDATE TO authenticated
  USING (user_id = public.requesting_user_id())
  WITH CHECK (user_id = public.requesting_user_id());

DROP POLICY IF EXISTS investment_prices_delete_own ON public.investment_prices;
CREATE POLICY investment_prices_delete_own ON public.investment_prices
  FOR DELETE TO authenticated
  USING (user_id = public.requesting_user_id());

REVOKE ALL ON TABLE public.investment_prices FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.investment_prices TO authenticated;
GRANT ALL ON TABLE public.investment_prices TO service_role;
