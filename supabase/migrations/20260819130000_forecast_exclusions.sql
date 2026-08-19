-- ============================================================================
-- FORECAST EXCLUSIONS — "this one-off is not part of my typical month"
-- ============================================================================
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor).
--
-- ORDERING: apply BEFORE the matching client deploys — the same rule as
-- 20260817220000, for the same reason. It only WIDENS a CHECK constraint, so
-- the database with this applied and the old client running behaves exactly
-- as now — but a client that ships first cannot save an exclusion at all, and
-- the forecast base table has to tell the user their judgment was not kept.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
--
-- The forecast is a SCENARIO TOOL (owner's ruling, 17 Aug —
-- docs/forecast-direction.md): it never writes to Budget on its own, and it
-- stands on an inspectable base — the last twelve months of category actuals.
-- A base that includes the one-off (the insurance payout, the roof, the car)
-- projects a typical month that never happens. So the user may EXCLUDE a
-- transaction from the base, and the exclusions are STATED on screen — never
-- a silent subtraction.
--
--   forecast-excluded    "not part of my typical month" — the row still sits
--                        in its register untouched; only the forecast base
--                        stops counting it, and says so.
--
-- The table doctrine holds: a row here holds no financial data and changes no
-- figure in any register. An exclusion can only narrow what a DERIVED surface
-- reads.
--
-- ── THE KEY SHAPE ───────────────────────────────────────────────────────────
--
--   <transaction uuid>
--
-- A bare row id, deliberately — unlike the recurring kinds, this verdict is
-- about ONE ROW, not a pattern that outlives its rows. remapBackupIds treats
-- a bare uuid-shaped segment as an id and rewrites it on restore, so the
-- exclusion follows its transaction into a new login. subject_ids carries the
-- same id, so deleting the transaction cascades the exclusion away with it —
-- an exclusion of a row that no longer exists excludes nothing and must not
-- linger as a phantom judgment.
--
-- ── SAFE TO RUN TWICE ───────────────────────────────────────────────────────
-- DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT inside one transaction, exactly
-- as 20260817220000: idempotent, and the table is never left unconstrained.
-- ============================================================================

BEGIN;

-- Guard: widening is only valid if every stored row already satisfies the
-- NEW constraint — which it must, the new list being a superset. "Must" is
-- not "does": fail here naming the stray, not in the validating scan.
DO $$
DECLARE
  stray_kind text;
BEGIN
  SELECT kind INTO stray_kind
    FROM public.suggestion_dismissals
   WHERE kind NOT IN (
     'transfer-pair', 'transfer-leg', 'stranded', 'duplicate',
     'payee-merchant', 'payee-line', 'payee-hidden',
     'recurring-confirmed', 'recurring-not', 'forecast-excluded'
   )
   LIMIT 1;

  IF stray_kind IS NOT NULL THEN
    RAISE EXCEPTION
      'suggestion_dismissals holds kind "%" which this migration does not admit; widen the list here before applying',
      stray_kind;
  END IF;
END $$;

ALTER TABLE public.suggestion_dismissals
  DROP CONSTRAINT IF EXISTS suggestion_dismissals_kind_known;

ALTER TABLE public.suggestion_dismissals
  ADD CONSTRAINT suggestion_dismissals_kind_known
  CHECK (kind IN (
    'transfer-pair',
    'transfer-leg',
    'stranded',
    'duplicate',
    'payee-merchant',
    'payee-line',
    'payee-hidden',
    'recurring-confirmed',
    'recurring-not',
    'forecast-excluded'
  ));

COMMENT ON TABLE public.suggestion_dismissals IS
  'The user''s recorded verdicts on the app''s suggestions. Introduced as refusals ("stop offering me this"); recurring-confirmed (20260817220000) was the first positive verdict; forecast-excluded (20260819130000) is a judgment about one row — "not part of my typical month" — that narrows what the forecast base reads. Every kind holds no financial data and changes no figure.';

COMMENT ON COLUMN public.suggestion_dismissals.subject_key IS
  'Canonical identity of the suggestion answered: sorted ids joined with "|", prefixed by the finding kind where one scan can produce several kinds of offer about the same rows. The payee-cleanup kinds hold role-prefixed, percent-encoded payee text; the recurring kinds hold account:<id>|recurring:<direction>:<percent-encoded payee key>; forecast-excluded holds a bare transaction uuid, which the restore path remaps like any other id. Unique per (user_id, kind).';

COMMIT;

-- ============================================================================
-- VERIFICATION — read this output after applying
-- ============================================================================
-- 1. The constraint now admits all ten kinds and nothing else.
SELECT pg_get_constraintdef(oid) AS kind_check
  FROM pg_constraint
 WHERE conrelid = 'public.suggestion_dismissals'::regclass
   AND conname = 'suggestion_dismissals_kind_known';

-- 2. Nothing else moved. Expected: rls_enabled = true and the same three
--    policies (SELECT, INSERT, DELETE) this table has always had.
SELECT
  c.relrowsecurity AS rls_enabled,
  (SELECT string_agg(p.cmd, ', ' ORDER BY p.cmd) FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'suggestion_dismissals') AS commands
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'suggestion_dismissals';

-- 3. Verdicts by kind. Expected: zero forecast-excluded rows immediately
--    after applying; afterwards, the count of one-offs the owner has struck
--    from the base on the Forecast page.
SELECT kind, count(*) AS verdicts
  FROM public.suggestion_dismissals
 GROUP BY kind
 ORDER BY kind;
