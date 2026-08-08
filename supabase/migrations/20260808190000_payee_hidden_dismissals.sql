-- ============================================================================
-- PAYEE HIDDEN — the third refusal Payee cleanup can record
-- ============================================================================
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor).
--
-- ORDERING: apply this BEFORE the matching client deploys. It only WIDENS a
-- CHECK constraint, so a database with it applied and the old client running
-- behaves exactly as it does now — but a client that ships first cannot save
-- this refusal AT ALL. Every insert is rejected by the constraint, and the
-- screen has to tell the user their answer was not saved and that the payees
-- they struck off will be back the next time they open the page. That is
-- honest, and it is still the wrong day for them to find out.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
--
-- 20260808120000 gave Payee cleanup two refusals: a whole suggested merchant
-- ("these are not one shop") and one payee kept out of a merchant it otherwise
-- matches. Both are statements about a SUGGESTION, and the owner's complaint is
-- that neither is the statement he wanted to make:
--
--   "I wanted the ability to highlight lines and press 'Rename Selected' OR
--    highlight lines, and basically press a button to 'discard from list' and
--    those ones I selected get a 'flag' never to be picked up by this page
--    again. I only seem to have 'Not the same merchant' and I think that
--    assumes ALL in the list are not the same merchant, whereas I am saying:
--    some could be, some could not, all could be, or none could be."
--
-- So the third kind is about the PAYEE rather than about any grouping drawn
-- around it:
--
--   payee-hidden    this payee text leaves the Payee cleanup screen: out of the
--                   list, out of every suggestion, and out of every count on
--                   the page, until the user restores it.
--
-- One row per payee, because the user picks the payees one by one (ticking a
-- suggestion's members is only a shortcut to a selection) and each has to be
-- restorable on its own. The three kinds are separate rather than one with a
-- scope column for the reason the four before them are: they have three
-- different consequences, and a user who invoked one must never have another
-- applied for them by a later reading of an ambiguous row.
--
-- ── WHAT IS DIFFERENT ABOUT IT ──────────────────────────────────────────────
--
-- Nothing structural — this is the same TEXT-keyed, row-less shape 20260808120000
-- introduced, and every word of that migration's reasoning applies unchanged:
--
--   * subject_key holds payee text, not ids. This kind's key is ONE role-tagged
--     segment, `payee-cleanup:payee:<percent-encoded text>`, with no merchant
--     beside it — because the statement is about the wording alone, whatever
--     grouping a later scan draws around it. The role prefix keeps the restore
--     path's id remapping off it (services/backupService splits subject_key on
--     '|' and rewrites any segment that looks like a row id); the ':' inside
--     the value makes the value impossible to mistake for a uuid, even when the
--     bank's payee text IS uuid-shaped. See src/utils/suggestionDismissals.ts.
--
--   * subject_ids is empty, so the prune trigger on transactions never removes
--     these rows. Correct rather than untidy: delete every transaction carrying
--     the wording, re-import the statement, and the same wording arrives on
--     brand new ids — a refusal that expired with the rows would put the payee
--     the user struck off straight back on the screen.
--
-- Nothing else changes: no new table, no new column, no new policy, no new
-- grant, no new index. These rows are read, written and deleted by exactly the
-- policies 20260806180000 created, and they hold no financial data — a
-- dismissal can only ever hide an offer.
--
-- ── SAFE TO RUN TWICE ───────────────────────────────────────────────────────
-- DROP CONSTRAINT IF EXISTS followed by ADD CONSTRAINT is idempotent: a second
-- run drops the constraint this migration added and adds the identical one
-- back, inside one transaction, so the table is never left unconstrained even
-- for the length of a statement. Applying it to a database that already has it
-- is a no-op in effect, and applying it to one that still has the six-kind
-- version widens that. Nothing here depends on which of those it meets.
-- ============================================================================

BEGIN;

-- Guard: the widening below is only ever valid if every row already stored
-- satisfies the NEW constraint. It must, since the new list is a superset of
-- the old one — but "must" is not "does", and a row written by a future client
-- against a database rolled back to here would fail the validating scan with a
-- message about a constraint rather than about the data. Fail here instead,
-- naming what is actually wrong.
DO $$
DECLARE
  stray_kind text;
BEGIN
  SELECT kind INTO stray_kind
    FROM public.suggestion_dismissals
   WHERE kind NOT IN (
     'transfer-pair', 'transfer-leg', 'stranded', 'duplicate',
     'payee-merchant', 'payee-line', 'payee-hidden'
   )
   LIMIT 1;

  IF stray_kind IS NOT NULL THEN
    RAISE EXCEPTION
      'suggestion_dismissals holds kind "%" which this migration does not admit; widen the list here before applying',
      stray_kind;
  END IF;
END $$;

-- Widening a CHECK: the six existing kinds keep exactly the meaning they had,
-- and every row already stored still satisfies it, so the validating scan
-- cannot fail. DROP + ADD rather than NOT VALID + VALIDATE because the table
-- holds tens of rows, not millions.
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
    'payee-hidden'
  ));

COMMENT ON COLUMN public.suggestion_dismissals.subject_key IS
  'Canonical identity of the refused suggestion: sorted ids joined with "|", prefixed by the finding kind where one scan can produce several kinds of offer about the same rows. The payee-cleanup kinds instead hold role-prefixed, percent-encoded payee text (payee-cleanup:merchant:… / …|payee-cleanup:payee:… / payee-cleanup:payee:… alone for a payee hidden from the screen) so that a restore''s id remapping can never rewrite a payee name. Unique per (user_id, kind).';

COMMIT;

-- ============================================================================
-- VERIFICATION — read this output after applying
-- ============================================================================
-- 1. The constraint now admits all seven kinds and nothing else. Expected: the
--    definition listing the six previous kinds plus payee-hidden.
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

-- 3. What has been refused, by kind. Expected: zero payee-hidden rows
--    immediately after applying; afterwards this is the count of payees the
--    owner has taken off the Payee cleanup screen, each of them still listed
--    and still restorable under "Dismissed suggestions" at the foot of it.
SELECT kind, count(*) AS dismissed
  FROM public.suggestion_dismissals
 GROUP BY kind
 ORDER BY kind;

-- 4. Every payee-cleanup key is still shaped the way the restore path needs:
--    role-tagged segments, so an id remap can never rewrite a payee name.
--    Expected: zero rows. Any row here is a key that a restore into a new login
--    would silently rewrite — the refusal would come back as if never made.
--    A merchant segment, optionally followed by a payee one (the first two
--    kinds), or a payee segment alone (the third). Nothing else is a key this
--    screen wrote.
SELECT id, kind, subject_key
  FROM public.suggestion_dismissals
 WHERE kind IN ('payee-merchant', 'payee-line', 'payee-hidden')
   AND subject_key !~
       '^payee-cleanup:merchant:[^|]*(\|payee-cleanup:payee:[^|]*)?$|^payee-cleanup:payee:[^|]*$';
