-- Enable pgcrypto for symmetric encryption utilities (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- bank_connections: stores provider metadata and encrypted credentials
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bank_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  provider TEXT NOT NULL CHECK (provider IN ('truelayer', 'plaid')),
  institution_id TEXT NOT NULL,
  institution_name TEXT NOT NULL,
  institution_logo TEXT,

  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,

  item_id TEXT,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'error', 'reauth_required')),
  last_sync TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_user_institution UNIQUE (user_id, institution_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_bank_connections_user_id ON bank_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_connections_status ON bank_connections(status);
CREATE INDEX IF NOT EXISTS idx_bank_connections_expires ON bank_connections(expires_at) WHERE expires_at IS NOT NULL;

ALTER TABLE bank_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own connections"
  ON bank_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own connections"
  ON bank_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connections"
  ON bank_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own connections"
  ON bank_connections FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- linked_accounts: maps provider accounts to WealthTracker accounts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS linked_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connection_id UUID NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  external_account_id TEXT NOT NULL,
  external_account_mask TEXT,
  external_account_name TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_connection_account UNIQUE (connection_id, external_account_id)
);

CREATE INDEX IF NOT EXISTS idx_linked_accounts_connection ON linked_accounts(connection_id);
CREATE INDEX IF NOT EXISTS idx_linked_accounts_account ON linked_accounts(account_id);

ALTER TABLE linked_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage linked accounts"
  ON linked_accounts
  USING (
    EXISTS (
      SELECT 1
      FROM bank_connections
      WHERE bank_connections.id = linked_accounts.connection_id
        AND bank_connections.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- sync_history: audit log for synchronization tasks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connection_id UUID NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,

  sync_type TEXT NOT NULL CHECK (sync_type IN ('accounts', 'transactions', 'balance')),
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial')),
  records_synced INTEGER DEFAULT 0,
  error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_history_connection ON sync_history(connection_id);
CREATE INDEX IF NOT EXISTS idx_sync_history_created ON sync_history(created_at DESC);

ALTER TABLE sync_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sync history"
  ON sync_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM bank_connections
      WHERE bank_connections.id = sync_history.connection_id
        AND bank_connections.user_id = auth.uid()
    )
  );
