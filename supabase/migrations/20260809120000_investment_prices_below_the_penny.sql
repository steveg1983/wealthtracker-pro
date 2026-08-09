-- ============================================================================
-- INVESTMENT PRICES BELOW THE PENNY — a share price is not a money amount
-- ============================================================================
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor).
--
-- ORDERING: apply this BEFORE or AFTER the matching client, either way. The
-- client sends full precision from the moment it ships; a database that still
-- has numeric(10,2) simply rounds it on the way in, exactly as it does today.
-- Nothing errors and nothing changes shape — this migration only stops the
-- rounding. There is no window in which the app is worse off than it is now.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
--
-- Yahoo prices LSE shares in PENCE. SHEL.L quotes around 3277.5 GBp, which is
-- £32.775 — three decimal places, and the third one is real: it is a whole
-- penny of the pence quote, not a rounding artefact. The quote proxy
-- (api/_lib/quotes.ts) divides by 100 with Decimal and hands over '32.775'.
--
-- public.investments.current_price is numeric(10,2). Postgres does not reject
-- the extra digit; it ROUNDS IT AWAY, silently, on every write:
--
--   32.775  ->  32.78     (+0.005 per share)
--
-- Half a penny per share sounds like nothing until it is multiplied by a
-- holding: 2,000 shares is £10 of invented value, every night, in the same
-- direction. It is invisible on the screen — 32.78 looks like a price — and it
-- is not a rounding error the user can find, because nothing anywhere records
-- what the price actually was.
--
-- Money TOTALS belong at 2 decimal places: cost_basis and market_value are
-- amounts of money, they are settled in pennies, and they stay numeric(10,2).
-- A UNIT PRICE is not a money total. It is a rate, like an exchange rate, and
-- rounding a rate before multiplying it by a quantity is the classic way to
-- make a portfolio disagree with the broker. quantity already understands this:
-- it is numeric(20,8), because fractional units are real. Prices get the same
-- treatment, for the same reason.
--
-- purchase_price is widened alongside current_price. It is the same kind of
-- number — what one unit cost — typed in by a person who may well be copying
-- 32.775 off a contract note. Leaving it at 2 places would fix tonight's cron
-- and keep silently corrupting what the user types in by hand.
--
-- ── WHAT THIS DOES NOT DO ───────────────────────────────────────────────────
-- No new column, no new table, no new policy, no new grant, no new index, no
-- data rewritten. RLS on public.investments is untouched and already correct:
-- 20260610130000_restore_rls_data_isolation.sql enables it and creates
-- investments_all_own (FOR ALL TO authenticated, USING and WITH CHECK on
-- user_id = public.requesting_user_id()). This migration was written after
-- verifying that, not instead of it.
--
-- ── SAFE TO RUN TWICE ───────────────────────────────────────────────────────
-- Widening a numeric column's precision and scale is idempotent in effect:
-- ALTER ... TYPE numeric(20,8) applied to a column that is already
-- numeric(20,8) is a no-op re-declaration. Applying it to numeric(10,2) widens
-- it. No stored value can fail the conversion, because every numeric(10,2)
-- value is representable in numeric(20,8) — widening cannot lose a digit, only
-- narrowing can.
-- ============================================================================

BEGIN;

-- Guard: this migration assumes the two columns are numeric and NARROWER than
-- (20,8) or already at it. If a future schema made them float, money, or
-- something wider, silently re-declaring the type would either lose precision
-- or lose a deliberate decision made after this file was written. Fail here,
-- naming the column, instead of quietly overwriting someone's later work.
DO $$
DECLARE
  bad record;
BEGIN
  FOR bad IN
    SELECT a.attname AS column_name,
           format_type(a.atttypid, a.atttypmod) AS declared_type
      FROM pg_attribute a
     WHERE a.attrelid = 'public.investments'::regclass
       AND a.attname IN ('current_price', 'purchase_price')
       AND a.attnum > 0
       AND NOT a.attisdropped
       AND (
         -- not numeric at all …
         a.atttypid <> 'numeric'::regtype
         -- … or UNCONSTRAINED numeric (atttypmod -1), which holds more digits
         -- than numeric(20,8) and would be NARROWED by this migration …
         OR a.atttypmod = -1
         -- … or numeric declared wider than this migration sets. atttypmod for
         -- numeric packs precision and scale as ((p << 16) | s) + 4, so the
         -- high half is p and the low half is s.
         OR ((a.atttypmod - 4) >> 16) > 20
         OR ((a.atttypmod - 4) & 65535) > 8
       )
  LOOP
    RAISE EXCEPTION
      'public.investments.% is %, which this migration would narrow or retype; review before applying',
      bad.column_name, bad.declared_type;
  END LOOP;
END $$;

-- 20 total digits, 8 after the point: the same shape `quantity` already uses,
-- so a price and a quantity are stored with the same fidelity and their product
-- is the first place any rounding is allowed to happen.
ALTER TABLE public.investments
  ALTER COLUMN current_price TYPE numeric(20,8);

ALTER TABLE public.investments
  ALTER COLUMN purchase_price TYPE numeric(20,8);

COMMENT ON COLUMN public.investments.current_price IS
  'Last known price of ONE unit, in the currency named by the currency column and always in its MAJOR unit (GBP, never GBp — api/_lib/quotes.ts normalises pence to pounds at the proxy). numeric(20,8) because a unit price is a rate, not a money total: LSE shares quoted in pence land on three decimal places in pounds, and rounding the rate before multiplying by quantity is how a portfolio stops agreeing with the broker.';

COMMENT ON COLUMN public.investments.purchase_price IS
  'What ONE unit cost when it was bought, same units and same precision as current_price.';

COMMIT;

-- ============================================================================
-- VERIFICATION — read this output after applying
-- ============================================================================
-- 1. Both prices now carry eight decimal places, and the money TOTALS still
--    carry two. Expected:
--      cost_basis      numeric(10,2)
--      current_price   numeric(20,8)
--      market_value    numeric(10,2)
--      purchase_price  numeric(20,8)
--      quantity        numeric(20,8)
SELECT column_name, data_type, numeric_precision, numeric_scale
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'investments'
   AND column_name IN ('quantity', 'cost_basis', 'current_price', 'market_value', 'purchase_price')
 ORDER BY column_name;

-- 2. Nothing moved on the security side. Expected: rls_enabled = true and one
--    policy, investments_all_own, for ALL commands.
SELECT
  c.relrowsecurity AS rls_enabled,
  (SELECT string_agg(p.policyname || ' (' || p.cmd || ')', ', ' ORDER BY p.policyname)
     FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'investments') AS policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'investments';

-- 3. Every stored price survived the widening unchanged. Expected: zero rows.
--    Any row here would be a value the conversion altered, which cannot happen
--    when widening — it is listed so that "cannot happen" is checked rather
--    than assumed.
SELECT id, symbol, current_price, purchase_price
  FROM public.investments
 WHERE (current_price IS NOT NULL AND current_price <> round(current_price, 8))
    OR (purchase_price IS NOT NULL AND purchase_price <> round(purchase_price, 8));

-- 4. What is stored, and how much of it was rounded to the penny BEFORE this
--    migration. Expected: `prices_at_whole_pennies` equals `priced_rows` on a
--    database that has only ever had numeric(10,2) — every one of those is a
--    price that may have been up to half a penny out per unit. They correct
--    themselves on the next nightly run of /api/cron/quotes, or the next press
--    of "Update quotes" on the Investments page; nothing here rewrites them,
--    because this migration must not invent prices it did not fetch.
SELECT
  count(*)                                                        AS rows_total,
  count(current_price)                                            AS priced_rows,
  count(*) FILTER (WHERE current_price = round(current_price, 2))  AS prices_at_whole_pennies,
  max(last_updated)                                               AS most_recent_price
  FROM public.investments;
