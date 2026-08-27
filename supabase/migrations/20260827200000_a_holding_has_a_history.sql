-- ============================================================================
-- A HOLDING HAS A HISTORY — investment quantity events
-- ============================================================================
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor).
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
--
-- investment_prices answered "what was one share worth on a date"; nothing
-- answers "how many shares did I hold on that date". The owner's question —
-- "how can I look back at the buys / sells of EMG or any imported stock?" —
-- needs quantity over time, and so does net worth as-at-date, which is
-- otherwise valuing today's position at yesterday's price.
--
-- The measured precedent is again the owner's own .mny (probed 27 Aug 2026):
--
--   * 140 security-carrying transactions in 51,768. Quantity and unit price
--     do NOT live on Money's TRN row — they live in the TRN_INV side table
--     (92 rows), joined by transaction id. Activity code act=1 is a buy
--     (amount = qty × price + commission), act=2 a sell (amount =
--     −(qty × price − commission)), act=13 a write-off (quantity removed at
--     no value — a worthless delisting). Those THREE change quantity: 52
--     buys, 39 sells, 1 write-off.
--   * act=3 (dividends, 47 rows) and act=8 (a return of capital) move CASH
--     and leave quantity alone. Per the owner's ruling (26 Aug): anything
--     that does not change the quantity of the holding is cash, not a
--     holding event. Those rows already exist in this app's ledger from the
--     July import and are NOT duplicated here.
--   * Every closed position folds to EXACTLY zero from buys/sells/write-off
--     alone — Money's SEC_SPLIT rows are not linked by security id and are
--     not needed to close any fold in this file. Splits are therefore not an
--     event kind yet; a future migration may extend the CHECK when live
--     trading (slice 4) needs one.
--
-- ── THE MODEL ───────────────────────────────────────────────────────────────
--
-- One row per quantity-changing event, keyed to the APP account (the
-- portfolio it happened in) and the security. Events are a VIEW-LAYER lane:
-- importing them writes no transactions — the cash side of every historical
-- buy, sell and dividend is already in the ledger, and the closed accounts
-- already balance to zero. A register derives from events + investment_prices
-- and is never stored, exactly like the price-derived revaluations.
--
-- `symbol` is nullable because 11 of the owner's securities carry no ticker
-- in Money (Apple, Vodafone, Tesco…). Their registers are trades-only —
-- honest — until a symbol is attached; `security_name` always identifies.
--
-- `amount` is stored as a POSITIVE magnitude — what was paid (buy, fees in)
-- or received (sell, fees out); direction is the kind's job. Money's signed
-- register convention stays in Money.
--
-- `source_ref` carries Money's per-row GUID (TRN.sguid), so a re-import is a
-- no-op by construction — the same idempotency contract as the price import.
-- It is a plain UNIQUE constraint, not a partial index, for two reasons that
-- point the same way: Postgres treats NULLs as distinct (manual events,
-- slice 4, carry no ref and may repeat freely), and PostgREST's on_conflict
-- can only target a real constraint — a partial index would make the
-- idempotent upsert impossible to express through the API.

CREATE TABLE IF NOT EXISTS public.investment_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  symbol text CHECK (symbol IS NULL OR btrim(symbol) <> ''),
  security_name text NOT NULL CHECK (btrim(security_name) <> ''),
  event_date date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('buy', 'sell', 'write_off')),
  quantity numeric(20,8) NOT NULL CHECK (quantity > 0),
  -- Per unit, in the security's currency; a write-off has none.
  price numeric(20,8) CHECK (price IS NULL OR price >= 0),
  fees numeric(14,2) CHECK (fees IS NULL OR fees >= 0),
  -- Positive magnitude — see the header. Zero for a write-off.
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'GBP',
  source text NOT NULL CHECK (source IN ('import', 'manual')),
  source_ref text CHECK (source_ref IS NULL OR btrim(source_ref) <> ''),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- NULLs are distinct, so manual events repeat freely — see the header.
  CONSTRAINT investment_events_source_ref_once UNIQUE (user_id, source_ref)
);

-- The register's query: one account's events, oldest first.
CREATE INDEX IF NOT EXISTS investment_events_by_account
  ON public.investment_events (user_id, account_id, event_date);

-- ── RLS — the custom_reports pattern exactly ────────────────────────────────

ALTER TABLE public.investment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS investment_events_select_own ON public.investment_events;
CREATE POLICY investment_events_select_own ON public.investment_events
  FOR SELECT TO authenticated
  USING (user_id = public.requesting_user_id());

DROP POLICY IF EXISTS investment_events_insert_own ON public.investment_events;
CREATE POLICY investment_events_insert_own ON public.investment_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.requesting_user_id());

DROP POLICY IF EXISTS investment_events_update_own ON public.investment_events;
CREATE POLICY investment_events_update_own ON public.investment_events
  FOR UPDATE TO authenticated
  USING (user_id = public.requesting_user_id())
  WITH CHECK (user_id = public.requesting_user_id());

DROP POLICY IF EXISTS investment_events_delete_own ON public.investment_events;
CREATE POLICY investment_events_delete_own ON public.investment_events
  FOR DELETE TO authenticated
  USING (user_id = public.requesting_user_id());

REVOKE ALL ON TABLE public.investment_events FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.investment_events TO authenticated;
GRANT ALL ON TABLE public.investment_events TO service_role;
