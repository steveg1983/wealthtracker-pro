-- Add notes column to accounts table.
-- This was missing, causing AccountSettingsModal saves to silently fail
-- (the non-existent column made the entire Supabase update reject).

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS notes TEXT;
