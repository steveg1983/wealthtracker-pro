-- ============================================================================
-- SUGGESTION DISMISSALS — "leave it" that stays left
-- ============================================================================
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor). Safe to apply before the matching client
-- deploys: everything here is NEW (one table, one trigger function, one
-- trigger), nothing existing is redefined, and no column of any existing table
-- changes. A database with this applied and the old client running behaves
-- exactly as it does now.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
--
-- The transfer sweep offers the user a decision on every row it cannot settle
-- by itself, and "leave it" was a decision for that sitting only: the finding
-- dropped out of the list, nothing was written, and the next time the sweep ran
-- it offered the same pairing again. On a 16,000-row history that is not a
-- small annoyance — it is the difference between a list that shrinks as you
-- work and a list that never does. The user's words: "the same list that you
-- said you wanted to leave come back up again and again."
--
-- So a refusal can now be RECORDED. This table is that record, and nothing
-- else: it holds no money, no category and no link, and changes no figure
-- anywhere. It only says "do not offer me this again".
--
-- ── THE KEY, AND WHY IT IS SHAPED LIKE THIS ────────────────────────────────
--
-- A dismissal has to survive a re-scan, and a re-scan is free to reach the same
-- two rows from either end. So subject_key is CANONICAL: the ids the suggestion
-- is made of, sorted, joined with '|'. Whichever row the scan happens to call
-- "this one" and whichever it calls "the other one", the key is the same string
-- — which is exactly the property the old session-local key did not have and
-- the reason a dismissal has to be keyed by content rather than by position.
--
-- kind is part of the identity, not decoration:
--
--   transfer-pair  two whole rows the sweep would link       sorted(id, id)
--   transfer-leg   one LINE of a split and the row opposite  split:<id>|txn:<id>
--   stranded       a row whose other side is taken/filed/    <finding>|sorted(ids…)
--                  missing, plus the rows that make the case
--   duplicate      two rows in ONE account that look like    sorted(id, id)
--                  the same movement recorded twice
--
-- The unique constraint carries kind, so two kinds can never collide even when
-- they name the same rows — and they legitimately can: the same two rows are a
-- transfer pair to one scan and a duplicate to another, and refusing one offer
-- must not silently suppress the other, whose consequence is completely
-- different (linking two rows changes their filing; deleting one destroys it).
--
-- transfer-leg is the one key that is NOT sorted, because its two halves are
-- not interchangeable: one is a transaction_splits id and the other a
-- transactions id. The role tags fix the order instead. (A split line's id
-- changes when the whole line set is rewritten — see set_transaction_splits'
-- replace-all semantics — so re-editing a split legitimately produces a NEW
-- offer with a new key. That is correct: the line the user refused no longer
-- exists.)
--
-- ── WHAT IF ONE OF THE ROWS IS LATER EDITED, OR DELETED? ───────────────────
--
-- EDITED: the ids do not change, so the dismissal still matches. That is the
-- intended behaviour for a re-date or a re-word. An edit that changes the
-- AMOUNT usually stops the scan proposing the pair at all, so the dismissal
-- simply never comes up; if the edit brings the pair back the user is refusing
-- an offer they already refused, and the sweep goes on hiding it. Nothing here
-- can go wrong, because a dismissal can only ever HIDE an offer — it can never
-- cause a write.
--
-- DELETED: the offer can never recur (both halves must exist for the scan to
-- make it), so the row is inert dead weight. Inert is not good enough for a
-- table that lives forever, so the trigger below cleans it up at the source:
-- when a transaction is deleted, every dismissal that named it goes with it.
-- The duplicate finder makes that path routine — its whole purpose is to delete
-- one of the two rows a dismissal would be about.
--
-- ── NOT AUDITED, DELIBERATELY ──────────────────────────────────────────────
--
-- financial_audit_log answers "what happened to this money, and who did it".
-- A dismissal touches no money: no amount, no sign, no account, no category,
-- no link. Writing it into the financial audit trail would dilute the artifact
-- that compliance actually depends on. dismissed_at records when, and the row
-- is scoped to one user by RLS, which is the whole of what needs recording.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.suggestion_dismissals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind         text NOT NULL,
  -- Canonical identity of the refused suggestion — see the header.
  subject_key  text NOT NULL,
  -- The TRANSACTIONS the suggestion was about, in role order (the row the user
  -- was looking at first). Used to describe a dismissal back to the user in the
  -- "Dismissed" list, and by the prune trigger below. Deliberately transactions
  -- only: a transfer-leg's split line id lives in subject_key, so every id in
  -- this column can be resolved in exactly one table.
  subject_ids  uuid[] NOT NULL DEFAULT '{}',
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT suggestion_dismissals_kind_known
    CHECK (kind IN ('transfer-pair', 'transfer-leg', 'stranded', 'duplicate')),
  CONSTRAINT suggestion_dismissals_subject_key_not_blank
    CHECK (btrim(subject_key) <> ''),
  CONSTRAINT suggestion_dismissals_unique_subject
    UNIQUE (user_id, kind, subject_key)
);

-- The unique constraint's index already serves the per-user read (its leading
-- column is user_id), so the only index needed here is the containment lookup
-- the prune trigger does on every transaction delete.
CREATE INDEX IF NOT EXISTS idx_suggestion_dismissals_subject_ids
  ON public.suggestion_dismissals USING GIN (subject_ids);

COMMENT ON TABLE public.suggestion_dismissals IS
  'Suggestions the user has refused for good: transfer pairs, split-line matches, stranded-transfer findings and duplicate candidates the sweeps must stop offering. Holds no financial data and changes no figure — it can only hide an offer. subject_key is canonical (ids sorted) so a dismissal survives a re-scan that reaches the same rows from the other end.';

COMMENT ON COLUMN public.suggestion_dismissals.subject_key IS
  'Canonical identity of the refused suggestion: sorted ids joined with "|", prefixed by the finding kind where one scan can produce several kinds of offer about the same rows. Unique per (user_id, kind).';

COMMENT ON COLUMN public.suggestion_dismissals.subject_ids IS
  'The transactions the suggestion was about, in role order. Resolves entirely against public.transactions — a split line id, where one is involved, lives in subject_key instead.';

-- ── RLS: the owner, and nobody else ─────────────────────────────────────────
-- The shape every per-user table uses: requesting_user_id() (SECURITY DEFINER,
-- maps the JWT's clerk_id to users.id), scoped TO authenticated. anon matches
-- no policy and is therefore denied everything.
--
-- No UPDATE policy, because a dismissal is never edited: it is created when the
-- user refuses, and deleted when they change their mind. A re-refusal of
-- something already refused is a no-op (ON CONFLICT DO NOTHING client-side),
-- which keeps dismissed_at meaning "when you first said no".
ALTER TABLE public.suggestion_dismissals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS suggestion_dismissals_select_own ON public.suggestion_dismissals;
CREATE POLICY suggestion_dismissals_select_own ON public.suggestion_dismissals
  FOR SELECT TO authenticated
  USING (user_id = public.requesting_user_id());

DROP POLICY IF EXISTS suggestion_dismissals_insert_own ON public.suggestion_dismissals;
CREATE POLICY suggestion_dismissals_insert_own ON public.suggestion_dismissals
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.requesting_user_id());

DROP POLICY IF EXISTS suggestion_dismissals_delete_own ON public.suggestion_dismissals;
CREATE POLICY suggestion_dismissals_delete_own ON public.suggestion_dismissals
  FOR DELETE TO authenticated
  USING (user_id = public.requesting_user_id());

-- ── Prune: a deleted transaction takes its dismissals with it ───────────────
--
-- SECURITY INVOKER (the default) on purpose. Under an end-user session RLS
-- applies and the delete policy above matches — the user's own dismissals, the
-- only ones that can name their own transaction. Under service_role RLS is
-- bypassed and it matches too. In any hypothetical third context RLS simply
-- matches nothing, the DELETE affects zero rows, and the dismissal stays behind
-- as the inert row it already was: this trigger is a tidy-up, and a tidy-up
-- must never be able to fail a financial delete.
CREATE OR REPLACE FUNCTION public.prune_suggestion_dismissals_for_transaction()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.suggestion_dismissals
   WHERE user_id = OLD.user_id
     AND subject_ids @> ARRAY[OLD.id];
  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.prune_suggestion_dismissals_for_transaction() IS
  'AFTER DELETE on transactions: removes every suggestion_dismissals row that named the deleted transaction. Those suggestions can never be offered again (both halves must exist for a scan to make one), so the dismissal is dead weight. Never raises — a tidy-up must not be able to fail a delete.';

DROP TRIGGER IF EXISTS trg_prune_suggestion_dismissals ON public.transactions;
CREATE TRIGGER trg_prune_suggestion_dismissals
  AFTER DELETE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.prune_suggestion_dismissals_for_transaction();

-- ── Grants ──────────────────────────────────────────────────────────────────
-- FROM PUBLIC, anon — naming anon explicitly, because REVOKE ... FROM PUBLIC
-- alone does NOT remove Supabase's named default grant to anon (the trap
-- documented at length in 20260725120000). RLS already denies anon every row;
-- this removes the privilege as well, so both layers say no. Re-running these
-- is a no-op.
REVOKE ALL ON TABLE public.suggestion_dismissals FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON TABLE public.suggestion_dismissals TO authenticated;
GRANT ALL ON TABLE public.suggestion_dismissals TO service_role;

COMMIT;

-- ============================================================================
-- VERIFICATION — read this output after applying
-- ============================================================================
-- 1. Privileges. Expected: exactly one row, showing `authenticated` and
--    `service_role`, and neither PUBLIC nor anon.
SELECT
  'public.suggestion_dismissals' AS relation,
  string_agg(DISTINCT grantee::text, ', ' ORDER BY grantee::text) AS granted_to
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'suggestion_dismissals'
  AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role');

-- 2. RLS. Expected: rls_enabled = true, and exactly three policies —
--    select/insert/delete, all TO authenticated. No UPDATE policy: a dismissal
--    is created or removed, never edited.
SELECT
  c.relrowsecurity AS rls_enabled,
  (SELECT count(*) FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'suggestion_dismissals') AS policy_count,
  (SELECT string_agg(p.cmd, ', ' ORDER BY p.cmd) FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'suggestion_dismissals') AS commands
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'suggestion_dismissals';

-- 3. The prune trigger is attached to transactions. Expected: one row,
--    trg_prune_suggestion_dismissals, AFTER DELETE, enabled ('O' = origin).
SELECT t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'transactions'
  AND t.tgname = 'trg_prune_suggestion_dismissals';

-- 4. Nothing is dismissed yet. Expected: 0 on a fresh apply; after the client
--    ships this is the count of suggestions the owner has told the sweeps to
--    stop offering, and it should only ever go up as work is done.
SELECT kind, count(*) AS dismissed
  FROM public.suggestion_dismissals
 GROUP BY kind
 ORDER BY kind;
