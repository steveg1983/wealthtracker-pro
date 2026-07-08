-- Transfer-category lifecycle: system-managed per-account categories that
-- track their account (the Microsoft Money model).
--
-- IMPORTANT: Run this SQL in the Supabase SQL Editor to apply to production DB.
-- Safe to apply before the matching code deploys.
--
-- Every account gets a 'To/From <name>' transfer category via the existing
-- insert trigger, but nothing managed it afterwards: it could be deleted from
-- the Categories page (losing the transfer bookkeeping for that account),
-- account renames left the old name behind, and closing an account left its
-- transfer category live in every dropdown.
--
-- Naming collisions: categories are UNIQUE (user_id, name, parent_id) while
-- account names are not unique, so every write below is collision-guarded —
-- a clash keeps the old category name (or skips creation) rather than
-- aborting the surrounding operation (account rename, bank sync, migration).
--
-- Changes:
--   1. create_transfer_category_for_account: idempotent; skips when the user
--      has no Transfer type category yet (parentless rows render as junk) or
--      when the name would collide.
--   2. NEW sync trigger on accounts UPDATE: rename follows the account,
--      is_active mirrors the account (closed account → hidden category).
--   3. NEW protect trigger on categories DELETE: a transfer category cannot
--      be deleted while its account (and the user row) exists. The users-row
--      check lets full user erasure (GDPR cascade from DELETE FROM users)
--      proceed regardless of FK cascade ordering.
--   4. Self-heal: fix names/active flags of existing transfer categories and
--      recreate any that were deleted, all collision-guarded.

BEGIN;

-- ── 1. CREATE (hardened, idempotent, collision-safe) ────────────────────────
CREATE OR REPLACE FUNCTION public.create_transfer_category_for_account() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  transfer_type_id UUID;
BEGIN
  -- Prefer the structural match (the Transfer type category is the only
  -- type-level 'both'); fall back to the name for legacy datasets.
  SELECT id INTO transfer_type_id
  FROM categories
  WHERE user_id = NEW.user_id
    AND level = 'type'
    AND (type = 'both' OR name = 'Transfer')
  ORDER BY (type = 'both') DESC
  LIMIT 1;

  -- No Transfer anchor yet (categories seed lazily on first app load): skip
  -- rather than minting a parentless category; the self-heal in a later
  -- migration run (or support tooling) can backfill.
  IF transfer_type_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Idempotent: an account gets exactly one transfer category. ON CONFLICT
  -- keeps account creation alive if another category already owns the name.
  IF NOT EXISTS (
    SELECT 1 FROM categories
    WHERE account_id = NEW.id AND is_transfer_category = TRUE
  ) THEN
    INSERT INTO categories (
      user_id, name, type, level, parent_id,
      is_system, is_transfer_category, account_id, is_active
    ) VALUES (
      NEW.user_id,
      'To/From ' || NEW.name,
      'both',
      'detail',
      transfer_type_id,
      FALSE,
      TRUE,
      NEW.id,
      COALESCE(NEW.is_active, TRUE)
    )
    ON CONFLICT (user_id, name, parent_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- ── 2. SYNC on account update ───────────────────────────────────────────────
-- Rename follows the account; open/closed mirrors onto the category so a
-- closed account's transfer category vanishes from transaction dropdowns.
-- If the new name would collide with another category under the same parent,
-- the old category name is kept (is_active still syncs) — an account rename
-- or bank sync must never abort on a category naming clash.
CREATE OR REPLACE FUNCTION public.sync_transfer_category_for_account() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name
     OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    UPDATE categories c
       SET name = CASE
             WHEN NOT EXISTS (
               SELECT 1 FROM categories x
                WHERE x.user_id = c.user_id
                  AND x.parent_id IS NOT DISTINCT FROM c.parent_id
                  AND x.name = 'To/From ' || NEW.name
                  AND x.id <> c.id
             ) THEN 'To/From ' || NEW.name
             ELSE c.name
           END,
           is_active = COALESCE(NEW.is_active, TRUE),
           updated_at = now()
     WHERE c.account_id = NEW.id
       AND c.is_transfer_category = TRUE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_transfer_category_on_account_update ON public.accounts;
CREATE TRIGGER sync_transfer_category_on_account_update
  AFTER UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.sync_transfer_category_for_account();

-- ── 3. PROTECT against deletion ─────────────────────────────────────────────
-- A transfer category is system bookkeeping for its account: while the
-- account row exists (open OR closed — closed accounts keep their history),
-- the category must not be deleted. The users-row check makes full user
-- erasure (DELETE FROM users cascading through categories/accounts in
-- whatever order Postgres picks) immune to this protection.
CREATE OR REPLACE FUNCTION public.protect_transfer_category() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF OLD.is_transfer_category = TRUE
     AND OLD.account_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM accounts WHERE id = OLD.account_id)
     AND EXISTS (SELECT 1 FROM users WHERE id = OLD.user_id) THEN
    RAISE EXCEPTION 'transfer_category_protected'
      USING ERRCODE = 'P0001',
            HINT = 'Transfer categories are managed automatically from the account. Close the account instead.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS protect_transfer_category_on_delete ON public.categories;
CREATE TRIGGER protect_transfer_category_on_delete
  BEFORE DELETE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.protect_transfer_category();

-- ── 4. SELF-HEAL existing data (collision-guarded) ──────────────────────────
-- Fix drifted names/active flags; a name that would collide keeps its current
-- name but still gets the right is_active.
UPDATE categories c
   SET name = CASE
         WHEN c.name IS DISTINCT FROM 'To/From ' || a.name
              AND NOT EXISTS (
                SELECT 1 FROM categories x
                 WHERE x.user_id = c.user_id
                   AND x.parent_id IS NOT DISTINCT FROM c.parent_id
                   AND x.name = 'To/From ' || a.name
                   AND x.id <> c.id
              )
         THEN 'To/From ' || a.name
         ELSE c.name
       END,
       is_active = COALESCE(a.is_active, TRUE),
       updated_at = now()
  FROM accounts a
 WHERE c.account_id = a.id
   AND c.is_transfer_category = TRUE
   AND (c.name IS DISTINCT FROM 'To/From ' || a.name
        OR c.is_active IS DISTINCT FROM COALESCE(a.is_active, TRUE));

-- Recreate transfer categories that were deleted while unprotected. Requires
-- the user's Transfer anchor to exist (no parentless junk) and skips name
-- collisions rather than failing the migration.
INSERT INTO categories (
  user_id, name, type, level, parent_id,
  is_system, is_transfer_category, account_id, is_active
)
SELECT
  a.user_id,
  'To/From ' || a.name,
  'both',
  'detail',
  t.id,
  FALSE,
  TRUE,
  a.id,
  COALESCE(a.is_active, TRUE)
FROM accounts a
JOIN LATERAL (
  SELECT id FROM categories tt
   WHERE tt.user_id = a.user_id
     AND tt.level = 'type'
     AND (tt.type = 'both' OR tt.name = 'Transfer')
   ORDER BY (tt.type = 'both') DESC
   LIMIT 1
) t ON TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM categories c
  WHERE c.account_id = a.id AND c.is_transfer_category = TRUE
)
ON CONFLICT (user_id, name, parent_id) DO NOTHING;

COMMIT;
