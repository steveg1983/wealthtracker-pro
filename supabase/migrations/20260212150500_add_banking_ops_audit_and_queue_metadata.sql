-- Banking operations hardening:
-- - Dead-letter queue metadata on bank_connections
-- - Persistent ops alert counters
-- - Dead-letter admin audit trail

-- ---------------------------------------------------------------------------
-- 1) Enrich bank_connections with queue metadata (idempotent)
-- ---------------------------------------------------------------------------
ALTER TABLE bank_connections
  ADD COLUMN IF NOT EXISTS queue_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS queue_last_error TEXT,
  ADD COLUMN IF NOT EXISTS queue_next_retry_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bank_connections_queue_attempts
  ON bank_connections(queue_attempts DESC)
  WHERE queue_attempts > 0;

CREATE INDEX IF NOT EXISTS idx_bank_connections_queue_retry_at
  ON bank_connections(queue_next_retry_at)
  WHERE queue_next_retry_at IS NOT NULL;

COMMENT ON COLUMN bank_connections.queue_attempts IS
  'Number of failed sync attempts currently queued for retry';
COMMENT ON COLUMN bank_connections.queue_last_error IS
  'Last queue processing error message for sync worker';
COMMENT ON COLUMN bank_connections.queue_next_retry_at IS
  'Timestamp when queue processor should retry this connection';

-- ---------------------------------------------------------------------------
-- 2) Ops alert counters table (idempotent)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS banking_ops_alert_counters (
  dedupe_key TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  suppressed_count INTEGER NOT NULL DEFAULT 0 CHECK (suppressed_count >= 0),
  last_sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_banking_ops_alert_counters_event_type
  ON banking_ops_alert_counters(event_type);

CREATE INDEX IF NOT EXISTS idx_banking_ops_alert_counters_suppressed
  ON banking_ops_alert_counters(suppressed_count DESC, updated_at DESC);

ALTER TABLE banking_ops_alert_counters ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'banking_ops_alert_counters'
      AND policyname = 'Service role manage ops alert counters'
  ) THEN
    CREATE POLICY "Service role manage ops alert counters"
      ON banking_ops_alert_counters
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

COMMENT ON TABLE banking_ops_alert_counters IS
  'Aggregated counters used by banking ops alert dashboards and suppression logic';

-- ---------------------------------------------------------------------------
-- 3) Dead-letter admin audit table (idempotent)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS banking_dead_letter_admin_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  admin_clerk_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('reset_dead_letter')),
  scope TEXT NOT NULL CHECK (scope IN ('single', 'bulk', 'all_dead_lettered')),
  reason TEXT,
  requested_count INTEGER NOT NULL DEFAULT 0 CHECK (requested_count >= 0),
  reset_count INTEGER NOT NULL DEFAULT 0 CHECK (reset_count >= 0),
  max_retry_attempts INTEGER,
  connection_ids TEXT[] NOT NULL DEFAULT '{}'::text[],
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_banking_dead_letter_admin_audit_created
  ON banking_dead_letter_admin_audit(created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_banking_dead_letter_admin_audit_status
  ON banking_dead_letter_admin_audit(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_banking_dead_letter_admin_audit_admin
  ON banking_dead_letter_admin_audit(admin_clerk_id, created_at DESC);

ALTER TABLE banking_dead_letter_admin_audit ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'banking_dead_letter_admin_audit'
      AND policyname = 'Service role manage dead-letter admin audit'
  ) THEN
    CREATE POLICY "Service role manage dead-letter admin audit"
      ON banking_dead_letter_admin_audit
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

COMMENT ON TABLE banking_dead_letter_admin_audit IS
  'Audit trail for manual dead-letter queue reset operations in banking control plane';
