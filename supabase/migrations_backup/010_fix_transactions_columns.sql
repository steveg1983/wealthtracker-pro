-- Fix missing columns in transactions table before running 010
-- Run this BEFORE migration 010

-- Add missing columns to transactions table if they don't exist
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('income', 'expense', 'transfer'));

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);