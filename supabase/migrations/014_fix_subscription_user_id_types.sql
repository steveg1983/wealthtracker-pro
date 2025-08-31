-- 014_fix_subscription_user_id_types.sql
-- Align subscription-related tables' user_id columns to UUID and bind FKs to public.users(id)

-- Helper: safely convert text user_id to UUID via cast or users.clerk_id lookup
-- Pattern used per table:
-- 1) Add user_id_uuid UUID
-- 2) Fill UUID from cast where text looks like UUID
-- 3) Fill remaining via JOIN on users.clerk_id
-- 4) Swap columns and add FK

-- Subscriptions
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='subscriptions' AND column_name='user_id'
  ) THEN
    -- Only act if column is not already UUID
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='subscriptions' AND column_name='user_id' AND data_type='text'
    ) THEN
      ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS user_id_uuid UUID;

      -- Fill from cast where possible (UUID-looking strings)
      UPDATE public.subscriptions s
      SET user_id_uuid = s.user_id::uuid
      WHERE s.user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

      -- Fill remaining from users.clerk_id mapping
      UPDATE public.subscriptions s
      SET user_id_uuid = u.id
      FROM public.users u
      WHERE s.user_id_uuid IS NULL AND u.clerk_id = s.user_id;

      -- Swap columns
      ALTER TABLE public.subscriptions RENAME COLUMN user_id TO user_id_text;
      ALTER TABLE public.subscriptions RENAME COLUMN user_id_uuid TO user_id;
    END IF;

    -- Rebind FK
    ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END$$;

-- Subscription usage
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='subscription_usage' AND column_name='user_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='subscription_usage' AND column_name='user_id' AND data_type='text'
    ) THEN
      ALTER TABLE public.subscription_usage ADD COLUMN IF NOT EXISTS user_id_uuid UUID;

      UPDATE public.subscription_usage su
      SET user_id_uuid = su.user_id::uuid
      WHERE su.user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

      UPDATE public.subscription_usage su
      SET user_id_uuid = u.id
      FROM public.users u
      WHERE su.user_id_uuid IS NULL AND u.clerk_id = su.user_id;

      ALTER TABLE public.subscription_usage RENAME COLUMN user_id TO user_id_text;
      ALTER TABLE public.subscription_usage RENAME COLUMN user_id_uuid TO user_id;
    END IF;

    ALTER TABLE public.subscription_usage DROP CONSTRAINT IF EXISTS subscription_usage_user_id_fkey;
    ALTER TABLE public.subscription_usage
      ADD CONSTRAINT subscription_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END$$;

-- Payment methods
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='payment_methods' AND column_name='user_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='payment_methods' AND column_name='user_id' AND data_type='text'
    ) THEN
      ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS user_id_uuid UUID;

      UPDATE public.payment_methods pm
      SET user_id_uuid = pm.user_id::uuid
      WHERE pm.user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

      UPDATE public.payment_methods pm
      SET user_id_uuid = u.id
      FROM public.users u
      WHERE pm.user_id_uuid IS NULL AND u.clerk_id = pm.user_id;

      ALTER TABLE public.payment_methods RENAME COLUMN user_id TO user_id_text;
      ALTER TABLE public.payment_methods RENAME COLUMN user_id_uuid TO user_id;
    END IF;

    ALTER TABLE public.payment_methods DROP CONSTRAINT IF EXISTS payment_methods_user_id_fkey;
    ALTER TABLE public.payment_methods
      ADD CONSTRAINT payment_methods_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END$$;

-- Invoices
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='invoices' AND column_name='user_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='invoices' AND column_name='user_id' AND data_type='text'
    ) THEN
      ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS user_id_uuid UUID;

      UPDATE public.invoices i
      SET user_id_uuid = i.user_id::uuid
      WHERE i.user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

      UPDATE public.invoices i
      SET user_id_uuid = u.id
      FROM public.users u
      WHERE i.user_id_uuid IS NULL AND u.clerk_id = i.user_id;

      ALTER TABLE public.invoices RENAME COLUMN user_id TO user_id_text;
      ALTER TABLE public.invoices RENAME COLUMN user_id_uuid TO user_id;
    END IF;

    ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_user_id_fkey;
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END$$;

-- Subscription events
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='subscription_events' AND column_name='user_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='subscription_events' AND column_name='user_id' AND data_type='text'
    ) THEN
      ALTER TABLE public.subscription_events ADD COLUMN IF NOT EXISTS user_id_uuid UUID;

      UPDATE public.subscription_events se
      SET user_id_uuid = se.user_id::uuid
      WHERE se.user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

      UPDATE public.subscription_events se
      SET user_id_uuid = u.id
      FROM public.users u
      WHERE se.user_id_uuid IS NULL AND u.clerk_id = se.user_id;

      ALTER TABLE public.subscription_events RENAME COLUMN user_id TO user_id_text;
      ALTER TABLE public.subscription_events RENAME COLUMN user_id_uuid TO user_id;
    END IF;

    ALTER TABLE public.subscription_events DROP CONSTRAINT IF EXISTS subscription_events_user_id_fkey;
    ALTER TABLE public.subscription_events
      ADD CONSTRAINT subscription_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END$$;

