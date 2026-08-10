-- ============================================================================
-- is_reconciled — a mark is a working note; only finalizing reconciles
-- ============================================================================
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor). One new column on transactions, one on
-- accounts, one new function, and three existing objects redefined. NO ROW IS
-- REWRITTEN by applying this, no grant widens, and no balance is touched.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- Microsoft Money kept two states against a transaction while you balanced an
-- account, and the difference between them is the whole feature:
--
--   C — cleared. A working mark. You tick rows off the statement as you read
--       it; the marks survive closing the window and coming back next week; and
--       nothing about the account has been settled yet.
--   R — reconciled. The committed state. Only pressing Finish produces it, and
--       only against a statement ending balance stated up front.
--
-- This schema had ONE flag doing both jobs. is_cleared was set by the
-- reconciliation screen's checkbox, by "Mark all", by the register's Space key
-- and by every bank import — and the same flag was then read as "reconciled" by
-- the Accounts list, by the archive and by the reconciliation account list. So
-- pressing "Mark all cleared" WAS the reconciliation: leave the screen and the
-- account showed nothing left to do, which left "Finalize Reconciliation" as a
-- button whose only visible effect was a date. The owner's words: marking
-- "should just be a HOLDING state — leave the screen and those transactions are
-- still yet to be reconciled. It is Finalize Reconciliation that should
-- complete things."
--
-- ── WHY THE COLUMN IS NULLABLE, AND WHY THERE IS NO BACKFILL ────────────────
-- The obvious shape is `is_reconciled boolean NOT NULL DEFAULT false` plus an
-- `UPDATE ... SET is_reconciled = true WHERE is_cleared` to carry history over.
-- Rejected, for two reasons that are about this database rather than about
-- taste:
--
--   1. IT WOULD REWRITE FIFTY THOUSAND ROWS TO SAY WHAT THEY ALREADY SAY. Every
--      one of those rows is already cleared, which under the old model means
--      reconciled; the UPDATE adds no information.
--   2. WORSE, IT WOULD RESET THE DELTA SYNC. transactions carries
--      `update_transactions_updated_at` (BEFORE UPDATE, from the initial
--      schema), so the backfill would stamp `updated_at = now()` on the whole
--      table. The boot's incremental path asks for rows `updated_at >= since`
--      (getTransactionsSince), so the next boot for every device would
--      re-download the entire history — the app's single slowest operation,
--      triggered on purpose, to record nothing.
--
-- So the column is added NULLABLE WITH NO DEFAULT, which in modern Postgres is
-- pure catalogue metadata: no rewrite, no bloat, no updated_at churn. Existing
-- rows read NULL, and NULL is given a MEANING rather than being treated as
-- false:
--
--   NULL  = "this row predates the split; ask is_cleared."
--   false = marked or not, but explicitly NOT committed.
--   true  = committed by a finalize.
--
-- The DEFAULT is then set to false for rows inserted AFTERWARDS, which is the
-- correct answer for every new row: a transaction is born uncommitted whether
-- it was typed, imported or downloaded. (A bank-feed row still arrives
-- is_cleared = true — the bank has settled it — and that is a mark, not a
-- reconciliation, which is exactly the distinction this migration draws.)
--
-- The same three-valued rule is written in TypeScript once, in
-- src/utils/transactionReconciliation.ts, and read from there by every screen.
-- COALESCE(is_reconciled, is_cleared) below is that predicate in SQL; the two
-- must be changed together or not at all.
--
-- ── WHAT CHANGES FOR THE ARCHIVE ────────────────────────────────────────────
-- The soft archive (20260721130000) hides "old, reconciled" rows, and it read
-- is_cleared because that was the only flag there was. It now reads the
-- committed state, which matters practically rather than pedantically: with the
-- old rule, ticking a row dated before an account's archive cutoff made the row
-- VANISH from the register and from the reconciliation list mid-session — a
-- working mark is reversible, and a row you cannot see is a row you cannot
-- unmark. The sweep therefore moves onto is_reconciled, where the state really
-- is final. Rows written before this migration are unaffected: COALESCE reads
-- their NULL as is_cleared, which is what the archive was judging them by
-- yesterday.
--
-- ── BALANCE REASONING ───────────────────────────────────────────────────────
-- Balance-neutral by construction rather than by inspection. is_reconciled is
-- one flag beside the row's other state flags; it is not an amount, a sign, an
-- account_id or a date, and nothing reads it to compute a balance.
-- accounts.last_reconciled_balance is a RECORD of a figure a person confirmed
-- on a day — it is never added to, never compared against `balance`, and
-- nothing but finalize_reconciliation writes it. The ledger invariant
-- balance = initial_balance + Σ(amount) is untouched; verification 6 proves it.
-- No function below gains, loses or alters a single balance statement.
--
-- ── WHAT DOES NOT CHANGE ────────────────────────────────────────────────────
-- Every function keeps its signature, its SECURITY INVOKER, its pinned
-- search_path, its audit writes and its grants. A caller that says nothing
-- about is_reconciled behaves exactly as it does today, which is what makes
-- this safe to apply before or after any application deploy: the app's boot
-- select drops the column when the database has not got it yet (the ladder in
-- src/services/api/transactionService.ts), and finalize falls back to stamping
-- the account's date alone — which is precisely what it did before this work.
-- ============================================================================

BEGIN;

-- ── The committed flag ──────────────────────────────────────────────────────
-- Two statements, not one, and in this order ON PURPOSE: a column added WITH a
-- default gives EXISTING rows that default (the attmissingval mechanism), which
-- would silently answer "not committed" for the whole of history. Added bare,
-- history keeps NULL — the honest "never answered" — and the default then
-- applies only to rows inserted from here on.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_reconciled boolean;

ALTER TABLE public.transactions
  ALTER COLUMN is_reconciled SET DEFAULT false;

COMMENT ON COLUMN public.transactions.is_reconciled IS
  'Committed against a confirmed statement balance (Microsoft Money''s R). Set only by finalize_reconciliation. NULL means the row predates the split between marking and committing, and is_cleared answers for it — see src/utils/transactionReconciliation.ts, which holds the same rule for the app.';

-- ── The ending balance a reconciliation was settled against ─────────────────
-- Nullable with no default: NULL is "no reconciliation has ever been finalized
-- against a confirmed figure", which is true of every account until the first
-- one is. Never 0 for unknown — £0.00 is a real statement balance (an account
-- swept to zero every night closes on exactly that), so the two cannot share a
-- representation. numeric(20,2) matches bank_balance.
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS last_reconciled_balance numeric(20,2);

COMMENT ON COLUMN public.accounts.last_reconciled_balance IS
  'Ending balance the last finalized reconciliation was settled against — Money''s "last statement balance", and the starting balance the next one is offered. Distinct from bank_balance, which is what the bank says now. Written only by finalize_reconciliation.';

-- ── Marking (from 20260707120000; + the committed flag) ─────────────────────
-- Unchanged except for one CASE. The rule it encodes:
--
--   marking KEEPS whatever the row said about commitment — marking a committed
--     row changes nothing about the commitment;
--   UNMARKING clears it — is_reconciled implies is_cleared, because a row that
--     is not ticked cannot be a row a statement was balanced against, and the
--     pair (reconciled, not cleared) would put the cleared balance and the
--     reconciled set permanently out of step.
--
-- COALESCE rather than a bare read: a NULL here means "ask is_cleared", and the
-- rows this loop touches are by definition the ones whose is_cleared is
-- changing, so writing the resolved answer down is what stops the ambiguity
-- outliving the change. Still one write per row, still audited per row, still
-- no balance arithmetic.
CREATE OR REPLACE FUNCTION public.set_transactions_cleared(
  p_ids uuid[],
  p_cleared boolean,
  p_user_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_old public.transactions;
  v_new public.transactions;
BEGIN
  FOR v_old IN
    SELECT * FROM public.transactions
     WHERE id = ANY(p_ids)
       AND (p_user_id IS NULL OR user_id = p_user_id)
       AND is_cleared IS DISTINCT FROM p_cleared
     FOR UPDATE
  LOOP
    UPDATE public.transactions
       SET is_cleared = p_cleared,
           is_reconciled = CASE
             WHEN p_cleared THEN COALESCE(is_reconciled, is_cleared)
             ELSE false
           END,
           updated_at = now()
     WHERE id = v_old.id
    RETURNING * INTO v_new;

    PERFORM public.write_financial_audit(
      v_new.user_id, 'transaction', v_new.id, 'update', to_jsonb(v_old), to_jsonb(v_new)
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ── Finalize (new) ──────────────────────────────────────────────────────────
-- The only thing in the system that produces a committed row.
--
-- IT CONVERTS EXACTLY THE WORKING SET: rows of this account that are marked and
-- explicitly not committed. `is_reconciled IS NOT DISTINCT FROM false` and not
-- `IS DISTINCT FROM true` on purpose — a NULL row is one the old world already
-- called reconciled, and sweeping those in would rewrite (and re-audit, and
-- re-stamp updated_at on) the entire history of the account the first time
-- anybody finalized it, for no change in what any screen shows.
--
-- IT RECORDS THE FIGURE IT WAS SETTLED AGAINST, because the next reconciliation
-- needs to open at last time's ending balance, and because "reconciled on the
-- 3rd" without "against what" is a claim nobody can check afterwards. The
-- ending balance is taken from the caller, who got it from a person who
-- confirmed it — the screen will not let a reconciliation finish otherwise.
--
-- All-or-nothing: one database transaction, so the rows and the account's
-- record of them land together or neither does. The intermediate state — rows
-- committed against a statement the account has no memory of — is the state
-- that makes the next reconciliation start from a figure that is not the last
-- one it finished on.
--
-- Balance-neutral: it writes two flags-and-records and never touches `balance`
-- or `initial_balance`.
CREATE OR REPLACE FUNCTION public.finalize_reconciliation(
  p_user_id uuid,
  p_account_id uuid,
  p_ending_balance numeric,
  p_reconciled_on date
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_before public.accounts;
  v_after public.accounts;
  v_old public.transactions;
  v_new public.transactions;
  v_count integer := 0;
BEGIN
  IF p_ending_balance IS NULL THEN
    -- Not a defensive nicety: the ending balance is the whole point of
    -- finishing, and a NULL one would record "reconciled against nothing".
    RAISE EXCEPTION 'ending_balance_required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_before
    FROM public.accounts
   WHERE id = p_account_id AND user_id = p_user_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account_not_found_or_not_owned' USING ERRCODE = 'P0002';
  END IF;

  FOR v_old IN
    SELECT * FROM public.transactions
     WHERE user_id = p_user_id
       AND account_id = p_account_id
       AND is_cleared = true
       AND is_reconciled IS NOT DISTINCT FROM false
     FOR UPDATE
  LOOP
    UPDATE public.transactions
       SET is_reconciled = true,
           updated_at = now()
     WHERE id = v_old.id
    RETURNING * INTO v_new;

    PERFORM public.write_financial_audit(
      v_new.user_id, 'transaction', v_new.id, 'update', to_jsonb(v_old), to_jsonb(v_new)
    );

    v_count := v_count + 1;
  END LOOP;

  UPDATE public.accounts
     SET last_reconciled_date = COALESCE(p_reconciled_on, CURRENT_DATE),
         last_reconciled_balance = p_ending_balance,
         updated_at = now()
   WHERE id = p_account_id AND user_id = p_user_id
  RETURNING * INTO v_after;

  PERFORM public.write_financial_audit(
    p_user_id, 'account', p_account_id, 'update', to_jsonb(v_before), to_jsonb(v_after)
  );

  RETURN jsonb_build_object(
    'reconciled', v_count,
    'ending_balance', p_ending_balance,
    'reconciled_on', COALESCE(p_reconciled_on, CURRENT_DATE)
  );
END;
$$;

COMMENT ON FUNCTION public.finalize_reconciliation(uuid, uuid, numeric, date) IS
  'Commit an account''s marked-but-uncommitted transactions and record the statement the reconciliation was settled against, in one database transaction. Converts only rows whose is_reconciled is explicitly false (NULL rows are pre-split history the archive and the counts already treat as reconciled). Balance-neutral: writes one flag per row and two records on the account, and never touches balance or initial_balance.';

REVOKE ALL ON FUNCTION public.finalize_reconciliation(uuid, uuid, numeric, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.finalize_reconciliation(uuid, uuid, numeric, date) TO authenticated, service_role;

-- ── Archive (from 20260721130000; + the committed flag) ─────────────────────
-- Byte-for-byte the live definition except for the predicate: "reconciled" now
-- means committed, with NULL (pre-split history) still judged by is_cleared, so
-- what this archives today is exactly what it would have archived yesterday.
CREATE OR REPLACE FUNCTION public.archive_transactions_before(
  p_user_id uuid,
  p_account_id uuid,
  p_cutoff date
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_acct public.accounts;
  v_count integer;
BEGIN
  SELECT * INTO v_acct
    FROM public.accounts
   WHERE id = p_account_id AND user_id = p_user_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_acct.type = 'investment' THEN
    RAISE EXCEPTION 'investment accounts cannot be archived yet' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.transactions
     SET archived = true, updated_at = now()
   WHERE user_id = p_user_id
     AND account_id = p_account_id
     AND COALESCE(is_reconciled, is_cleared) = true
     AND archived = false
     AND date <= p_cutoff;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.accounts
     SET archive_through_date = p_cutoff, updated_at = now()
   WHERE id = p_account_id AND user_id = p_user_id;

  RETURN jsonb_build_object('archived', v_count, 'cutoff', p_cutoff);
END;
$$;

-- ── Reconcile-sweep (from 20260721130000; now keyed on the committed flag) ───
-- A row that becomes COMMITTED on or before its account's cutoff drops off the
-- live register, exactly as before. What no longer does it is a working mark:
-- ticking a row must never make it disappear from the screen the ticking
-- happens on. Never un-archives (unarchive stays an explicit action).
CREATE OR REPLACE FUNCTION public.sweep_reconciled_into_archive()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_cutoff date;
BEGIN
  IF NEW.is_reconciled IS TRUE
     AND (OLD.is_reconciled IS DISTINCT FROM NEW.is_reconciled)
     AND NEW.archived = false THEN
    SELECT archive_through_date INTO v_cutoff
      FROM public.accounts WHERE id = NEW.account_id;
    IF v_cutoff IS NOT NULL AND NEW.date <= v_cutoff THEN
      NEW.archived := true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sweep_reconciled_into_archive ON public.transactions;
CREATE TRIGGER trg_sweep_reconciled_into_archive
  BEFORE UPDATE OF is_reconciled ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.sweep_reconciled_into_archive();

COMMIT;

-- ============================================================================
-- Verification — run after applying. NOTE: unapplied at the time of writing;
-- these are what to read, and what to expect, when it is.
-- ============================================================================

-- 1. The column exists, is nullable, and defaults to false for new rows.
-- Expected: one row — is_nullable = YES, column_default = false
SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'transactions'
   AND column_name = 'is_reconciled';

-- 2. NOTHING WAS REWRITTEN. Every row that existed before still says NULL, and
--    the count of NULLs equals the count of rows older than this migration.
-- Expected: `unanswered` equals the whole table on the day of applying, and
--           only falls as rows are marked, unmarked or finalized afterwards.
SELECT count(*) FILTER (WHERE is_reconciled IS NULL)  AS unanswered,
       count(*) FILTER (WHERE is_reconciled IS FALSE) AS marked_not_committed,
       count(*) FILTER (WHERE is_reconciled IS TRUE)  AS committed,
       count(*)                                       AS total
  FROM public.transactions;

-- 3. The account column exists and no account has invented a figure.
-- Expected: every account NULL until its first finalize.
SELECT count(*) AS accounts, count(last_reconciled_balance) AS with_a_recorded_balance
  FROM public.accounts;

-- 4. Finalize has the security posture every other write RPC has, and is never
--    reachable by anon.
-- Expected: prosecdef = false, proconfig = {search_path=public}; grants to
--           authenticated and service_role only.
SELECT p.proname, p.prosecdef, p.proconfig
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'finalize_reconciliation';

SELECT a.grantee::regrole::text AS grantee, a.privilege_type
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 CROSS JOIN LATERAL aclexplode(p.proacl) AS a
 WHERE n.nspname = 'public' AND p.proname = 'finalize_reconciliation'
 ORDER BY grantee;

-- 5. The sweep now fires on the committed flag and no longer on the mark.
-- Expected: one row — event_manipulation = UPDATE, and the column list holds
--           is_reconciled and NOT is_cleared.
SELECT t.tgname,
       pg_get_triggerdef(t.oid) AS definition
  FROM pg_trigger t
 WHERE t.tgrelid = 'public.transactions'::regclass
   AND t.tgname = 'trg_sweep_reconciled_into_archive';

-- 6. No balance moved. The ledger invariant holds for every account, exactly as
--    it did before — this migration writes flags and records, never money.
-- Expected: zero rows
SELECT a.id, a.name, a.balance, a.initial_balance + COALESCE(t.total, 0) AS expected
  FROM public.accounts a
  LEFT JOIN (
    SELECT account_id, sum(amount) AS total
      FROM public.transactions
     GROUP BY account_id
  ) t ON t.account_id = a.id
 WHERE a.balance IS DISTINCT FROM a.initial_balance + COALESCE(t.total, 0);

-- 7. The invariant the mark rule exists to keep: nothing is committed without
--    also being marked.
-- Expected: zero rows, now and after every future reconciliation.
SELECT id, account_id, date, is_cleared, is_reconciled
  FROM public.transactions
 WHERE is_reconciled IS TRUE AND is_cleared IS NOT TRUE;
