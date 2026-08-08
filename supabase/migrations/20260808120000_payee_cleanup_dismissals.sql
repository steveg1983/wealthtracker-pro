-- ============================================================================
-- PAYEE CLEANUP DISMISSALS — two more kinds of "leave it out in future"
-- ============================================================================
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor).
--
-- ORDERING: apply this BEFORE the matching client deploys. It only WIDENS a
-- CHECK constraint, so a database with it applied and the old client running
-- behaves exactly as it does now — but a client that ships first cannot save
-- these refusals at all: the insert is rejected by the constraint and the user
-- is told their answer could not be saved, which is the one outcome this whole
-- feature exists to prevent.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
--
-- Payee cleanup (Settings → Manage) reads every payee text in the register and
-- guesses which of them are one merchant wearing different transaction
-- references — "DIRECT DEBIT — 17 payees · 1,262 transactions". Some of those
-- guesses are wrong for a particular register, and the owner's complaint is
-- that being wrong cost nothing: refusing one meant nothing was recorded, so it
-- was offered again on the next visit, for ever. His words: "if you go through
-- and you do not want them the same for whatever good reason, they will
-- continue to pop up in the suggestions so we need to be able to completely
-- disregard a line or multiple lines."
--
-- So the two refusals join the four already here:
--
--   payee-merchant  a whole suggested merchant: "these are not one shop"
--   payee-line      one payee kept out of a merchant it otherwise matches
--
-- ── WHAT IS DIFFERENT ABOUT THEM ────────────────────────────────────────────
--
-- Every other kind names ROWS. These name TEXT, and that changes two things.
--
-- 1. subject_key holds payee text, not ids. It is namespaced and percent-
--    encoded — `payee-cleanup:merchant:<encoded>` and
--    `payee-cleanup:merchant:<encoded>|payee-cleanup:payee:<encoded>` — for
--    the restore path's benefit: services/backupService rewrites the ids inside
--    a subject_key when a backup is restored into a new login, treating each
--    '|'-separated segment as an id unless it carries a role prefix. Every
--    segment here carries one, and the value behind it always contains a
--    further ':' (which no uuid can), so a payee name can never be mistaken
--    for a row id however the bank spelled it. See
--    src/utils/suggestionDismissals.ts.
--
-- 2. subject_ids is empty, deliberately, and so the prune trigger on
--    transactions never removes these rows. That is correct rather than
--    untidy: the refusal is about wording, and wording outlives rows — delete
--    every transaction that carried it, re-import the statement, and the same
--    payee text arrives on brand new ids. A refusal that expired with the rows
--    would put the suggestion straight back in front of the user who had
--    already said no to it. The rows are bounded by the number of suggestions
--    a person refuses (dozens), each one visible and undoable from "Dismissed
--    suggestions" at the foot of the screen.
--
-- Nothing else changes: no new table, no new column, no new policy, no new
-- grant. These rows are read, written and deleted by exactly the policies
-- 20260806180000 created, and they hold no financial data — a dismissal can
-- only ever hide an offer.
-- ============================================================================

BEGIN;

-- Widening a CHECK: the four existing kinds keep exactly the meaning they had,
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
    'payee-line'
  ));

COMMENT ON TABLE public.suggestion_dismissals IS
  'Suggestions the user has refused for good: transfer pairs, split-line matches, stranded-transfer findings, duplicate candidates, and payee-cleanup groupings the screens must stop offering. Holds no financial data and changes no figure — it can only hide an offer. subject_key is canonical (ids sorted) so a dismissal survives a re-scan that reaches the same rows from the other end; the payee kinds key on TEXT instead, because the suggestion they refuse is about wording rather than rows.';

COMMENT ON COLUMN public.suggestion_dismissals.subject_key IS
  'Canonical identity of the refused suggestion: sorted ids joined with "|", prefixed by the finding kind where one scan can produce several kinds of offer about the same rows. The payee-cleanup kinds instead hold role-prefixed, percent-encoded payee text (payee-cleanup:merchant:… / …|payee-cleanup:payee:…) so that a restore''s id remapping can never rewrite a payee name. Unique per (user_id, kind).';

COMMENT ON COLUMN public.suggestion_dismissals.subject_ids IS
  'The transactions the suggestion was about, in role order. Resolves entirely against public.transactions — a split line id, where one is involved, lives in subject_key instead. Empty for the payee-cleanup kinds, which are about payee text and must outlive the rows that happened to carry it.';

COMMIT;

-- ============================================================================
-- VERIFICATION — read this output after applying
-- ============================================================================
-- 1. The constraint now admits all six kinds and nothing else. Expected: the
--    definition listing the four originals plus payee-merchant and payee-line.
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

-- 3. What has been refused, by kind. Expected: zero payee rows immediately
--    after applying; afterwards this is the count of payee-cleanup suggestions
--    the owner has told the screen to stop offering.
SELECT kind, count(*) AS dismissed
  FROM public.suggestion_dismissals
 GROUP BY kind
 ORDER BY kind;
