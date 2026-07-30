-- Enhancement Migration for Open Banking
-- Adds transaction deduplication, CSRF state storage, and improved security
-- Run this AFTER 20250124_add_open_banking_tables.sql

-- ---------------------------------------------------------------------------
-- 1. Add transaction deduplication fields
-- ---------------------------------------------------------------------------

-- Add columns to track external transaction sources (prevents duplicates)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS external_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS connection_id UUID REFERENCES bank_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_provider TEXT CHECK (external_provider IN ('truelayer', 'plaid', NULL));

-- Create unique index to prevent duplicate transactions from same source
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_external_transaction
  ON transactions(connection_id, external_transaction_id)
  WHERE external_transaction_id IS NOT NULL;

-- Add index for querying transactions by connection
CREATE INDEX IF NOT EXISTS idx_transactions_connection_id
  ON transactions(connection_id)
  WHERE connection_id IS NOT NULL;

COMMENT ON COLUMN transactions.external_transaction_id IS
  'Unique ID from external provider (TrueLayer/Plaid) to prevent duplicate imports';
COMMENT ON COLUMN transactions.connection_id IS
  'Links transaction to bank connection that imported it';
COMMENT ON COLUMN transactions.external_provider IS
  'Which provider imported this transaction (truelayer, plaid, or null for manual)';

-- ---------------------------------------------------------------------------
-- 2. Create oauth_states table for CSRF protection
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS oauth_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state_token TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL CHECK (provider IN ('truelayer', 'plaid')),

  -- Store redirect info for after auth completes
  redirect_uri TEXT,
  metadata JSONB DEFAULT '{}',

  -- Short TTL (10 minutes)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes'),

  -- Track if state was used (prevent replay attacks)
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ
);

-- Index for fast state lookups during OAuth callback
CREATE INDEX IF NOT EXISTS idx_oauth_states_token ON oauth_states(state_token);
CREATE INDEX IF NOT EXISTS idx_oauth_states_user ON oauth_states(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);

-- RLS policies
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own oauth states"
  ON oauth_states
  USING (auth.uid() = user_id);

COMMENT ON TABLE oauth_states IS
  'Temporary storage for OAuth CSRF state tokens (10 minute TTL)';

-- ---------------------------------------------------------------------------
-- 3. Create function to clean up expired OAuth states
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM oauth_states
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_expired_oauth_states IS
  'Removes expired OAuth state tokens. Should be run on a schedule (e.g., every hour)';

-- ---------------------------------------------------------------------------
-- 4. Add token refresh tracking to bank_connections
-- ---------------------------------------------------------------------------

ALTER TABLE bank_connections
  ADD COLUMN IF NOT EXISTS token_last_refreshed TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refresh_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS needs_reauth BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN bank_connections.token_last_refreshed IS
  'When access token was last refreshed (TrueLayer tokens expire after 90 days)';
COMMENT ON COLUMN bank_connections.refresh_attempts IS
  'Number of failed refresh attempts (reset on success, trigger reauth after 3 failures)';
COMMENT ON COLUMN bank_connections.needs_reauth IS
  'Flag set when refresh fails and user needs to reauthorize';

-- Index for finding connections that need token refresh
CREATE INDEX IF NOT EXISTS idx_bank_connections_refresh
  ON bank_connections(expires_at, token_last_refreshed)
  WHERE status = 'connected' AND expires_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. Add webhook event log table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL CHECK (provider IN ('truelayer', 'plaid')),
  event_type TEXT NOT NULL,
  connection_id UUID REFERENCES bank_connections(id) ON DELETE SET NULL,

  -- Raw webhook payload
  payload JSONB NOT NULL,

  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'ignored')),
  processed_at TIMESTAMPTZ,
  error TEXT,

  -- Webhook metadata
  signature_verified BOOLEAN DEFAULT FALSE,
  idempotency_key TEXT UNIQUE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON webhook_events(provider);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_connection ON webhook_events(connection_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON webhook_events(created_at DESC);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Service role only for webhook processing
CREATE POLICY "Service role can manage webhook events"
  ON webhook_events
  USING (auth.role() = 'service_role');

COMMENT ON TABLE webhook_events IS
  'Audit log of all webhook events from Open Banking providers';
COMMENT ON COLUMN webhook_events.idempotency_key IS
  'Prevents processing duplicate webhook deliveries';

-- ---------------------------------------------------------------------------
-- 6. Add sync metadata table for better sync management
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sync_metadata (
  connection_id UUID PRIMARY KEY REFERENCES bank_connections(id) ON DELETE CASCADE,

  -- Last successful sync timestamps per type
  last_accounts_sync TIMESTAMPTZ,
  last_transactions_sync TIMESTAMPTZ,
  last_balance_sync TIMESTAMPTZ,

  -- Sync cursors/pagination tokens (provider-specific)
  transactions_cursor TEXT,
  transactions_last_id TEXT,

  -- Stats
  total_accounts_synced INTEGER DEFAULT 0,
  total_transactions_synced INTEGER DEFAULT 0,

  -- Auto-sync settings (per connection override)
  auto_sync_enabled BOOLEAN DEFAULT TRUE,
  sync_frequency_hours INTEGER DEFAULT 24,

  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sync_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync metadata"
  ON sync_metadata FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bank_connections
      WHERE bank_connections.id = sync_metadata.connection_id
        AND bank_connections.user_id = auth.uid()
    )
  );

COMMENT ON TABLE sync_metadata IS
  'Per-connection sync state and configuration';

-- ---------------------------------------------------------------------------
-- 7. Create helper function to validate connection status
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION is_connection_healthy(connection_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM bank_connections
    WHERE id = connection_id
      AND status = 'connected'
      AND (expires_at IS NULL OR expires_at > NOW() + INTERVAL '7 days')
      AND needs_reauth = FALSE
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION is_connection_healthy IS
  'Checks if a bank connection is healthy (connected, not expiring soon, not needing reauth)';

-- ---------------------------------------------------------------------------
-- Migration Complete
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE 'Open Banking enhancement migration completed successfully';
  RAISE NOTICE 'Added: transaction deduplication, OAuth state management, webhook logging';
  RAISE NOTICE 'Next steps: Run cleanup_expired_oauth_states() on a schedule';
END $$;
