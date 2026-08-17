-- ============================================================================
-- RECURRING ANSWERS — Confirm and Not-recurring on detected patterns
-- ============================================================================
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor).
--
-- ORDERING: apply this BEFORE the matching client deploys — the same rule as
-- 20260808190000, for the same reason. It only WIDENS a CHECK constraint, so a
-- database with it applied and the old client running behaves exactly as it
-- does now — but a client that ships first cannot save either answer AT ALL,
-- and the "What I'm committed to" report has to tell the user their Confirm
-- was not kept.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
--
-- The recurring-detection report (Claude Design handover, 17 Aug §5) asks the
-- user two quiet questions about every pattern the app has noticed: is this a
-- real commitment (Confirm), or a coincidence (Not recurring)? The answers are
-- load-bearing rather than cosmetic: ONLY a confirmed detection may ever feed
-- the forward calendar or the forecast — an unconfirmed detection is the app's
-- opinion, and a forecast that inherits unreviewed opinions can no longer be
-- interrogated.
--
--   recurring-confirmed   "yes, a real commitment" — the gate that lets the
--                         pattern feed derived surfaces.
--   recurring-not         "a coincidence" — the pattern moves to a collapsed,
--                         recoverable band on the report. Never a deletion.
--
-- ── A WORD ON DOCTRINE ──────────────────────────────────────────────────────
--
-- This table was introduced as refusals — "a dismissal can only hide an
-- offer". `recurring-confirmed` is not a refusal; it is the first POSITIVE
-- answer stored here, and the table's honest description is now "the user's
-- recorded verdicts on the app's suggestions". The invariant that mattered is
-- unchanged and still holds for both new kinds: a row here holds no financial
-- data and changes no figure. Confirming can only ALLOW a derived surface to
-- read what the register already says; it writes nothing into the register.
--
-- ── THE KEY SHAPE ───────────────────────────────────────────────────────────
--
--   account:<uuid>|recurring:<direction>:<percent-encoded payee key>
--
-- The account segment is a ROLE-PREFIXED row id: remapDismissalKey
-- (services/backup/format) rewrites the value behind a single role prefix in
-- place, so a restore into a new login re-points the answer at the restored
-- account — and the detection, re-derived from the restored rows, computes
-- the same key and finds its answer waiting. The pattern segment follows the
-- payee-cleanup convention: the value behind `recurring:` always contains a
-- further ':', so no remapper can mistake the payee text for an id.
--
-- subject_ids is EMPTY, exactly as the payee kinds argue: a pattern outlives
-- its rows. Delete a year of statements and re-import them, and the same
-- payments arrive on brand-new ids — an answer that expired with the rows
-- would put the question straight back in front of a user who had already
-- given it.
--
-- ── SAFE TO RUN TWICE ───────────────────────────────────────────────────────
-- DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT inside one transaction, exactly
-- as 20260808190000: idempotent, and the table is never left unconstrained.
-- ============================================================================

BEGIN;

-- Guard: the widening below is only valid if every stored row already
-- satisfies the NEW constraint — which it must, the new list being a superset.
-- "Must" is not "does": fail here naming the stray, not in the validating scan.
DO $$
DECLARE
  stray_kind text;
BEGIN
  SELECT kind INTO stray_kind
    FROM public.suggestion_dismissals
   WHERE kind NOT IN (
     'transfer-pair', 'transfer-leg', 'stranded', 'duplicate',
     'payee-merchant', 'payee-line', 'payee-hidden',
     'recurring-confirmed', 'recurring-not'
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
    'recurring-not'
  ));

COMMENT ON TABLE public.suggestion_dismissals IS
  'The user''s recorded verdicts on the app''s suggestions. Introduced as refusals ("stop offering me this"); recurring-confirmed (20260817220000) is the first positive verdict — the statement that lets a detected recurring pattern feed the calendar and the forecast. Every kind holds no financial data and changes no figure.';

COMMENT ON COLUMN public.suggestion_dismissals.subject_key IS
  'Canonical identity of the suggestion answered: sorted ids joined with "|", prefixed by the finding kind where one scan can produce several kinds of offer about the same rows. The payee-cleanup kinds hold role-prefixed, percent-encoded payee text; the recurring kinds hold account:<id>|recurring:<direction>:<percent-encoded payee key> — the account segment remaps on restore, the payee text never can. Unique per (user_id, kind).';

COMMIT;

-- ============================================================================
-- VERIFICATION — read this output after applying
-- ============================================================================
-- 1. The constraint now admits all nine kinds and nothing else.
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

-- 3. Verdicts by kind. Expected: zero recurring rows immediately after
--    applying; afterwards, the count of patterns the owner has confirmed or
--    struck off on "What I'm committed to".
SELECT kind, count(*) AS verdicts
  FROM public.suggestion_dismissals
 GROUP BY kind
 ORDER BY kind;

-- 4. Every recurring key is shaped the way the restore path needs: one
--    role-prefixed account segment, one role-prefixed pattern segment.
--    Expected: zero rows. Any row here would survive a restore with its
--    account un-remapped — an answer silently orphaned from its pattern.
SELECT id, kind, subject_key
  FROM public.suggestion_dismissals
 WHERE kind IN ('recurring-confirmed', 'recurring-not')
   AND subject_key !~ '^account:[^|:]+\|recurring:(in|out):[^|]*$';
