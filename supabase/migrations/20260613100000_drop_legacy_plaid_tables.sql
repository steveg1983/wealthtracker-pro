-- Drop the legacy Plaid tables (AUDIT_2026-06-12_DEEP_REAUDIT.md finding #10).
--
-- plaid_connections stored `access_token text NOT NULL` in PLAINTEXT — unlike
-- the live TrueLayer path (bank_connections.access_token_encrypted). The app
-- migrated to TrueLayer; no code populates or reads these tables, and all
-- three were verified EMPTY in production on 2026-06-13 (service-role count:
-- plaid_connections 0, plaid_accounts 0, plaid_webhooks 0). The 20260612100000
-- migration already locked their RLS to service_role-only as an interim
-- measure; removing them eliminates the plaintext-token footgun entirely.
--
-- accounts.plaid_connection_id / accounts.plaid_account_id COLUMNS are kept:
-- they're nullable, harmless, and still mapped by the account service. Only
-- the FK into the dropped table goes.
--
-- The pentest harness (scripts/pentest.mjs) keeps probing these table names
-- and treats "table absent" as PASS — so an accidental re-creation with weak
-- RLS would be caught.

ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_plaid_connection_id_fkey;

DROP TABLE IF EXISTS public.plaid_webhooks;
DROP TABLE IF EXISTS public.plaid_accounts;
DROP TABLE IF EXISTS public.plaid_connections;
