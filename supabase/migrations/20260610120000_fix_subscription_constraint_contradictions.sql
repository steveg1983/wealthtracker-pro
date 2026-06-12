-- Fix contradictory CHECK constraints on user_profiles and users.
--
-- Problem: user_profiles carried TWO constraints per column with different
-- vocabularies. The intersection was the only storable set:
--   tier:   subscription_tier_check ('free','premium','pro')
--         ∩ user_profiles_subscription_tier_check ('free','pro','business')
--         = ('free','pro')  →  the 'premium' paid tier could NOT be stored.
--   status: subscription_status_check (8 values incl. 'cancelled')
--         ∩ user_profiles_subscription_status_check ('active','canceled','past_due')
--         = ('active','past_due')  →  cancellation could NOT be recorded.
--
-- The sync_user_subscription() trigger copies subscriptions.tier/status into
-- user_profiles, so a premium subscription would make the trigger fail.
--
-- Canonical vocabulary = the subscriptions table (source of truth):
--   tier:   'free' | 'premium' | 'pro'
--   status: 'active' | 'cancelled' | 'incomplete' | 'incomplete_expired'
--         | 'past_due' | 'trialing' | 'unpaid' | 'paused'
-- (Note: schema uses British 'cancelled'; the Stripe webhook layer is
--  responsible for mapping Stripe's 'canceled' → 'cancelled'.)

BEGIN;

-- ── user_profiles: drop the stale duplicate pair ────────────────────────────
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_subscription_status_check;

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_subscription_tier_check;

-- Recreate the surviving pair idempotently so the canonical definition is
-- explicit in this migration (no-op if already correct).
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS subscription_status_check;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT subscription_status_check CHECK (
    subscription_status = ANY (ARRAY[
      'active'::text, 'cancelled'::text, 'incomplete'::text,
      'incomplete_expired'::text, 'past_due'::text, 'trialing'::text,
      'unpaid'::text, 'paused'::text
    ])
  );

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS subscription_tier_check;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT subscription_tier_check CHECK (
    subscription_tier = ANY (ARRAY['free'::text, 'premium'::text, 'pro'::text])
  );

-- ── users: align with the same canonical vocabulary ────────────────────────
-- Normalise any legacy values that the new constraints would reject.
UPDATE public.users
  SET subscription_status = 'cancelled'
  WHERE subscription_status = 'canceled';

UPDATE public.users
  SET subscription_tier = 'pro'
  WHERE subscription_tier = 'business';

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_subscription_status_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_subscription_status_check CHECK (
    subscription_status = ANY (ARRAY[
      'active'::text, 'cancelled'::text, 'incomplete'::text,
      'incomplete_expired'::text, 'past_due'::text, 'trialing'::text,
      'unpaid'::text, 'paused'::text
    ])
  );

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_subscription_tier_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_subscription_tier_check CHECK (
    subscription_tier = ANY (ARRAY['free'::text, 'premium'::text, 'pro'::text])
  );

COMMIT;
