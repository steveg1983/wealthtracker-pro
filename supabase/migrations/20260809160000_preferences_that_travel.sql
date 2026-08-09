-- ============================================================================
-- PREFERENCES THAT TRAVEL — the settings a restore used to lose
-- ============================================================================
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor).
--
-- ORDERING: either order is safe, and that is by design rather than by luck.
-- Everything here is NEW — one table, one trigger, four policies — and nothing
-- existing is redefined, so a database with this applied and the OLD client
-- running behaves exactly as it does now. A NEW client meeting a database
-- without it logs one warning per session and falls back to this browser's own
-- copy, which is precisely where every one of these settings lives today. The
-- only thing that does not work until both sides are in place is the thing that
-- does not work at all right now.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
--
-- The owner restored a full backup into a test login to prove the restore
-- worked. The rows all arrived. The app came up factory-reset.
--
-- Right accounts, right transactions, right balances — and every choice he had
-- ever made about how to LOOK at them gone: which accounts the dashboard pins,
-- which reports sit beside them, the period each surface opens on, how the
-- Accounts page is banded and sorted, which register columns he had hidden, the
-- archive cutoffs he had set account by account. None of it was in the backup,
-- because none of it was in the database. It lived in `window.localStorage` on
-- one machine, so it did not back up, did not restore, and did not follow him
-- to a second computer. Nothing anywhere said so.
--
-- A backup is defined by its restore, and a restore that returns the ledger
-- while silently discarding the way the owner reads it has not put him back
-- where he was.
--
-- ── WHY ONE ROW PER USER, NOT ONE ROW PER SETTING ───────────────────────────
--
-- Preferences are read as a SET, exactly once, at boot — before the first paint
-- that depends on any of them. A row per key would turn that one round trip
-- into fifty, on the critical path, to store perhaps two kilobytes. They are
-- also written rarely (a toggle, a drag, a tick) and have to travel WHOLE into
-- a backup file: a per-key table lets a restore land half a user's settings and
-- leave the other half at defaults, which is a worse failure than losing all of
-- them, because it looks deliberate.
--
-- So: one row, one jsonb document, `{ "version": 1, "values": { … } }`, whose
-- values are the exact strings each call site already stored. Schema-in-code
-- (src/services/preferencesService.ts) rather than schema-in-columns, for the
-- property that matters while two client versions are live at once: a key this
-- database's readers have never heard of is carried through untouched instead
-- of being dropped by whichever client saw it last.
--
-- ── WHY THE SIZE IS A CONSTRAINT AND NOT A CONVENTION ───────────────────────
--
-- Everything meant to be here is a toggle, an enum, a short list of account ids
-- or a handful of column names. A jsonb column with no ceiling is an invitation
-- to park a cache in it, and the day something does, this table becomes a
-- second unindexed copy of the ledger that every boot downloads in full. The
-- CHECK below makes "preferences are small" a rule the database enforces rather
-- than a sentence in a comment nobody reads. 256 KiB is roughly a hundred times
-- the realistic maximum, so it can only ever fire on a mistake.
--
-- ── WHAT DOES NOT CHANGE ────────────────────────────────────────────────────
--
--  * No existing table gains, loses or alters a column.
--  * No existing function is redefined — in particular NOT restore_user_chunk.
--    Preferences are restored by an ordinary RLS-scoped upsert from the client,
--    because their restore semantics genuinely differ from every financial
--    table's: one row rather than many, replace rather than insert, and it must
--    run AFTER the financial rows and must never be able to block them. Adding
--    a fifteenth branch to a function whose every other branch is "insert whole
--    rows into an empty login" would have made all three of those differences
--    invisible.
--  * wipe_user_financial_data does NOT touch this table, and neither does the
--    client's own wipe (src/services/import/msMoney/msMoneyImport.wipeCloudData).
--    Deleting your transactions is not a request to forget that you prefer
--    twelve-month charts — and the .mny total migration runs that same wipe, so
--    including preferences would mean re-importing a file factory-reset the UI.
--  * No policy on any other table is touched. The four created here are the
--    same shape every per-user table has used since 20260610130000:
--    requesting_user_id() (SECURITY DEFINER, maps the JWT's clerk_id to
--    users.id), scoped TO authenticated, so anon matches no policy and is
--    denied everything.
--
-- ── SAFE TO RUN TWICE? ──────────────────────────────────────────────────────
-- No, and it says so out loud: guard 2 refuses a second run BY NAME rather than
-- letting CREATE TABLE IF NOT EXISTS quietly leave an older definition in place
-- while the policies below are recreated around it. If you need to change
-- something here, write a new migration for it.
-- ============================================================================

BEGIN;

-- ── Guard 1: this is the database this migration was written against ────────
-- The policies below are written in terms of public.requesting_user_id(), and
-- the FK in terms of public.users(id). Both arrived in 20260610130000. Against
-- a database that predates it, CREATE POLICY would fail with "function does not
-- exist" halfway through the file — true, but it names the symptom rather than
-- the cause. Fail first, naming the migration that has not been applied.
DO $$
BEGIN
  IF to_regprocedure('public.requesting_user_id()') IS NULL THEN
    RAISE EXCEPTION 'wrong_base_missing_requesting_user_id: public.requesting_user_id() does not exist, so this database predates 20260610130000_restore_rls_data_isolation and cannot express owner-only policies.'
      USING ERRCODE = 'P0001',
            HINT = 'Apply the migrations in order with `npm run db:migrate`. Do not apply this file to an older base.';
  END IF;

  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'wrong_base_missing_users_table: public.users does not exist, so user_preferences has nothing to hang off.'
      USING ERRCODE = 'P0001',
            HINT = 'Apply 20251030003814__initial-schema.sql first.';
  END IF;
END;
$$;

-- ── Guard 2: refuse a double-run, by name ───────────────────────────────────
-- A second run must not silently succeed: the table would already exist with
-- whatever definition it has now (possibly amended by a later migration), and
-- everything below it would be recreated around that older shape as if it were
-- this file's own.
DO $$
BEGIN
  IF to_regclass('public.user_preferences') IS NOT NULL THEN
    RAISE EXCEPTION 'user_preferences_already_exists: public.user_preferences is already present — this migration has already been applied and must not run twice.'
      USING ERRCODE = 'P0001',
            HINT = 'The verification queries at the foot of this file show the current state. If something needs changing, write a new migration for it.';
  END IF;
END;
$$;

-- ── Guard 3: the trigger function this table reuses is the one expected ─────
-- update_updated_at_column() is shared by every table with an updated_at, and
-- it is attached below by name. If it is absent, the trigger creation fails
-- with a message about a function; if it were ever replaced by something that
-- does NOT set updated_at, this table would silently stop stamping and nobody
-- would notice until two devices disagreed about whose preferences were newer.
-- Check that it exists AND that it still mentions the column it is named for.
DO $$
DECLARE
  v_body text;
BEGIN
  IF to_regprocedure('public.update_updated_at_column()') IS NULL THEN
    RAISE EXCEPTION 'wrong_base_missing_update_updated_at_column: public.update_updated_at_column() does not exist, so user_preferences.updated_at would never be stamped.'
      USING ERRCODE = 'P0001',
            HINT = 'It is created by 20251030003814__initial-schema.sql and reasserted by 20260807083000_user_data_restore.sql.';
  END IF;

  SELECT pg_get_functiondef(to_regprocedure('public.update_updated_at_column()')) INTO v_body;
  IF v_body !~* 'updated_at' THEN
    RAISE EXCEPTION 'update_updated_at_column_not_recognised: the shared trigger function no longer mentions updated_at, so attaching it here would produce rows whose timestamp never moves.'
      USING ERRCODE = 'P0001',
            HINT = 'Read its current definition before continuing: SELECT pg_get_functiondef(to_regprocedure(''public.update_updated_at_column()''));';
  END IF;
END;
$$;

-- ── The table ───────────────────────────────────────────────────────────────

CREATE TABLE public.user_preferences (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- The whole document. NOT NULL with a default so a row can be created before
  -- there is anything to put in it, and so no reader ever has to tell "no
  -- preferences" apart from "preferences unknown".
  prefs      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- One row per user, and the conflict target every write upserts on. Without
  -- it two tabs racing at boot would each insert a row and the app would then
  -- read whichever one PostgREST happened to return.
  CONSTRAINT user_preferences_one_row_per_user UNIQUE (user_id),

  -- A document, not a list. jsonb_typeof rather than a shape check: the shape
  -- is versioned in the client (see preferencesService.PreferencesDocument) and
  -- must be free to gain keys without a migration. What must NOT vary is that
  -- it is an object, because every reader indexes into it.
  CONSTRAINT user_preferences_prefs_is_object
    CHECK (jsonb_typeof(prefs) = 'object'),

  -- See "WHY THE SIZE IS A CONSTRAINT" above. The cast jsonb -> text is
  -- IMMUTABLE, which is what makes this legal in a CHECK.
  CONSTRAINT user_preferences_prefs_is_small
    CHECK (length(prefs::text) <= 262144)
);

-- No further index: the unique constraint's own index has user_id as its
-- leading (and only) column, which is the one lookup this table ever does.

COMMENT ON TABLE public.user_preferences IS
  'One row per user holding every setting that belongs to the ACCOUNT rather than to the browser: pinned accounts and reports, per-surface periods, grouping and sort choices, hidden register columns, archive cutoffs, theme and currency. Holds no financial data and changes no figure. Deliberately excluded from wipe_user_financial_data and from the client wipe: erasing your transactions is not a request to forget how you like to read them.';

COMMENT ON COLUMN public.user_preferences.prefs IS
  'Versioned document: {"version": 1, "values": {"<preference key>": "<the exact string the client stored>"}}. Values are strings because every call site already serialises to one, which means a key this database''s readers have never heard of survives a round trip through an older client untouched instead of being dropped. Schema lives in src/services/preferencesService.ts.';

-- updated_at is the only way two devices can be compared, so it is stamped by
-- the shared trigger rather than by whichever client remembered to send it.
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── RLS: the owner, and nobody else ─────────────────────────────────────────
-- All four commands, unlike suggestion_dismissals: a preferences row is created
-- once and then UPDATEd for the rest of its life, and DELETE exists so that
-- "start my settings again" is expressible without a service key.
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_preferences_select_own ON public.user_preferences;
CREATE POLICY user_preferences_select_own ON public.user_preferences
  FOR SELECT TO authenticated
  USING (user_id = public.requesting_user_id());

DROP POLICY IF EXISTS user_preferences_insert_own ON public.user_preferences;
CREATE POLICY user_preferences_insert_own ON public.user_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.requesting_user_id());

DROP POLICY IF EXISTS user_preferences_update_own ON public.user_preferences;
CREATE POLICY user_preferences_update_own ON public.user_preferences
  FOR UPDATE TO authenticated
  USING (user_id = public.requesting_user_id())
  WITH CHECK (user_id = public.requesting_user_id());

DROP POLICY IF EXISTS user_preferences_delete_own ON public.user_preferences;
CREATE POLICY user_preferences_delete_own ON public.user_preferences
  FOR DELETE TO authenticated
  USING (user_id = public.requesting_user_id());

-- ── Grants ──────────────────────────────────────────────────────────────────
-- FROM PUBLIC, anon — naming anon explicitly, because REVOKE ... FROM PUBLIC
-- alone does NOT remove Supabase's named default grant to anon (the trap
-- documented at length in 20260725120000). RLS already denies anon every row;
-- this removes the privilege as well, so both layers say no.
REVOKE ALL ON TABLE public.user_preferences FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_preferences TO authenticated;
GRANT ALL ON TABLE public.user_preferences TO service_role;

COMMIT;

-- ============================================================================
-- VERIFICATION — read this output after applying
-- ============================================================================
-- 1. The table exists with RLS on and every one of the four commands covered.
--    Expected: one row, rls_enabled = true, commands = 'DELETE, INSERT, SELECT,
--    UPDATE'.
SELECT
  c.relname,
  c.relrowsecurity AS rls_enabled,
  (SELECT string_agg(p.cmd, ', ' ORDER BY p.cmd) FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'user_preferences') AS commands
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'user_preferences';

-- 2. Every policy scopes to the owner and to `authenticated` alone. Expected:
--    four rows, roles = {authenticated}, and requesting_user_id() named in
--    every qualifier. A policy reading USING (true) here is the June 2026
--    isolation failure returning; there must be none.
SELECT policyname, cmd, roles::text, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'user_preferences'
 ORDER BY cmd, policyname;

-- 3. Privileges. Expected: exactly `authenticated` and `service_role`; neither
--    PUBLIC nor anon.
SELECT
  'public.user_preferences' AS relation,
  string_agg(DISTINCT grantee::text, ', ' ORDER BY grantee::text) AS granted_to
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'user_preferences';

-- 4. The constraints that keep this table what it says it is. Expected: three
--    rows — the one-row-per-user unique key, the object check and the size
--    check.
SELECT conname, pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
 WHERE conrelid = 'public.user_preferences'::regclass
   AND conname LIKE 'user_preferences_%'
 ORDER BY conname;

-- 5. Nothing has been written yet. Expected: zero rows immediately after
--    applying. Afterwards this is one row per user who has opened the app since,
--    and `settings` is how many preferences that user has expressed — the number
--    a restore would have put back and, until today, did not.
SELECT
  u.email,
  jsonb_array_length(COALESCE(jsonb_path_query_array(p.prefs, '$.values.keyvalue()'), '[]'::jsonb)) AS settings,
  length(p.prefs::text) AS document_bytes,
  p.updated_at
FROM public.user_preferences p
JOIN public.users u ON u.id = p.user_id
ORDER BY p.updated_at DESC;

-- 6. The wipe still leaves preferences alone. Expected: zero rows — the text of
--    wipe_user_financial_data must not mention this table. If this ever returns
--    a row, "Delete all data" has quietly become "and forget how I read it".
SELECT p.proname
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname = 'wipe_user_financial_data'
   AND pg_get_functiondef(p.oid) ILIKE '%user_preferences%';
