-- cloud_refresh_due_connections(): the cron's due-list, proven on a real server.
--
-- 20260911153000_a_feed_that_refreshes_while_you_sleep.sql reads the cloud
-- choice out of the preferences DOCUMENT — a JSON string two levels down a
-- jsonb column — and lists the healthy connections of users who made it,
-- neither synced nor attempted since a cutoff. Every branch of that sentence
-- is a row below, and the negative ones (garbage document, other mode, the
-- reauth'd row, the recently attempted row) are what make the positive one
-- mean something.
\set ON_ERROR_STOP on
\timing off

\set CLOUD  '''c1000000-0000-0000-0000-000000000001'''
\set OPEN   '''c1000000-0000-0000-0000-000000000002'''
\set BROKEN '''c1000000-0000-0000-0000-000000000003'''
\set NOPREF '''c1000000-0000-0000-0000-000000000004'''

DELETE FROM public.bank_connections WHERE user_id IN (:CLOUD, :OPEN, :BROKEN, :NOPREF);
DELETE FROM public.user_preferences WHERE user_id IN (:CLOUD, :OPEN, :BROKEN, :NOPREF);
DELETE FROM public.users WHERE id IN (:CLOUD, :OPEN, :BROKEN, :NOPREF);

INSERT INTO public.users (id, clerk_id, email) VALUES
  (:CLOUD,  'clerk_cloud',  'cloud@example.test'),
  (:OPEN,   'clerk_open',   'open@example.test'),
  (:BROKEN, 'clerk_broken', 'broken@example.test'),
  (:NOPREF, 'clerk_nopref', 'nopref@example.test');

-- The document as the client writes it: the value is a STRING holding JSON.
INSERT INTO public.user_preferences (user_id, prefs) VALUES
  (:CLOUD,  jsonb_build_object('version', 1, 'values', jsonb_build_object('bankAutoSync.prefs.v1', '{"mode":"cloud","dailyTime":"08:00"}'))),
  (:OPEN,   jsonb_build_object('version', 1, 'values', jsonb_build_object('bankAutoSync.prefs.v1', '{"mode":"signin","dailyTime":"08:00"}'))),
  (:BROKEN, jsonb_build_object('version', 1, 'values', jsonb_build_object('bankAutoSync.prefs.v1', '{not json'))),
  (:NOPREF, jsonb_build_object('version', 1, 'values', '{}'::jsonb));

-- Five connections for the cloud user, one each for the others.
INSERT INTO public.bank_connections
  (id, user_id, provider, institution_id, institution_name, access_token_encrypted, status, needs_reauth, last_sync, cloud_refresh_attempted_at)
VALUES
  -- due: never synced, never attempted → sorts first
  ('c2000000-0000-0000-0000-000000000001', :CLOUD, 'truelayer', 'inst-a', 'Never Bank',    'x', 'connected', false, NULL, NULL),
  -- due: synced long ago
  ('c2000000-0000-0000-0000-000000000002', :CLOUD, 'truelayer', 'inst-b', 'Stale Bank',    'x', 'connected', false, now() - interval '9 hours', NULL),
  -- NOT due: synced an hour ago (a person pressed refresh)
  ('c2000000-0000-0000-0000-000000000003', :CLOUD, 'truelayer', 'inst-c', 'Fresh Bank',    'x', 'connected', false, now() - interval '1 hour', NULL),
  -- NOT due: synced long ago but ATTEMPTED an hour ago and failed — PSD2's cap
  ('c2000000-0000-0000-0000-000000000004', :CLOUD, 'truelayer', 'inst-d', 'Failing Bank',  'x', 'connected', false, now() - interval '9 hours', now() - interval '1 hour'),
  -- NOT due: waiting on the owner to reconnect
  ('c2000000-0000-0000-0000-000000000005', :CLOUD, 'truelayer', 'inst-e', 'Expired Bank',  'x', 'reauth_required', true, NULL, NULL),
  -- NOT due: the user chose 'signin', not 'cloud'
  ('c2000000-0000-0000-0000-000000000006', :OPEN,   'truelayer', 'inst-f', 'Open Bank',     'x', 'connected', false, NULL, NULL),
  -- NOT due: the document does not parse — a user in no mode, not an error
  ('c2000000-0000-0000-0000-000000000007', :BROKEN, 'truelayer', 'inst-g', 'Garbage Bank',  'x', 'connected', false, NULL, NULL),
  -- NOT due: no preference at all
  ('c2000000-0000-0000-0000-000000000008', :NOPREF, 'truelayer', 'inst-h', 'Default Bank',  'x', 'connected', false, NULL, NULL);

-- (a) exactly the two due rows, oldest first
SELECT
  (SELECT count(*) FROM public.cloud_refresh_due_connections(now() - interval '6 hours', 100)) = 2
    AS a_two_connections_due_correct,
  (SELECT array_agg(institution_name ORDER BY ord)
     FROM (SELECT institution_name, row_number() OVER () AS ord
             FROM public.cloud_refresh_due_connections(now() - interval '6 hours', 100)) s)
    = ARRAY['Never Bank', 'Stale Bank']
    AS a_never_synced_sorts_first_correct;

-- (b) the exclusions, each by name
SELECT
  NOT EXISTS (SELECT 1 FROM public.cloud_refresh_due_connections(now() - interval '6 hours', 100) WHERE institution_name = 'Fresh Bank')
    AS b_recent_success_not_due_correct,
  NOT EXISTS (SELECT 1 FROM public.cloud_refresh_due_connections(now() - interval '6 hours', 100) WHERE institution_name = 'Failing Bank')
    AS b_recent_attempt_not_due_correct,
  NOT EXISTS (SELECT 1 FROM public.cloud_refresh_due_connections(now() - interval '6 hours', 100) WHERE institution_name = 'Expired Bank')
    AS b_reauth_required_not_due_correct,
  NOT EXISTS (SELECT 1 FROM public.cloud_refresh_due_connections(now() - interval '6 hours', 100) WHERE user_id <> :CLOUD)
    AS b_only_cloud_mode_users_correct;

-- (c) the garbage document raised nothing — the call above already proved it
--     by returning — and the limit is honoured
SELECT
  (SELECT count(*) FROM public.cloud_refresh_due_connections(now() - interval '6 hours', 1)) = 1
    AS c_limit_honoured_correct,
  (SELECT count(*) FROM public.cloud_refresh_due_connections(now() - interval '6 hours', 0)) = 0
    AS c_zero_limit_lists_nothing_correct;

-- (d) after the cron stamps an attempt, the row leaves the list for the interval
UPDATE public.bank_connections SET cloud_refresh_attempted_at = now()
 WHERE id = 'c2000000-0000-0000-0000-000000000001';
SELECT
  NOT EXISTS (SELECT 1 FROM public.cloud_refresh_due_connections(now() - interval '6 hours', 100) WHERE institution_name = 'Never Bank')
    AS d_stamped_attempt_leaves_the_list_correct,
  EXISTS (SELECT 1 FROM public.cloud_refresh_due_connections(now() + interval '7 hours', 100) WHERE institution_name = 'Never Bank')
    AS d_and_returns_once_the_interval_passes_correct;

-- (e) who may ask
SELECT
  NOT has_function_privilege('anon', 'public.cloud_refresh_due_connections(timestamptz, integer)', 'EXECUTE')
    AS e_anon_cannot_list_connections_correct,
  NOT has_function_privilege('authenticated', 'public.cloud_refresh_due_connections(timestamptz, integer)', 'EXECUTE')
    AS e_signed_in_user_cannot_list_connections_correct,
  has_function_privilege('service_role', 'public.cloud_refresh_due_connections(timestamptz, integer)', 'EXECUTE')
    AS e_service_role_can_correct;

-- teardown
DELETE FROM public.bank_connections WHERE user_id IN (:CLOUD, :OPEN, :BROKEN, :NOPREF);
DELETE FROM public.user_preferences WHERE user_id IN (:CLOUD, :OPEN, :BROKEN, :NOPREF);
DELETE FROM public.users WHERE id IN (:CLOUD, :OPEN, :BROKEN, :NOPREF);
