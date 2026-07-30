-- Combined Open Banking migration for Clerk-based auth
-- Creates all banking tables with FK to public.users(id) instead of auth.users(id)
-- Run this in the Supabase SQL Editor

-- Enable pgcrypto for encryption utilities
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. bank_connections: stores provider metadata and encrypted credentials
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bank_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

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

  -- Token refresh tracking
  token_last_refreshed TIMESTAMPTZ,
  refresh_attempts INTEGER DEFAULT 0,
  needs_reauth BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_user_institution UNIQUE (user_id, institution_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_bank_connections_user_id ON bank_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_connections_status ON bank_connections(status);
CREATE INDEX IF NOT EXISTS idx_bank_connections_expires ON bank_connections(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bank_connections_refresh
  ON bank_connections(expires_at, token_last_refreshed)
  WHERE status = 'connected' AND expires_at IS NOT NULL;

ALTER TABLE bank_connections ENABLE ROW LEVEL SECURITY;

-- Service role bypass (API routes use service role key)
CREATE POLICY "Service role full access on bank_connections"
  ON bank_connections
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 2. linked_accounts: maps provider accounts to WealthTracker accounts
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

CREATE POLICY "Service role full access on linked_accounts"
  ON linked_accounts
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3. sync_history: audit log for synchronization tasks
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

CREATE POLICY "Service role full access on sync_history"
  ON sync_history
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 4. Transaction deduplication columns
-- ---------------------------------------------------------------------------
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS external_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS connection_id UUID REFERENCES bank_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_provider TEXT CHECK (external_provider IN ('truelayer', 'plaid'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_external_transaction
  ON transactions(connection_id, external_transaction_id)
  WHERE external_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_connection_id
  ON transactions(connection_id)
  WHERE connection_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. sync_metadata: per-connection sync state
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_metadata (
  connection_id UUID PRIMARY KEY REFERENCES bank_connections(id) ON DELETE CASCADE,

  last_accounts_sync TIMESTAMPTZ,
  last_transactions_sync TIMESTAMPTZ,
  last_balance_sync TIMESTAMPTZ,

  transactions_cursor TEXT,
  transactions_last_id TEXT,

  total_accounts_synced INTEGER DEFAULT 0,
  total_transactions_synced INTEGER DEFAULT 0,

  auto_sync_enabled BOOLEAN DEFAULT TRUE,
  sync_frequency_hours INTEGER DEFAULT 24,

  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sync_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on sync_metadata"
  ON sync_metadata
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 6. webhook_events: audit log for provider webhooks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL CHECK (provider IN ('truelayer', 'plaid')),
  event_type TEXT NOT NULL,
  connection_id UUID REFERENCES bank_connections(id) ON DELETE SET NULL,

  payload JSONB NOT NULL,

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'ignored')),
  processed_at TIMESTAMPTZ,
  error TEXT,

  signature_verified BOOLEAN DEFAULT FALSE,
  idempotency_key TEXT UNIQUE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON webhook_events(provider);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_connection ON webhook_events(connection_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON webhook_events(created_at DESC);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on webhook_events"
  ON webhook_events
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 7. Helper function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_connection_healthy(p_connection_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM bank_connections
    WHERE id = p_connection_id
      AND status = 'connected'
      AND (expires_at IS NULL OR expires_at > NOW() + INTERVAL '7 days')
      AND needs_reauth = FALSE
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- Done
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE 'Open Banking tables created successfully (Clerk-compatible)';
END $$;
