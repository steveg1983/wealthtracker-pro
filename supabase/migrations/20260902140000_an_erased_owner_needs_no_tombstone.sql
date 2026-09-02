-- ============================================================================
-- 20260902140000_an_erased_owner_needs_no_tombstone.sql
--
-- ERASURE FAILS FOR ANYONE HOLDING A BANK-FED TRANSACTION — the tombstone
-- trigger stands aside when the owner has already gone.
--
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor).
--
-- ── THE FAILURE ─────────────────────────────────────────────────────────────
--
-- `DELETE FROM public.users WHERE id = …` — step 3 of api/account/delete.ts,
-- the GDPR Art. 17 route — cannot complete for a user who holds a fed
-- transaction. Measured on scripts/local-db's cluster, 2 Sep 2026:
--
--   ERROR:  insert or update on table "deleted_feed_transactions" violates
--           foreign key constraint "deleted_feed_transactions_user_id_fkey"
--   DETAIL: Key (user_id)=(…) is not present in table "users".
--   CONTEXT: PL/pgSQL function remember_deleted_feed_transaction() line 5
--            SQL statement "DELETE FROM ONLY "public"."transactions" …"
--
-- The whole chain is inside that one statement. The users row goes; the
-- cascade reaches transactions; the BEFORE DELETE trigger
-- transactions_remember_deletion (20260828140000) writes a tombstone for every
-- row that came from a feed; and deleted_feed_transactions.user_id REFERENCES
-- users(id), whose parent has just been removed. The erasure aborts, the API
-- returns `deletion_failed` to the person who asked to be forgotten, and
-- captureServerError raises it as a GDPR erasure failure — correctly, because
-- it is one.
--
-- PRE-EXISTING, and not the deferred audit triggers of 20260902120000: measured
-- again with all three of those disabled and the failure is identical. It is
-- named in that migration's header and at the top of
-- scripts/local-db/audit-trigger.test.sql, whose section (h) orders itself
-- around it ("no external ids on these rows"). Verification 3 at the foot of
-- this file counts the live accounts it currently blocks.
--
-- ── THE DECISION: MIRROR THE RULE THE AUDIT TRIGGER ALREADY KEEPS ───────────
--
-- Skip the tombstone when the owner no longer exists.
--
-- A tombstone is not a record for its own sake. 20260828140000 says what it is
-- for, exactly: "sync-transactions asks the database one question — which of
-- these external ids do I already have? … A row the owner deleted is not in
-- `transactions`, so its id is unknown, so it is new, so it is inserted." The
-- tombstone is the memory that stops the next sync undoing a deliberate
-- deletion.
--
-- An erased owner has no next sync. bank_connections hangs off users with
-- ON DELETE CASCADE — api/account/delete.ts revokes the consents first for
-- exactly that reason — so by the time these DELETE events fire there are no
-- connections left, no tokens, no feed, and nothing that could ever re-import
-- the row. A tombstone written here is one nobody will ever consult: keyed
-- (user_id, connection_id, external_transaction_id) on a user_id that no
-- longer names anybody, and destined to be deleted by the very cascade that
-- is trying to write it.
--
-- 20260902120000 reached the same conclusion about the same moment, and the
-- wording is deliberately kept: "Skipping is the only correct answer, and it
-- is not merely defensive… Nor is there anything to write."
--
-- ── WHAT WAS REJECTED ───────────────────────────────────────────────────────
--
-- * WEAKENING THE FOREIGN KEY. `user_id … REFERENCES users(id) ON DELETE
--   CASCADE` is what carries a departing person's tombstones away with them,
--   and that is right: a tombstone names one of their accounts and one of
--   their bank's transaction ids, so it is their data and an erasure must take
--   it. Making the column nullable, or dropping the reference, would leave
--   rows about somebody after they asked to be forgotten — trading a failed
--   erasure for a silently incomplete one, which is worse. The cascade stays,
--   and is measured in proof (e) of scripts/local-db/erasure.test.sql.
--
-- * REORDERING api/account/delete.ts to delete transactions before the users
--   row. It would write a full set of tombstones the erasure must then delete
--   anyway, and it would fix one caller. Every other route to the same
--   statement — a support fix in psql, a future admin script, a migration's
--   own cleanup — would still carry the bomb. 20260828140000's argument for
--   putting the rule in a trigger applies unchanged to its exception:
--   "stamping the tombstone in application code means every future path must
--   remember; stamping it here means none of them can forget." The exception
--   belongs where the rule is.
--
-- ── COST ────────────────────────────────────────────────────────────────────
--
-- One primary-key probe on users, paid only by a row that HAS an external id —
-- the check sits inside the fed-row branch, so it runs only where a tombstone
-- was about to be written. Deleting hand-entered transactions costs exactly
-- what it cost before.
--
-- ── BLAST RADIUS ────────────────────────────────────────────────────────────
--
-- * A live user deleting a fed transaction still gets a tombstone, with the
--   same connection id, external id and account id as before. Proof (a).
-- * A hand-entered transaction still gets none. Proof (a).
-- * An erasure completes, under the departing user's own JWT and under the
--   service role the API uses. Proofs (b) and (c).
-- * Tombstones that already existed still cascade away with their owner.
--   Proof (e).
-- * No amount, sign, date, account or balance is read or written anywhere
--   below. The ledger invariant `balance = initial_balance + Σ(amount)` cannot
--   be moved by this migration.
-- * The trigger, the table, the unique index and the ON CONFLICT DO NOTHING
--   are untouched. Only the function body changes, and only by one guard.
--
-- ── ON RE-RUNNING THIS FILE ─────────────────────────────────────────────────
--
-- Idempotent by construction: CREATE OR REPLACE, no DDL. The guard that
-- refuses is about the BASE, not about having run before — it fingerprints two
-- lines this new body KEEPS, so it is satisfied equally before and after, and
-- what it refuses is a body that never had them.
-- ============================================================================

BEGIN;

-- ── Guards: refuse anything but the state this body was derived from ────────
DO $$
DECLARE
  v_oid oid;
  v_src text;
BEGIN
  -- Guard 1: the table the body inserts into.
  IF to_regclass('public.deleted_feed_transactions') IS NULL THEN
    RAISE EXCEPTION 'tombstone_table_missing: public.deleted_feed_transactions does not exist — apply 20260828140000_a_deletion_is_a_decision.sql first'
      USING ERRCODE = 'P0002';
  END IF;

  -- Guard 2: the function is there at all.
  v_oid := to_regprocedure('public.remember_deleted_feed_transaction()');
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'tombstone_trigger_missing: expected remember_deleted_feed_transaction() to exist before changing what it writes — apply 20260828140000_a_deletion_is_a_decision.sql first'
      USING ERRCODE = 'P0002';
  END IF;
  v_src := pg_get_functiondef(v_oid);

  -- Guard 3: THE RIGHT BASE. The body below is 20260828140000's body plus one
  -- guard, so the live function must carry that file's two decisions: only a
  -- row that CAME FROM A FEED is remembered (the length(trim(…)) test), and
  -- the same decision stated twice is not an error (ON CONFLICT DO NOTHING).
  -- Replacing an older body wholesale is the wrong-base rebase that has
  -- already eaten a line twice in this history (20260808150000, 20260808180000
  -- each document one).
  IF position('length(trim(OLD.external_transaction_id))' IN v_src) = 0
     OR position('ON CONFLICT DO NOTHING' IN v_src) = 0 THEN
    RAISE EXCEPTION 'tombstone_trigger_wrong_base: remember_deleted_feed_transaction does not carry the fed-row test and the ON CONFLICT clause from 20260828140000_a_deletion_is_a_decision.sql — apply that migration first. Replacing the body without them would either tombstone hand-entered rows or make a repeated deletion an error.'
      USING ERRCODE = 'P0001',
            HINT = 'Verification 1 at the foot of this file prints the body currently installed.';
  END IF;

  -- Guard 4: the trigger still exists, still BEFORE DELETE, still per row.
  -- This migration replaces a function and creates no trigger, so the trigger
  -- is a precondition rather than something it can put right.
  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger t
      JOIN pg_proc  p ON p.oid = t.tgfoid
     WHERE t.tgrelid = 'public.transactions'::regclass
       AND NOT t.tgisinternal
       AND p.proname = 'remember_deleted_feed_transaction'
       AND (t.tgtype & 1) = 1     -- FOR EACH ROW
       AND (t.tgtype & 2) = 2     -- BEFORE
       AND (t.tgtype & 8) = 8     -- DELETE
  ) THEN
    RAISE EXCEPTION 'tombstone_trigger_not_attached: no BEFORE DELETE … FOR EACH ROW trigger on public.transactions runs remember_deleted_feed_transaction — apply 20260828140000_a_deletion_is_a_decision.sql first'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

-- ── The function ───────────────────────────────────────────────────────────
-- Byte-for-byte 20260828140000_a_deletion_is_a_decision.sql's body with ONE
-- guard added. Its comment is kept verbatim below because it is still the
-- reason the outer IF exists; read that file for the rest.
CREATE OR REPLACE FUNCTION public.remember_deleted_feed_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only rows that CAME FROM A FEED get a tombstone: a hand-entered
  -- transaction has no external id and no sync will ever offer it again, so
  -- recording its deletion would be noise.
  IF OLD.external_transaction_id IS NOT NULL
     AND length(trim(OLD.external_transaction_id)) > 0 THEN

    -- ── THE OWNER MAY ALREADY BE GONE (20260902140000) ────────────────────
    -- Reachable by one route only: transactions.user_id is
    -- `NOT NULL REFERENCES users(id) ON DELETE CASCADE`, so a live row always
    -- has an owner and this can be false only when the row is being cascaded
    -- away with the person who owned it — an account erasure.
    --
    -- There is nothing to write. A tombstone exists so that the next sync does
    -- not re-import a row the owner deliberately deleted; an erased owner has
    -- no bank_connections left (they cascade away too), therefore no sync,
    -- therefore nobody will ever ask this question about them again. The row
    -- would be a fact about a person the database is in the middle of
    -- forgetting, keyed on a user_id that no longer names anybody.
    --
    -- And attempting it is not harmless: deleted_feed_transactions.user_id
    -- REFERENCES users(id), whose parent has just been removed, so the INSERT
    -- raises and takes the entire cascade — the whole GDPR erasure — down with
    -- it. That is the failure this migration exists to fix.
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = OLD.user_id) THEN
      RETURN OLD;
    END IF;

    -- ON CONFLICT DO NOTHING because deleting the same id twice (a row
    -- re-imported before 20260828140000 shipped, then deleted again) is the
    -- same decision stated twice, not an error.
    INSERT INTO public.deleted_feed_transactions (
      user_id, connection_id, external_transaction_id, account_id
    )
    VALUES (
      OLD.user_id, OLD.connection_id, OLD.external_transaction_id, OLD.account_id
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.remember_deleted_feed_transaction() IS
  'Records the external id of a deleted feed transaction so sync-transactions cannot re-import it. Skips a row whose owner is already gone: that only happens when an account erasure cascades the row away, when there is no feed left to re-import from and the foreign key to users could not be satisfied anyway.';

COMMIT;

-- ============================================================================
-- Verification — run after applying
-- ============================================================================

-- 1. The body carries both of 20260828140000's decisions AND the new guard.
--    Expected: three true.
SELECT position('length(trim(OLD.external_transaction_id))' IN pg_get_functiondef(oid)) > 0
         AS keeps_the_fed_row_test,
       position('ON CONFLICT DO NOTHING' IN pg_get_functiondef(oid)) > 0
         AS keeps_the_repeat_deletion_rule,
       position('NOT EXISTS (SELECT 1 FROM public.users WHERE id = OLD.user_id)' IN pg_get_functiondef(oid)) > 0
         AS skips_an_erased_owner
  FROM pg_proc
 WHERE oid = to_regprocedure('public.remember_deleted_feed_transaction()');

-- 2. The foreign key is UNCHANGED — deliberately. Expected: one row reading
--    'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE'. If it
--    ever reads anything else, a tombstone can outlive the person it names.
SELECT conname, pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
 WHERE conrelid = 'public.deleted_feed_transactions'::regclass
   AND contype = 'f';

-- 3. The accounts this unblocks: users holding at least one fed transaction,
--    every one of whom could not be erased until now.
SELECT count(DISTINCT user_id) AS users_holding_fed_rows,
       count(*)                AS fed_rows
  FROM public.transactions
 WHERE external_transaction_id IS NOT NULL
   AND length(trim(external_transaction_id)) > 0;

-- 4. No tombstone has ever been orphaned (the foreign key guarantees it; this
--    says so out loud, because the fix above is the one that keeps it true).
--    Expected: 0.
SELECT count(*) AS tombstones_without_an_owner
  FROM public.deleted_feed_transactions d
 WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = d.user_id);
