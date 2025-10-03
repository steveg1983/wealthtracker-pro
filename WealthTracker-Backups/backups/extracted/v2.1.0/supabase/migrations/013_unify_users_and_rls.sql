-- 013_unify_users_and_rls.sql
-- Consolidate on `public.users` and update FKs/RLS from any legacy `user_profiles` usage

-- Ensure users table exists with required columns
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free','pro','business')),
  subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active','past_due','canceled','trialing')),
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_sync_at TIMESTAMPTZ,
  settings JSONB DEFAULT '{}',
  preferences JSONB DEFAULT '{}'
);

-- If legacy user_profiles exists, migrate minimal data into users
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_profiles'
  ) THEN
    -- Insert any user_profiles rows missing in users (by clerk id)
    INSERT INTO public.users (id, clerk_id, email, first_name, last_name, subscription_tier, subscription_status, created_at, updated_at)
    SELECT up.id,
           up.clerk_user_id,
           COALESCE(up.email, 'unknown@example.com'),
           NULL,
           NULL,
           COALESCE(up.subscription_tier, 'free'),
           COALESCE(up.subscription_status, 'active'),
           COALESCE(up.created_at, NOW()),
           COALESCE(up.updated_at, NOW())
    FROM public.user_profiles up
    WHERE NOT EXISTS (
      SELECT 1 FROM public.users u WHERE u.clerk_id = up.clerk_user_id
    );
  END IF;
END$$;

-- Ensure FKs in child tables reference users(id)
-- Accounts
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='user_id'
  ) THEN
    -- Drop any existing FK and recreate to users
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      WHERE tc.table_schema='public' AND tc.table_name='accounts' AND tc.constraint_type='FOREIGN KEY'
    ) THEN
      ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_user_id_fkey;
    END IF;
    ALTER TABLE public.accounts
      ADD CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END$$;

-- Transactions
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='user_id'
  ) THEN
    ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END$$;

-- Budgets
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='budgets' AND column_name='user_id'
  ) THEN
    ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budgets_user_id_fkey;
    ALTER TABLE public.budgets
      ADD CONSTRAINT budgets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END$$;

-- Goals
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='goals' AND column_name='user_id'
  ) THEN
    ALTER TABLE public.goals DROP CONSTRAINT IF EXISTS goals_user_id_fkey;
    ALTER TABLE public.goals
      ADD CONSTRAINT goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END$$;

-- Categories
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='user_id'
  ) THEN
    ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_user_id_fkey;
    ALTER TABLE public.categories
      ADD CONSTRAINT categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END$$;

-- Subscription-related tables: subscriptions, subscription_usage, payment_methods, invoices, subscription_events
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='subscriptions' AND table_schema='public') THEN
    ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='subscription_usage' AND table_schema='public') THEN
    ALTER TABLE public.subscription_usage DROP CONSTRAINT IF EXISTS subscription_usage_user_id_fkey;
    ALTER TABLE public.subscription_usage
      ADD CONSTRAINT subscription_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='payment_methods' AND table_schema='public') THEN
    ALTER TABLE public.payment_methods DROP CONSTRAINT IF EXISTS payment_methods_user_id_fkey;
    ALTER TABLE public.payment_methods
      ADD CONSTRAINT payment_methods_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='invoices' AND table_schema='public') THEN
    ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_user_id_fkey;
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='subscription_events' AND table_schema='public') THEN
    ALTER TABLE public.subscription_events DROP CONSTRAINT IF EXISTS subscription_events_user_id_fkey;
    ALTER TABLE public.subscription_events
      ADD CONSTRAINT subscription_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END$$;

-- RLS NOTE:
-- This migration intentionally does not alter existing RLS policies to avoid breaking
-- clients that do not authenticate with Supabase Auth (e.g., using Clerk).
-- After wiring auth to Supabase (or using a backend with service role), add strict policies
-- referencing `users.clerk_id` or your chosen claims. For now, keep existing policies as-is.

-- Cleanup: optional removal of legacy table after verification (commented)
-- DROP TABLE IF EXISTS public.user_profiles CASCADE;
