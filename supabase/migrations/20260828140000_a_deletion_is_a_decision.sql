-- ============================================================================
-- A DELETION IS A DECISION — feed transactions stay deleted
-- ============================================================================
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor).
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
--
-- Reported live, 28 Aug 2026: the owner deleted a £8,321.54 "PAYMENT RECEIVED"
-- from his British Airways Amex, because he had already recorded that money as
-- a transfer from his HSBC current account. The next sync brought it straight
-- back, and the card was credited twice.
--
-- The cause is not in the matching rules — it is in what a delete leaves
-- behind, which is nothing. sync-transactions asks the database one question:
-- "which of these external ids do I already have?" It answers by selecting
-- from `transactions`. A row the owner deleted is not in `transactions`, so
-- its id is unknown, so it is new, so it is inserted. Deleting a fed
-- transaction does not mean "do not bring this back" — it destroys the only
-- evidence the id ever arrived, and therefore GUARANTEES its return.
--
-- Two nets exist and neither covers this. Id churn only fires when an id has
-- VANISHED from the feed; his had not, because the bank still reports that
-- payment every time. Transfer adoption matches a hand-made leg that has no
-- id yet — a net for a DIFFERENT problem, which happened not to catch this.
--
-- ── WHY A TRIGGER RATHER THAN THE DELETE ROUTES ─────────────────────────────
--
-- There are two delete paths today (/api/data/delete-transaction and the
-- delete_transaction_atomic RPC), plus bulk deletes and the Money re-import
-- guards, and nothing stops a third being written. Stamping the tombstone in
-- application code means every future path must remember; stamping it here
-- means none of them can forget. The rule belongs to the table.
--
-- ── WHAT IS NOT DECIDED HERE ────────────────────────────────────────────────
--
-- A tombstone is silent by nature, and silence is what this app does not do:
-- the sync response reports these separately from duplicates, so "your bank
-- offered 40, I stored 39" is answerable rather than mysterious. Restoring one
-- deliberately is a later question and needs a control, not a schema guess —
-- deleting the tombstone row is all it will take.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.deleted_feed_transactions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  connection_id           uuid,
  external_transaction_id text NOT NULL,
  account_id              uuid,
  deleted_at              timestamptz NOT NULL DEFAULT now(),

  -- An id is unique per connection, not globally: two banks may both call a
  -- transaction "1". A NULL connection_id (a row imported before connections
  -- were recorded) still deserves a tombstone, hence COALESCE in the index.
  CONSTRAINT deleted_feed_transactions_id_not_blank
    CHECK (length(trim(external_transaction_id)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS deleted_feed_transactions_unique
  ON public.deleted_feed_transactions (
    user_id,
    COALESCE(connection_id, '00000000-0000-0000-0000-000000000000'::uuid),
    external_transaction_id
  );

CREATE INDEX IF NOT EXISTS deleted_feed_transactions_lookup
  ON public.deleted_feed_transactions (connection_id, external_transaction_id);

-- ── RLS — the investment_prices/custom_reports pattern exactly ──────────────

ALTER TABLE public.deleted_feed_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deleted_feed_transactions_select_own ON public.deleted_feed_transactions;
CREATE POLICY deleted_feed_transactions_select_own ON public.deleted_feed_transactions
  FOR SELECT TO authenticated
  USING (user_id = public.requesting_user_id());

DROP POLICY IF EXISTS deleted_feed_transactions_insert_own ON public.deleted_feed_transactions;
CREATE POLICY deleted_feed_transactions_insert_own ON public.deleted_feed_transactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.requesting_user_id());

-- No UPDATE policy: a tombstone is a fact with a date, not a record to edit.
-- DELETE is how one is lifted, which is what a future "bring it back" control
-- will do.
DROP POLICY IF EXISTS deleted_feed_transactions_delete_own ON public.deleted_feed_transactions;
CREATE POLICY deleted_feed_transactions_delete_own ON public.deleted_feed_transactions
  FOR DELETE TO authenticated
  USING (user_id = public.requesting_user_id());

REVOKE ALL ON TABLE public.deleted_feed_transactions FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON TABLE public.deleted_feed_transactions TO authenticated;
GRANT ALL ON TABLE public.deleted_feed_transactions TO service_role;

-- ── THE TRIGGER ─────────────────────────────────────────────────────────────
-- Only rows that CAME FROM A FEED get a tombstone: a hand-entered transaction
-- has no external id and no sync will ever offer it again, so recording its
-- deletion would be noise. ON CONFLICT DO NOTHING because deleting the same
-- id twice (a row re-imported before this shipped, then deleted again) is the
-- same decision stated twice, not an error.
CREATE OR REPLACE FUNCTION public.remember_deleted_feed_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.external_transaction_id IS NOT NULL
     AND length(trim(OLD.external_transaction_id)) > 0 THEN
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

DROP TRIGGER IF EXISTS transactions_remember_deletion ON public.transactions;
CREATE TRIGGER transactions_remember_deletion
  BEFORE DELETE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.remember_deleted_feed_transaction();

COMMENT ON TABLE public.deleted_feed_transactions IS
  'External ids the owner deliberately deleted. sync-transactions must not re-import these. Written by a trigger on transactions so no delete path can forget.';
