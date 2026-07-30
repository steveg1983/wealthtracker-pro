-- Modernise notifications RLS onto the Clerk bridge.
--
-- The four original policies keyed on auth.uid(), which is ALWAYS NULL under
-- Clerk authentication — so every client call against this table has failed
-- closed since the Clerk migration, and the table was effectively
-- service-role-only. Fails-closed is safe, but it is also a silently dead
-- feature: notificationService has seven client call sites that could never
-- read or write a row.
--
-- Rewritten in the exact shape every other per-user table uses:
-- requesting_user_id() (SECURITY DEFINER, maps the JWT's clerk_id to
-- users.id), scoped TO authenticated. anon matches no policy and stays at
-- deny-all, which the old untargeted policies only achieved by accident.

DROP POLICY IF EXISTS "Users can create their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;

CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = public.requesting_user_id());

CREATE POLICY notifications_insert_own ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.requesting_user_id());

CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = public.requesting_user_id())
  WITH CHECK (user_id = public.requesting_user_id());

CREATE POLICY notifications_delete_own ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = public.requesting_user_id());
