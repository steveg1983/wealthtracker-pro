-- ============================================================================
-- FINANCIAL AUDIT LOG RETENTION (GDPR Art. 5(1)(e) — storage limitation)
-- ============================================================================
-- financial_audit_log previously grew unbounded; its before/after snapshots
-- make it a growing store of financial PII. Retention default: 6 years
-- (2190 days), matching UK financial record-keeping convention (HMRC), then
-- purge. Invoked by the weekly retention cron (api/cron/retention.ts);
-- callable manually with a different window if policy changes.

BEGIN;

CREATE OR REPLACE FUNCTION public.purge_expired_audit_log(
  p_retain_days integer DEFAULT 2190
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF p_retain_days < 365 THEN
    -- Guard against accidental mass-purges: financial audit records must be
    -- retained for at least a year regardless of caller input.
    RAISE EXCEPTION 'retention_window_too_short' USING ERRCODE = 'P0005';
  END IF;

  DELETE FROM public.financial_audit_log
   WHERE created_at < now() - make_interval(days => p_retain_days);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- service_role only — retention runs from the scheduled job, never clients.
REVOKE ALL ON FUNCTION public.purge_expired_audit_log(integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_audit_log(integer) TO service_role;

COMMIT;
