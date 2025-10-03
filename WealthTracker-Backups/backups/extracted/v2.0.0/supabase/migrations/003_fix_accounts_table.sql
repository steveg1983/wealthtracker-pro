-- Fix accounts table to ensure all columns exist
-- This migration adds any missing columns to the accounts table

-- Check and add initial_balance column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'accounts' 
    AND column_name = 'initial_balance'
  ) THEN
    ALTER TABLE accounts ADD COLUMN initial_balance DECIMAL(20, 2) DEFAULT 0;
  END IF;
END $$;

-- Ensure all required columns exist with proper types
-- This is idempotent - won't error if columns already exist

-- Add metadata column if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'accounts' 
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE accounts ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;
END $$;

-- Add account_number column if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'accounts' 
    AND column_name = 'account_number'
  ) THEN
    ALTER TABLE accounts ADD COLUMN account_number TEXT;
  END IF;
END $$;

-- Add sort_code column if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'accounts' 
    AND column_name = 'sort_code'
  ) THEN
    ALTER TABLE accounts ADD COLUMN sort_code TEXT;
  END IF;
END $$;

-- Refresh the schema cache
SELECT pg_notify('schema_cache_refresh', 'accounts');