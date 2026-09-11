-- ============================================================================
-- 20260911170000_a_phone_that_hears_the_server.sql
--
-- PUSH NOTIFICATIONS: WHERE A PHONE LEAVES ITS TOKEN, AND WHAT THE SERVER
-- REMEMBERS HAVING SAID.
--
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor).
--
-- ── WHY (the owner, 11 Sep 2026) ─────────────────────────────────────────────
--
-- "Can we set up proper Apple notifications that actually pop up on people's
-- iPhone screens?" Every reminder the app has today is drawn by the page
-- while it is open; nothing can reach a lock screen. A push needs three
-- things this schema did not have: a place for a phone to register itself
-- (its APNs device token), a server that has something to say (the cloud
-- refresh, 20260911153000), and a memory of what it already said so a
-- reminder due at 08:30 is pushed once and not on every quarter-hour run.
--
-- ── push_devices ────────────────────────────────────────────────────────────
--
-- One row per (platform, token). A token identifies an app install on a
-- device and can rotate; the phone re-registers on every launch and upserts
-- on the token, so a rotated token is a new row and the old one goes stale.
-- Stale rows are retired by the SERVER when Apple answers 410 Unregistered —
-- `disabled_at` rather than a delete, so the reason is kept and a row is
-- never resurrected by a late upsert from an old launch.
--
-- The phone writes its own row under RLS — the same owner-only shape every
-- per-user table has used since 20260610130000 — and the server reads every
-- enabled row for a user with the service role. A token is not a secret
-- (Apple will only deliver to it from OUR key), but it is the owner's, and
-- one user must not be able to point another's phone at their own pushes.
--
-- ── push_notification_marks ─────────────────────────────────────────────────
--
-- The server's memory. One row per user, service-role only: nothing in the
-- app reads it, and a user editing it could only make their own reminders
-- repeat. `balance_reminder_notified_for` is the SCHEDULED MOMENT the last
-- push was for, not the time it was sent — so the question the cron asks is
-- "has this moment been announced?", which is the same question the in-app
-- card asks of `lastAcknowledged` (utils/balanceReminders.ts).
--
-- ── WHAT DOES NOT CHANGE ────────────────────────────────────────────────────
--
--  * No existing table gains, loses or alters a column.
--  * wipe_user_financial_data does not touch either table: a token is not
--    financial data, and erasing your transactions is not a request to stop
--    being reminded. Account deletion cascades both through `users`.
--  * Nothing here reads or writes an amount, and no push ever carries one:
--    a lock screen is read by whoever is holding the phone.
-- ============================================================================

-- ── Guard 1: this is the database this migration was written against ───────
DO $$
BEGIN
  IF to_regprocedure('public.requesting_user_id()') IS NULL THEN
    RAISE EXCEPTION 'wrong_base_missing_requesting_user_id: public.requesting_user_id() does not exist, so this database predates 20260610130000 and cannot express owner-only policies.'
      USING ERRCODE = 'P0001',
            HINT = 'Apply the migrations in order with `npm run db:migrate`.';
  END IF;
  IF to_regprocedure('public.update_updated_at_column()') IS NULL THEN
    RAISE EXCEPTION 'wrong_base_missing_update_updated_at_column: the shared updated_at trigger function is missing.'
      USING ERRCODE = 'P0001';
  END IF;
END
$$;

-- ── Guard 2: refuse a double-run, by name ───────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.push_devices') IS NOT NULL THEN
    RAISE EXCEPTION 'push_devices_already_exists: this migration has already been applied and must not run twice.'
      USING ERRCODE = 'P0001',
            HINT = 'If something needs changing, write a new migration for it.';
  END IF;
END
$$;

-- ── push_devices ────────────────────────────────────────────────────────────
CREATE TABLE public.push_devices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  platform         text NOT NULL,
  token            text NOT NULL,
  -- Which APNs host delivers to this token. A TestFlight or App Store build
  -- registers a production token; a build run from Xcode registers a sandbox
  -- one. The phone cannot tell which it is, so the server assumes production
  -- and corrects the row once Apple says BadDeviceToken there.
  apns_environment text NOT NULL DEFAULT 'production',
  app_version      text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  -- The phone's last launch that re-registered this token.
  last_seen_at     timestamptz NOT NULL DEFAULT now(),
  disabled_at      timestamptz,
  disabled_reason  text,

  CONSTRAINT push_devices_one_row_per_token UNIQUE (platform, token),
  CONSTRAINT push_devices_platform_known CHECK (platform IN ('ios')),
  CONSTRAINT push_devices_environment_known CHECK (apns_environment IN ('production', 'sandbox')),
  -- An APNs token is hex. Apple says not to assume its length, so the check
  -- is on the alphabet and a generous range, not on 64.
  CONSTRAINT push_devices_token_is_hex CHECK (token ~ '^[0-9a-fA-F]{16,512}$'),
  CONSTRAINT push_devices_disabled_reason_with_date CHECK (disabled_reason IS NULL OR disabled_at IS NOT NULL)
);

CREATE INDEX push_devices_user_enabled_idx
  ON public.push_devices (user_id)
  WHERE disabled_at IS NULL;

COMMENT ON TABLE public.push_devices IS
  'One row per app install that asked to be notified: the APNs device token the phone handed the app, who it belongs to, and whether Apple still delivers to it. Written by the phone under RLS; read and retired by the server. Holds no financial data.';

CREATE TRIGGER update_push_devices_updated_at
  BEFORE UPDATE ON public.push_devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY push_devices_select_own ON public.push_devices
  FOR SELECT TO authenticated
  USING (user_id = public.requesting_user_id());

CREATE POLICY push_devices_insert_own ON public.push_devices
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.requesting_user_id());

CREATE POLICY push_devices_update_own ON public.push_devices
  FOR UPDATE TO authenticated
  USING (user_id = public.requesting_user_id())
  WITH CHECK (user_id = public.requesting_user_id());

CREATE POLICY push_devices_delete_own ON public.push_devices
  FOR DELETE TO authenticated
  USING (user_id = public.requesting_user_id());

REVOKE ALL ON TABLE public.push_devices FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.push_devices TO authenticated;
GRANT ALL ON TABLE public.push_devices TO service_role;

-- ── push_notification_marks ─────────────────────────────────────────────────
CREATE TABLE public.push_notification_marks (
  user_id                       uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  -- The scheduled moment the last balance-reminder push announced.
  balance_reminder_notified_for timestamptz,
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.push_notification_marks IS
  'The server''s memory of what it has already pushed, one row per user. balance_reminder_notified_for is the SCHEDULED moment last announced, so a reminder is pushed once per moment however often the cron runs. Service-role only.';

CREATE TRIGGER update_push_notification_marks_updated_at
  BEFORE UPDATE ON public.push_notification_marks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS on with NO policies: the table is unreadable to every JWT role, and only
-- the service role (which bypasses RLS) can touch it. Both layers say no.
ALTER TABLE public.push_notification_marks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.push_notification_marks FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.push_notification_marks TO service_role;

-- ── Measured, not assumed ───────────────────────────────────────────────────
DO $$
BEGIN
  IF has_table_privilege('anon', 'public.push_devices', 'SELECT') THEN
    RAISE EXCEPTION 'anon can read push_devices; the REVOKE above did not take';
  END IF;
  IF has_table_privilege('authenticated', 'public.push_notification_marks', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated can read push_notification_marks; it must be service-role only';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'push_devices') <> 4 THEN
    RAISE EXCEPTION 'push_devices does not carry exactly four owner-only policies';
  END IF;
END
$$;

-- ============================================================================
-- VERIFICATION — read this output after applying
-- ============================================================================
-- 1. Both tables exist with RLS on. Expected: two rows, rls_enabled = true;
--    push_devices commands = 'DELETE, INSERT, SELECT, UPDATE', marks = NULL.
SELECT
  c.relname,
  c.relrowsecurity AS rls_enabled,
  (SELECT string_agg(p.cmd, ', ' ORDER BY p.cmd) FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS commands
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('push_devices', 'push_notification_marks')
ORDER BY c.relname;

-- 2. Privileges. Expected: push_devices → authenticated, service_role (and the
--    owner); push_notification_marks → service_role (and the owner) only.
SELECT table_name, string_agg(DISTINCT grantee::text, ', ' ORDER BY grantee::text) AS granted_to
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public' AND table_name IN ('push_devices', 'push_notification_marks')
 GROUP BY table_name ORDER BY table_name;

-- 3. No phone has registered yet. Expected: zero rows immediately after
--    applying; afterwards one row per install that asked to be notified.
SELECT platform, apns_environment, disabled_at IS NULL AS enabled, count(*)
  FROM public.push_devices
 GROUP BY platform, apns_environment, disabled_at IS NULL;
