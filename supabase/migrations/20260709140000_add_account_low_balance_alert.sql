-- Low-balance alert persistence for accounts.
--
-- The "Low Balance Alert" toggle + threshold in Account Settings, and the
-- dashboard alert that reads them, were shipped against columns that never
-- existed on `accounts`. Every save from the Account Settings modal sent
-- `lowBalanceAlertEnabled` / `lowBalanceThreshold`, which PostgREST rejected
-- ("Could not find the 'lowBalanceAlertEnabled' column ... in the schema
-- cache") — aborting the WHOLE update, so unrelated edits (e.g. the opening
-- balance) silently failed too. Add the backing columns; the service now maps
-- the camelCase fields to these snake_case columns.

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS low_balance_alert_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS low_balance_threshold numeric(20,2);

-- Make PostgREST pick up the new columns immediately rather than on its next
-- periodic reload.
NOTIFY pgrst, 'reload schema';
