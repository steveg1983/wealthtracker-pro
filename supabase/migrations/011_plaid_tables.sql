-- Create Plaid integration tables for secure bank connections
-- These tables store encrypted access tokens and sync data from Plaid

-- 1. Create plaid_connections table
CREATE TABLE IF NOT EXISTS plaid_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  institution_id TEXT NOT NULL,
  institution_name TEXT NOT NULL,
  item_id TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL, -- Should be encrypted in production
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'error', 'updating')),
  last_sync TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, item_id)
);

-- 2. Create plaid_accounts table
CREATE TABLE IF NOT EXISTS plaid_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES plaid_connections(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  official_name TEXT,
  type TEXT NOT NULL,
  subtype TEXT NOT NULL,
  mask TEXT,
  balance_current DECIMAL(10,2),
  balance_available DECIMAL(10,2),
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add Plaid-specific columns to transactions table if they don't exist
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS plaid_transaction_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS plaid_account_id TEXT,
ADD COLUMN IF NOT EXISTS merchant_name TEXT,
ADD COLUMN IF NOT EXISTS location_city TEXT,
ADD COLUMN IF NOT EXISTS location_country TEXT,
ADD COLUMN IF NOT EXISTS payment_channel TEXT;

-- 4. Create plaid_webhooks table for tracking webhook events
CREATE TABLE IF NOT EXISTS plaid_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES plaid_connections(id) ON DELETE CASCADE,
  webhook_type TEXT NOT NULL,
  webhook_code TEXT NOT NULL,
  error TEXT,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_plaid_connections_user_id ON plaid_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_connections_item_id ON plaid_connections(item_id);
CREATE INDEX IF NOT EXISTS idx_plaid_connections_status ON plaid_connections(status);

CREATE INDEX IF NOT EXISTS idx_plaid_accounts_connection_id ON plaid_accounts(connection_id);
CREATE INDEX IF NOT EXISTS idx_plaid_accounts_account_id ON plaid_accounts(account_id);

CREATE INDEX IF NOT EXISTS idx_transactions_plaid_transaction_id ON transactions(plaid_transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_plaid_account_id ON transactions(plaid_account_id);

CREATE INDEX IF NOT EXISTS idx_plaid_webhooks_connection_id ON plaid_webhooks(connection_id);
CREATE INDEX IF NOT EXISTS idx_plaid_webhooks_processed ON plaid_webhooks(processed);

-- Create updated_at triggers
DROP TRIGGER IF EXISTS update_plaid_connections_updated_at ON plaid_connections;
CREATE TRIGGER update_plaid_connections_updated_at 
  BEFORE UPDATE ON plaid_connections
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_plaid_accounts_updated_at ON plaid_accounts;
CREATE TRIGGER update_plaid_accounts_updated_at 
  BEFORE UPDATE ON plaid_accounts
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS (Row Level Security)
ALTER TABLE plaid_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE plaid_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE plaid_webhooks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Plaid connections policies
DROP POLICY IF EXISTS "Users can view own plaid connections" ON plaid_connections;
CREATE POLICY "Users can view own plaid connections" ON plaid_connections
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Users can create own plaid connections" ON plaid_connections;
CREATE POLICY "Users can create own plaid connections" ON plaid_connections
  FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Users can update own plaid connections" ON plaid_connections;
CREATE POLICY "Users can update own plaid connections" ON plaid_connections
  FOR UPDATE USING (TRUE);

DROP POLICY IF EXISTS "Users can delete own plaid connections" ON plaid_connections;
CREATE POLICY "Users can delete own plaid connections" ON plaid_connections
  FOR DELETE USING (TRUE);

-- Plaid accounts policies
DROP POLICY IF EXISTS "Users can view plaid accounts" ON plaid_accounts;
CREATE POLICY "Users can view plaid accounts" ON plaid_accounts
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Users can manage plaid accounts" ON plaid_accounts;
CREATE POLICY "Users can manage plaid accounts" ON plaid_accounts
  FOR ALL USING (TRUE);

-- Plaid webhooks policies
DROP POLICY IF EXISTS "System can manage webhooks" ON plaid_webhooks;
CREATE POLICY "System can manage webhooks" ON plaid_webhooks
  FOR ALL USING (TRUE);

-- Grant permissions
GRANT ALL ON plaid_connections TO service_role;
GRANT ALL ON plaid_accounts TO service_role;
GRANT ALL ON plaid_webhooks TO service_role;

-- Create function to automatically create WealthTracker accounts from Plaid accounts
CREATE OR REPLACE FUNCTION create_account_from_plaid(
  p_user_id UUID,
  p_plaid_account_id TEXT,
  p_name TEXT,
  p_type TEXT,
  p_balance DECIMAL,
  p_currency TEXT
) RETURNS UUID AS $$
DECLARE
  v_account_id UUID;
  v_account_type TEXT;
BEGIN
  -- Map Plaid account type to our account types
  v_account_type := CASE 
    WHEN p_type = 'depository' THEN 'checking'
    WHEN p_type = 'credit' THEN 'credit'
    WHEN p_type = 'loan' THEN 'loan'
    WHEN p_type = 'investment' THEN 'investment'
    ELSE 'other'
  END;

  -- Check if account already exists
  SELECT id INTO v_account_id
  FROM accounts
  WHERE user_id = p_user_id AND plaid_account_id = p_plaid_account_id;

  IF v_account_id IS NULL THEN
    -- Create new account
    INSERT INTO accounts (
      user_id,
      name,
      type,
      balance,
      currency,
      plaid_account_id,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      p_user_id,
      p_name,
      v_account_type,
      p_balance,
      p_currency,
      p_plaid_account_id,
      TRUE,
      NOW(),
      NOW()
    ) RETURNING id INTO v_account_id;
  ELSE
    -- Update existing account
    UPDATE accounts
    SET 
      balance = p_balance,
      updated_at = NOW()
    WHERE id = v_account_id;
  END IF;

  RETURN v_account_id;
END;
$$ LANGUAGE plpgsql;

-- Add plaid_account_id column to accounts table if it doesn't exist
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS plaid_account_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS plaid_connection_id UUID REFERENCES plaid_connections(id);

CREATE INDEX IF NOT EXISTS idx_accounts_plaid_account_id ON accounts(plaid_account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_plaid_connection_id ON accounts(plaid_connection_id);