-- Credit-card feeds (TrueLayer Cards API) — linked_accounts learns which
-- API surface an external account lives on.
--
-- IMPORTANT: Run this SQL in the Supabase SQL Editor to apply to production DB.
-- Safe to apply before the matching client deploys: the column defaults to
-- 'account', which is exactly today's behaviour for every existing link.
--
-- TrueLayer serves credit cards (American Express etc.) from /data/v1/cards,
-- a separate surface from /data/v1/accounts, with different balance and sign
-- conventions. The sync endpoints must know which surface each linked
-- external account belongs to: 'account' → /accounts endpoints (unchanged),
-- 'card' → /cards endpoints (new).

BEGIN;

ALTER TABLE public.linked_accounts
  ADD COLUMN IF NOT EXISTS external_kind text NOT NULL DEFAULT 'account';

ALTER TABLE public.linked_accounts
  DROP CONSTRAINT IF EXISTS linked_accounts_external_kind_check;
ALTER TABLE public.linked_accounts
  ADD CONSTRAINT linked_accounts_external_kind_check
  CHECK (external_kind IN ('account', 'card'));

COMMIT;
