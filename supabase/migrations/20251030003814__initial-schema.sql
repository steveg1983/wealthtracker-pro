--
-- PostgreSQL database dump
--

\restrict DFtg40lqIUw3isnnePZQnFeL5HlYY5FOhrwaVM20a86pCvHePwyXbALz34UiveM

-- Dumped from database version 17.4
-- Dumped by pg_dump version 18.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: cleanup_old_notifications(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_notifications() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM notifications
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;


--
-- Name: create_account_from_plaid(uuid, text, text, text, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_account_from_plaid(p_user_id uuid, p_plaid_account_id text, p_name text, p_type text, p_balance numeric, p_currency text) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_account_id UUID;
  v_account_type TEXT;
BEGIN
  -- Map Plaid account type to our account types
  v_account_type := CASE 
    WHEN p_type = 'depository' THEN 'checking'
    WHEN p_type = 'credit' THEN 'credit'
    WHEN p_type = 'loan' THEN 'loan'
    WHEN p_type = 'investment' THEN 'investment'
    ELSE 'other'
  END;

  -- Check if account already exists
  SELECT id INTO v_account_id
  FROM accounts
  WHERE user_id = p_user_id AND plaid_account_id = p_plaid_account_id;

  IF v_account_id IS NULL THEN
    -- Create new account
    INSERT INTO accounts (
      user_id,
      name,
      type,
      balance,
      currency,
      plaid_account_id,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      p_user_id,
      p_name,
      v_account_type,
      p_balance,
      p_currency,
      p_plaid_account_id,
      TRUE,
      NOW(),
      NOW()
    ) RETURNING id INTO v_account_id;
  ELSE
    -- Update existing account
    UPDATE accounts
    SET 
      balance = p_balance,
      updated_at = NOW()
    WHERE id = v_account_id;
  END IF;

  RETURN v_account_id;
END;
$$;


--
-- Name: create_transfer_category_for_account(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_transfer_category_for_account() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  transfer_type_id UUID;
BEGIN
  -- Find the Transfer type category for this user
  SELECT id INTO transfer_type_id
  FROM categories
  WHERE user_id = NEW.user_id
    AND name = 'Transfer'
    AND level = 'type'
  LIMIT 1;
  
  -- Create the transfer category for this account
  INSERT INTO categories (
    user_id,
    name,
    type,
    level,
    parent_id,
    is_system,
    is_transfer_category,
    account_id,
    is_active
  ) VALUES (
    NEW.user_id,
    'To/From ' || NEW.name,
    'both',
    'detail',
    transfer_type_id,
    FALSE,
    TRUE,
    NEW.id,
    TRUE
  );
  
  RETURN NEW;
END;
$$;


--
-- Name: ensure_single_default_layout(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_single_default_layout() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.is_default = TRUE THEN
    -- Set all other layouts for this user to non-default
    UPDATE dashboard_layouts
    SET is_default = FALSE
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_default = TRUE;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: get_net_worth(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_net_worth(p_user_id text) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
DECLARE
  total DECIMAL;
BEGIN
  SELECT COALESCE(SUM(
    CASE 
      WHEN type IN ('checking', 'savings', 'investment', 'cash') THEN balance
      WHEN type IN ('credit', 'loan') THEN -balance
      ELSE 0
    END
  ), 0) INTO total
  FROM accounts
  WHERE user_id = p_user_id AND is_active = true;
  
  RETURN total;
END;
$$;


--
-- Name: get_usage_limits(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_usage_limits(p_tier text) RETURNS TABLE(max_accounts integer, max_transactions integer, max_budgets integer, max_goals integer)
    LANGUAGE plpgsql
    AS $$
BEGIN
  CASE p_tier
    WHEN 'free' THEN
      RETURN QUERY SELECT 5, 100, 3, 3;
    WHEN 'premium' THEN
      RETURN QUERY SELECT -1, -1, -1, -1; -- -1 means unlimited
    WHEN 'pro' THEN
      RETURN QUERY SELECT -1, -1, -1, -1;
    ELSE
      RETURN QUERY SELECT 5, 100, 3, 3; -- Default to free limits
  END CASE;
END;
$$;


--
-- Name: get_user_subscription(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_subscription(p_user_id text) RETURNS TABLE(tier text, status text, trial_end timestamp with time zone, current_period_end timestamp with time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT s.tier, s.status, s.trial_end, s.current_period_end
  FROM subscriptions s
  WHERE s.user_id = p_user_id
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$;


--
-- Name: has_feature_access(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_feature_access(p_user_id text, p_feature text) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
  user_tier TEXT;
BEGIN
  SELECT tier INTO user_tier
  FROM subscriptions
  WHERE user_id = p_user_id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF user_tier IS NULL THEN
    user_tier := 'free';
  END IF;
  
  CASE p_feature
    WHEN 'advanced_reports' THEN
      RETURN user_tier IN ('premium', 'pro');
    WHEN 'csv_export' THEN
      RETURN user_tier IN ('premium', 'pro');
    WHEN 'api_access' THEN
      RETURN user_tier = 'pro';
    WHEN 'priority_support' THEN
      RETURN user_tier = 'pro';
    ELSE
      RETURN true;
  END CASE;
END;
$$;


--
-- Name: set_current_user_id(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_current_user_id(user_id text) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM set_config('app.current_user_id', user_id, false);
END;
$$;


--
-- Name: sync_user_subscription(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_user_subscription() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Update user_profiles when subscription changes
  UPDATE user_profiles
  SET 
    subscription_tier = NEW.tier,
    subscription_status = NEW.status,
    updated_at = NOW()
  WHERE id = NEW.user_id;
  
  -- Log the change
  INSERT INTO subscription_events (
    user_id,
    subscription_id,
    event_type,
    previous_tier,
    new_tier,
    previous_status,
    new_status
  ) VALUES (
    NEW.user_id,
    NEW.id,
    CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE 'updated' END,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.tier ELSE NULL END,
    NEW.tier,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
    NEW.status
  );
  
  RETURN NEW;
END;
$$;


--
-- Name: trigger_update_usage(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_update_usage() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM update_usage_counts(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_usage_counts(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_usage_counts(p_user_id text) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO subscription_usage (
    user_id,
    accounts_count,
    transactions_count,
    budgets_count,
    goals_count,
    last_calculated
  ) VALUES (
    p_user_id,
    (SELECT COUNT(*) FROM accounts WHERE user_id = p_user_id AND is_active = true),
    (SELECT COUNT(*) FROM transactions WHERE user_id = p_user_id),
    (SELECT COUNT(*) FROM budgets WHERE user_id = p_user_id AND is_active = true),
    (SELECT COUNT(*) FROM goals WHERE user_id = p_user_id),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    accounts_count = EXCLUDED.accounts_count,
    transactions_count = EXCLUDED.transactions_count,
    budgets_count = EXCLUDED.budgets_count,
    goals_count = EXCLUDED.goals_count,
    last_calculated = EXCLUDED.last_calculated,
    updated_at = NOW();
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    currency text DEFAULT 'GBP'::text,
    balance numeric(20,2) DEFAULT 0,
    initial_balance numeric(20,2) DEFAULT 0,
    icon text,
    color text,
    is_active boolean DEFAULT true,
    institution text,
    account_number text,
    sort_code text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb,
    plaid_account_id text,
    plaid_connection_id uuid,
    CONSTRAINT accounts_type_check CHECK ((type = ANY (ARRAY['checking'::text, 'savings'::text, 'credit'::text, 'cash'::text, 'investment'::text, 'loan'::text, 'assets'::text, 'other'::text])))
);

ALTER TABLE ONLY public.accounts REPLICA IDENTITY FULL;


--
-- Name: budgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budgets (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    amount numeric(20,2) NOT NULL,
    period text NOT NULL,
    category text,
    start_date date NOT NULL,
    end_date date,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb,
    category_id uuid,
    spent numeric(10,2) DEFAULT 0,
    rollover boolean DEFAULT false,
    rollover_amount numeric(10,2) DEFAULT 0,
    alert_threshold numeric(5,2) DEFAULT 80,
    notes text,
    CONSTRAINT budgets_period_check CHECK ((period = ANY (ARRAY['weekly'::text, 'biweekly'::text, 'monthly'::text, 'quarterly'::text, 'yearly'::text, 'custom'::text])))
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    level text NOT NULL,
    parent_id uuid,
    color text,
    icon text,
    is_system boolean DEFAULT false,
    is_transfer_category boolean DEFAULT false,
    account_id uuid,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT categories_level_check CHECK ((level = ANY (ARRAY['type'::text, 'sub'::text, 'detail'::text]))),
    CONSTRAINT categories_type_check CHECK ((type = ANY (ARRAY['income'::text, 'expense'::text, 'both'::text])))
);


--
-- Name: dashboard_layouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dashboard_layouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    widgets jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: goal_contributions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goal_contributions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    goal_id uuid NOT NULL,
    user_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    transaction_id uuid,
    date date NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goals (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    target_amount numeric(20,2) NOT NULL,
    current_amount numeric(20,2) DEFAULT 0,
    target_date date,
    category text,
    priority text,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    account_id uuid,
    contribution_frequency text,
    icon text,
    color text,
    auto_contribute boolean DEFAULT false,
    CONSTRAINT goals_contribution_frequency_check CHECK ((contribution_frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'biweekly'::text, 'monthly'::text, 'yearly'::text]))),
    CONSTRAINT goals_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
    CONSTRAINT goals_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'paused'::text, 'canceled'::text])))
);


--
-- Name: investment_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.investment_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    investment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    transaction_type text NOT NULL,
    quantity numeric(20,8) NOT NULL,
    price numeric(10,2) NOT NULL,
    total_amount numeric(10,2) NOT NULL,
    fees numeric(10,2) DEFAULT 0,
    date date NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT investment_transactions_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['buy'::text, 'sell'::text, 'dividend'::text, 'split'::text, 'transfer'::text])))
);


--
-- Name: investments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.investments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    account_id uuid,
    symbol text NOT NULL,
    name text NOT NULL,
    quantity numeric(20,8) NOT NULL,
    cost_basis numeric(10,2) NOT NULL,
    current_price numeric(10,2),
    market_value numeric(10,2),
    asset_type text NOT NULL,
    exchange text,
    currency text DEFAULT 'GBP'::text,
    purchase_date date,
    purchase_price numeric(10,2),
    last_updated timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT investments_asset_type_check CHECK ((asset_type = ANY (ARRAY['stock'::text, 'bond'::text, 'etf'::text, 'mutual_fund'::text, 'crypto'::text, 'commodity'::text, 'real_estate'::text, 'other'::text])))
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id_text text,
    stripe_invoice_id text NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    status text NOT NULL,
    paid_at timestamp with time zone,
    due_date timestamp with time zone,
    invoice_url text,
    invoice_pdf text,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    user_id uuid,
    CONSTRAINT invoices_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'open'::text, 'paid'::text, 'uncollectible'::text, 'void'::text])))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    message text,
    is_read boolean DEFAULT false,
    action_label text,
    action_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['info'::text, 'success'::text, 'warning'::text, 'error'::text])))
);


--
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_methods (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id_text text,
    stripe_payment_method_id text NOT NULL,
    last4 text NOT NULL,
    brand text NOT NULL,
    expiry_month integer NOT NULL,
    expiry_year integer NOT NULL,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    user_id uuid
);


--
-- Name: plaid_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plaid_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    connection_id uuid NOT NULL,
    account_id text NOT NULL,
    name text NOT NULL,
    official_name text,
    type text NOT NULL,
    subtype text NOT NULL,
    mask text,
    balance_current numeric(10,2),
    balance_available numeric(10,2),
    currency text DEFAULT 'USD'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: plaid_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plaid_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    institution_id text NOT NULL,
    institution_name text NOT NULL,
    item_id text NOT NULL,
    access_token text NOT NULL,
    status text DEFAULT 'active'::text,
    last_sync timestamp with time zone,
    error text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT plaid_connections_status_check CHECK ((status = ANY (ARRAY['active'::text, 'error'::text, 'updating'::text])))
);


--
-- Name: plaid_webhooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plaid_webhooks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    connection_id uuid,
    webhook_type text NOT NULL,
    webhook_code text NOT NULL,
    error text,
    processed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: recurring_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recurring_transactions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id text,
    account_id uuid,
    description text NOT NULL,
    amount numeric(15,2) NOT NULL,
    type text NOT NULL,
    category text NOT NULL,
    frequency text NOT NULL,
    start_date date NOT NULL,
    end_date date,
    next_date date NOT NULL,
    is_active boolean DEFAULT true,
    auto_create boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT recurring_transactions_frequency_check CHECK ((frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'biweekly'::text, 'monthly'::text, 'quarterly'::text, 'yearly'::text]))),
    CONSTRAINT recurring_transactions_type_check CHECK ((type = ANY (ARRAY['income'::text, 'expense'::text])))
);


--
-- Name: subscription_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_events (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id_text text,
    subscription_id uuid,
    event_type text NOT NULL,
    previous_tier text,
    new_tier text,
    previous_status text,
    new_status text,
    metadata jsonb,
    stripe_event_id text,
    created_at timestamp with time zone DEFAULT now(),
    user_id uuid
);


--
-- Name: subscription_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    event_id text NOT NULL,
    event_type text NOT NULL,
    processed boolean DEFAULT false,
    error_message text,
    payload jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: subscription_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_usage (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id_text text,
    accounts_count integer DEFAULT 0,
    transactions_count integer DEFAULT 0,
    budgets_count integer DEFAULT 0,
    goals_count integer DEFAULT 0,
    last_calculated timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    user_id uuid
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id_text text,
    stripe_subscription_id text,
    stripe_customer_id text,
    stripe_price_id text,
    tier text NOT NULL,
    status text NOT NULL,
    current_period_start timestamp with time zone,
    current_period_end timestamp with time zone,
    trial_start timestamp with time zone,
    trial_end timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancel_at_period_end boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    user_id uuid,
    CONSTRAINT subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'cancelled'::text, 'incomplete'::text, 'incomplete_expired'::text, 'past_due'::text, 'trialing'::text, 'unpaid'::text, 'paused'::text]))),
    CONSTRAINT subscriptions_tier_check CHECK ((tier = ANY (ARRAY['free'::text, 'premium'::text, 'pro'::text])))
);


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    account_id uuid NOT NULL,
    description text NOT NULL,
    amount numeric(20,2) NOT NULL,
    type text NOT NULL,
    date date NOT NULL,
    category text,
    notes text,
    tags text[],
    is_recurring boolean DEFAULT false,
    transfer_account_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb,
    category_id uuid,
    plaid_transaction_id text,
    plaid_account_id text,
    merchant_name text,
    location_city text,
    location_country text,
    payment_channel text,
    CONSTRAINT transactions_type_check CHECK ((type = ANY (ARRAY['income'::text, 'expense'::text, 'transfer'::text])))
);


--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    clerk_user_id text NOT NULL,
    email text NOT NULL,
    full_name text,
    subscription_tier text DEFAULT 'free'::text,
    subscription_status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT subscription_status_check CHECK ((subscription_status = ANY (ARRAY['active'::text, 'cancelled'::text, 'incomplete'::text, 'incomplete_expired'::text, 'past_due'::text, 'trialing'::text, 'unpaid'::text, 'paused'::text]))),
    CONSTRAINT subscription_tier_check CHECK ((subscription_tier = ANY (ARRAY['free'::text, 'premium'::text, 'pro'::text]))),
    CONSTRAINT user_profiles_subscription_status_check CHECK ((subscription_status = ANY (ARRAY['active'::text, 'canceled'::text, 'past_due'::text]))),
    CONSTRAINT user_profiles_subscription_tier_check CHECK ((subscription_tier = ANY (ARRAY['free'::text, 'pro'::text, 'business'::text])))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    clerk_id text NOT NULL,
    email text NOT NULL,
    first_name text,
    last_name text,
    avatar_url text,
    subscription_tier text DEFAULT 'free'::text,
    subscription_status text DEFAULT 'active'::text,
    stripe_customer_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_sync_at timestamp with time zone,
    settings jsonb DEFAULT '{}'::jsonb,
    preferences jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT users_subscription_status_check CHECK ((subscription_status = ANY (ARRAY['active'::text, 'past_due'::text, 'canceled'::text, 'trialing'::text]))),
    CONSTRAINT users_subscription_tier_check CHECK ((subscription_tier = ANY (ARRAY['free'::text, 'pro'::text, 'business'::text])))
);


--
-- Name: widget_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.widget_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    widget_type text NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_collapsed boolean DEFAULT false,
    last_refreshed timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_plaid_account_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_plaid_account_id_key UNIQUE (plaid_account_id);


--
-- Name: budgets budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_user_id_name_parent_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_user_id_name_parent_id_key UNIQUE (user_id, name, parent_id);


--
-- Name: dashboard_layouts dashboard_layouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_layouts
    ADD CONSTRAINT dashboard_layouts_pkey PRIMARY KEY (id);


--
-- Name: goal_contributions goal_contributions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_contributions
    ADD CONSTRAINT goal_contributions_pkey PRIMARY KEY (id);


--
-- Name: goals goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_pkey PRIMARY KEY (id);


--
-- Name: investment_transactions investment_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investment_transactions
    ADD CONSTRAINT investment_transactions_pkey PRIMARY KEY (id);


--
-- Name: investments investments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investments
    ADD CONSTRAINT investments_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_stripe_invoice_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_stripe_invoice_id_key UNIQUE (stripe_invoice_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);


--
-- Name: payment_methods payment_methods_stripe_payment_method_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_stripe_payment_method_id_key UNIQUE (stripe_payment_method_id);


--
-- Name: plaid_accounts plaid_accounts_account_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plaid_accounts
    ADD CONSTRAINT plaid_accounts_account_id_key UNIQUE (account_id);


--
-- Name: plaid_accounts plaid_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plaid_accounts
    ADD CONSTRAINT plaid_accounts_pkey PRIMARY KEY (id);


--
-- Name: plaid_connections plaid_connections_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plaid_connections
    ADD CONSTRAINT plaid_connections_item_id_key UNIQUE (item_id);


--
-- Name: plaid_connections plaid_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plaid_connections
    ADD CONSTRAINT plaid_connections_pkey PRIMARY KEY (id);


--
-- Name: plaid_connections plaid_connections_user_id_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plaid_connections
    ADD CONSTRAINT plaid_connections_user_id_item_id_key UNIQUE (user_id, item_id);


--
-- Name: plaid_webhooks plaid_webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plaid_webhooks
    ADD CONSTRAINT plaid_webhooks_pkey PRIMARY KEY (id);


--
-- Name: recurring_transactions recurring_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_transactions
    ADD CONSTRAINT recurring_transactions_pkey PRIMARY KEY (id);


--
-- Name: subscription_events subscription_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_events
    ADD CONSTRAINT subscription_events_pkey PRIMARY KEY (id);


--
-- Name: subscription_logs subscription_logs_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_logs
    ADD CONSTRAINT subscription_logs_event_id_key UNIQUE (event_id);


--
-- Name: subscription_logs subscription_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_logs
    ADD CONSTRAINT subscription_logs_pkey PRIMARY KEY (id);


--
-- Name: subscription_usage subscription_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_usage
    ADD CONSTRAINT subscription_usage_pkey PRIMARY KEY (id);


--
-- Name: subscription_usage subscription_usage_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_usage
    ADD CONSTRAINT subscription_usage_user_id_key UNIQUE (user_id_text);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_stripe_subscription_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_stripe_subscription_id_key UNIQUE (stripe_subscription_id);


--
-- Name: subscriptions subscriptions_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_unique UNIQUE (user_id_text);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_plaid_transaction_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_plaid_transaction_id_key UNIQUE (plaid_transaction_id);


--
-- Name: user_profiles unique_clerk_user_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT unique_clerk_user_id UNIQUE (clerk_user_id);


--
-- Name: user_profiles unique_email; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT unique_email UNIQUE (email);


--
-- Name: user_profiles user_profiles_clerk_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_clerk_user_id_key UNIQUE (clerk_user_id);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- Name: users users_clerk_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_clerk_id_key UNIQUE (clerk_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: widget_preferences widget_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.widget_preferences
    ADD CONSTRAINT widget_preferences_pkey PRIMARY KEY (id);


--
-- Name: widget_preferences widget_preferences_user_id_widget_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.widget_preferences
    ADD CONSTRAINT widget_preferences_user_id_widget_type_key UNIQUE (user_id, widget_type);


--
-- Name: idx_accounts_plaid_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_plaid_account_id ON public.accounts USING btree (plaid_account_id);


--
-- Name: idx_accounts_plaid_connection_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_plaid_connection_id ON public.accounts USING btree (plaid_connection_id);


--
-- Name: idx_accounts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_user_id ON public.accounts USING btree (user_id);


--
-- Name: idx_budgets_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budgets_user_id ON public.budgets USING btree (user_id);


--
-- Name: idx_categories_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_account_id ON public.categories USING btree (account_id);


--
-- Name: idx_categories_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_is_active ON public.categories USING btree (is_active);


--
-- Name: idx_categories_is_transfer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_is_transfer ON public.categories USING btree (is_transfer_category);


--
-- Name: idx_categories_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_parent_id ON public.categories USING btree (parent_id);


--
-- Name: idx_categories_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_user_id ON public.categories USING btree (user_id);


--
-- Name: idx_dashboard_layouts_is_default; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dashboard_layouts_is_default ON public.dashboard_layouts USING btree (is_default);


--
-- Name: idx_dashboard_layouts_one_default_per_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_dashboard_layouts_one_default_per_user ON public.dashboard_layouts USING btree (user_id) WHERE (is_default = true);


--
-- Name: idx_dashboard_layouts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dashboard_layouts_user_id ON public.dashboard_layouts USING btree (user_id);


--
-- Name: idx_events_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_subscription_id ON public.subscription_events USING btree (subscription_id);


--
-- Name: idx_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_type ON public.subscription_events USING btree (event_type);


--
-- Name: idx_events_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_user_id ON public.subscription_events USING btree (user_id_text);


--
-- Name: idx_goal_contributions_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_goal_contributions_date ON public.goal_contributions USING btree (date);


--
-- Name: idx_goal_contributions_goal_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_goal_contributions_goal_id ON public.goal_contributions USING btree (goal_id);


--
-- Name: idx_goal_contributions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_goal_contributions_user_id ON public.goal_contributions USING btree (user_id);


--
-- Name: idx_goals_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_goals_user_id ON public.goals USING btree (user_id);


--
-- Name: idx_investment_transactions_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_investment_transactions_date ON public.investment_transactions USING btree (date);


--
-- Name: idx_investment_transactions_investment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_investment_transactions_investment_id ON public.investment_transactions USING btree (investment_id);


--
-- Name: idx_investment_transactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_investment_transactions_user_id ON public.investment_transactions USING btree (user_id);


--
-- Name: idx_investments_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_investments_account_id ON public.investments USING btree (account_id);


--
-- Name: idx_investments_asset_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_investments_asset_type ON public.investments USING btree (asset_type);


--
-- Name: idx_investments_symbol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_investments_symbol ON public.investments USING btree (symbol);


--
-- Name: idx_investments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_investments_user_id ON public.investments USING btree (user_id);


--
-- Name: idx_invoices_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_status ON public.invoices USING btree (status);


--
-- Name: idx_invoices_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_user_id ON public.invoices USING btree (user_id_text);


--
-- Name: idx_notifications_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at DESC);


--
-- Name: idx_notifications_is_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_payment_methods_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_methods_user_id ON public.payment_methods USING btree (user_id_text);


--
-- Name: idx_plaid_accounts_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plaid_accounts_account_id ON public.plaid_accounts USING btree (account_id);


--
-- Name: idx_plaid_accounts_connection_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plaid_accounts_connection_id ON public.plaid_accounts USING btree (connection_id);


--
-- Name: idx_plaid_connections_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plaid_connections_item_id ON public.plaid_connections USING btree (item_id);


--
-- Name: idx_plaid_connections_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plaid_connections_status ON public.plaid_connections USING btree (status);


--
-- Name: idx_plaid_connections_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plaid_connections_user_id ON public.plaid_connections USING btree (user_id);


--
-- Name: idx_plaid_webhooks_connection_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plaid_webhooks_connection_id ON public.plaid_webhooks USING btree (connection_id);


--
-- Name: idx_plaid_webhooks_processed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plaid_webhooks_processed ON public.plaid_webhooks USING btree (processed);


--
-- Name: idx_recurring_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recurring_user_id ON public.recurring_transactions USING btree (user_id);


--
-- Name: idx_subscriptions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_status ON public.subscriptions USING btree (status);


--
-- Name: idx_subscriptions_stripe_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_stripe_id ON public.subscriptions USING btree (stripe_subscription_id);


--
-- Name: idx_subscriptions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions USING btree (user_id_text);


--
-- Name: idx_transactions_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_account_id ON public.transactions USING btree (account_id);


--
-- Name: idx_transactions_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_category_id ON public.transactions USING btree (category_id);


--
-- Name: idx_transactions_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_date ON public.transactions USING btree (date DESC);


--
-- Name: idx_transactions_plaid_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_plaid_account_id ON public.transactions USING btree (plaid_account_id);


--
-- Name: idx_transactions_plaid_transaction_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_plaid_transaction_id ON public.transactions USING btree (plaid_transaction_id);


--
-- Name: idx_transactions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_type ON public.transactions USING btree (type);


--
-- Name: idx_transactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_user_id ON public.transactions USING btree (user_id);


--
-- Name: idx_usage_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_user_id ON public.subscription_usage USING btree (user_id_text);


--
-- Name: idx_user_profiles_clerk_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_clerk_id ON public.user_profiles USING btree (clerk_user_id);


--
-- Name: idx_users_clerk_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_clerk_id ON public.users USING btree (clerk_id);


--
-- Name: idx_widget_preferences_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_widget_preferences_user_id ON public.widget_preferences USING btree (user_id);


--
-- Name: idx_widget_preferences_widget_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_widget_preferences_widget_type ON public.widget_preferences USING btree (widget_type);


--
-- Name: accounts create_transfer_category_on_account_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER create_transfer_category_on_account_insert AFTER INSERT ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.create_transfer_category_for_account();


--
-- Name: dashboard_layouts ensure_single_default_layout_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ensure_single_default_layout_trigger BEFORE INSERT OR UPDATE ON public.dashboard_layouts FOR EACH ROW EXECUTE FUNCTION public.ensure_single_default_layout();


--
-- Name: accounts update_accounts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: budgets update_budgets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: categories update_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: dashboard_layouts update_dashboard_layouts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_dashboard_layouts_updated_at BEFORE UPDATE ON public.dashboard_layouts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: goals update_goals_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: investments update_investments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_investments_updated_at BEFORE UPDATE ON public.investments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notifications update_notifications_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: plaid_accounts update_plaid_accounts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_plaid_accounts_updated_at BEFORE UPDATE ON public.plaid_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: plaid_connections update_plaid_connections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_plaid_connections_updated_at BEFORE UPDATE ON public.plaid_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: recurring_transactions update_recurring_transactions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_recurring_transactions_updated_at BEFORE UPDATE ON public.recurring_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: transactions update_transactions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: widget_preferences update_widget_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_widget_preferences_updated_at BEFORE UPDATE ON public.widget_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: accounts accounts_plaid_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_plaid_connection_id_fkey FOREIGN KEY (plaid_connection_id) REFERENCES public.plaid_connections(id);


--
-- Name: accounts accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: budgets budgets_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: budgets budgets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: categories categories_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: categories categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: categories categories_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: dashboard_layouts dashboard_layouts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_layouts
    ADD CONSTRAINT dashboard_layouts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: goal_contributions goal_contributions_goal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_contributions
    ADD CONSTRAINT goal_contributions_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES public.goals(id) ON DELETE CASCADE;


--
-- Name: goal_contributions goal_contributions_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_contributions
    ADD CONSTRAINT goal_contributions_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;


--
-- Name: goal_contributions goal_contributions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_contributions
    ADD CONSTRAINT goal_contributions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: goals goals_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: goals goals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: investment_transactions investment_transactions_investment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investment_transactions
    ADD CONSTRAINT investment_transactions_investment_id_fkey FOREIGN KEY (investment_id) REFERENCES public.investments(id) ON DELETE CASCADE;


--
-- Name: investment_transactions investment_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investment_transactions
    ADD CONSTRAINT investment_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: investments investments_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investments
    ADD CONSTRAINT investments_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: investments investments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investments
    ADD CONSTRAINT investments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: payment_methods payment_methods_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: plaid_accounts plaid_accounts_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plaid_accounts
    ADD CONSTRAINT plaid_accounts_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.plaid_connections(id) ON DELETE CASCADE;


--
-- Name: plaid_connections plaid_connections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plaid_connections
    ADD CONSTRAINT plaid_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: plaid_webhooks plaid_webhooks_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plaid_webhooks
    ADD CONSTRAINT plaid_webhooks_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.plaid_connections(id) ON DELETE CASCADE;


--
-- Name: recurring_transactions recurring_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_transactions
    ADD CONSTRAINT recurring_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(clerk_user_id) ON DELETE CASCADE;


--
-- Name: subscription_events subscription_events_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_events
    ADD CONSTRAINT subscription_events_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE CASCADE;


--
-- Name: subscription_events subscription_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_events
    ADD CONSTRAINT subscription_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: subscription_usage subscription_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_usage
    ADD CONSTRAINT subscription_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_transfer_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_transfer_account_id_fkey FOREIGN KEY (transfer_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: widget_preferences widget_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.widget_preferences
    ADD CONSTRAINT widget_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users Allow all for authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all for authenticated users" ON public.users USING (true);


--
-- Name: accounts Authenticated users can do everything with accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can do everything with accounts" ON public.accounts USING (true) WITH CHECK (true);


--
-- Name: budgets Authenticated users can do everything with budgets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can do everything with budgets" ON public.budgets USING (true) WITH CHECK (true);


--
-- Name: goals Authenticated users can do everything with goals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can do everything with goals" ON public.goals USING (true) WITH CHECK (true);


--
-- Name: users Authenticated users can do everything with users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can do everything with users" ON public.users USING (true) WITH CHECK (true);


--
-- Name: goal_contributions Enable all for goal_contributions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable all for goal_contributions" ON public.goal_contributions USING (true) WITH CHECK (true);


--
-- Name: investment_transactions Enable all for investment_transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable all for investment_transactions" ON public.investment_transactions USING (true) WITH CHECK (true);


--
-- Name: investments Enable all for investments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable all for investments" ON public.investments USING (true) WITH CHECK (true);


--
-- Name: user_profiles Enable all for users based on clerk_user_id; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable all for users based on clerk_user_id" ON public.user_profiles USING (true) WITH CHECK (true);


--
-- Name: categories Service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access" ON public.categories USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: subscription_logs Service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access" ON public.subscription_logs USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: plaid_webhooks System can manage webhooks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can manage webhooks" ON public.plaid_webhooks USING (true);


--
-- Name: categories Test harness categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Test harness categories" ON public.categories USING (((current_setting('app.test_user_id'::text, true) IS NOT NULL) AND (current_setting('app.test_user_id'::text, true) = (user_id)::text))) WITH CHECK (((current_setting('app.test_user_id'::text, true) IS NOT NULL) AND (current_setting('app.test_user_id'::text, true) = (user_id)::text)));


--
-- Name: dashboard_layouts Users can create own dashboard layouts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own dashboard layouts" ON public.dashboard_layouts FOR INSERT WITH CHECK (true);


--
-- Name: plaid_connections Users can create own plaid connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own plaid connections" ON public.plaid_connections FOR INSERT WITH CHECK (true);


--
-- Name: notifications Users can create their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own notifications" ON public.notifications FOR INSERT WITH CHECK (((auth.uid())::text = (user_id)::text));


--
-- Name: dashboard_layouts Users can delete own dashboard layouts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own dashboard layouts" ON public.dashboard_layouts FOR DELETE USING (true);


--
-- Name: plaid_connections Users can delete own plaid connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own plaid connections" ON public.plaid_connections FOR DELETE USING (true);


--
-- Name: notifications Users can delete their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own notifications" ON public.notifications FOR DELETE USING (((auth.uid())::text = (user_id)::text));


--
-- Name: recurring_transactions Users can manage own recurring; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own recurring" ON public.recurring_transactions USING ((user_id = current_setting('app.current_user_id'::text, true)));


--
-- Name: widget_preferences Users can manage own widget preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own widget preferences" ON public.widget_preferences USING (true);


--
-- Name: plaid_accounts Users can manage plaid accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage plaid accounts" ON public.plaid_accounts USING (true);


--
-- Name: users Users can manage their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own profile" ON public.users USING (((auth.uid())::text = clerk_id));


--
-- Name: dashboard_layouts Users can update own dashboard layouts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own dashboard layouts" ON public.dashboard_layouts FOR UPDATE USING (true);


--
-- Name: plaid_connections Users can update own plaid connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own plaid connections" ON public.plaid_connections FOR UPDATE USING (true);


--
-- Name: notifications Users can update their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (((auth.uid())::text = (user_id)::text));


--
-- Name: dashboard_layouts Users can view own dashboard layouts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own dashboard layouts" ON public.dashboard_layouts FOR SELECT USING (true);


--
-- Name: plaid_connections Users can view own plaid connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own plaid connections" ON public.plaid_connections FOR SELECT USING (true);


--
-- Name: widget_preferences Users can view own widget preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own widget preferences" ON public.widget_preferences FOR SELECT USING (true);


--
-- Name: plaid_accounts Users can view plaid accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view plaid accounts" ON public.plaid_accounts FOR SELECT USING (true);


--
-- Name: notifications Users can view their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (((auth.uid())::text = (user_id)::text));


--
-- Name: categories Users manage own categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own categories" ON public.categories USING (((auth.uid())::text = (user_id)::text)) WITH CHECK (((auth.uid())::text = (user_id)::text));


--
-- Name: accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: budgets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: categories categories_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_delete_own ON public.categories FOR DELETE TO authenticated, anon USING ((user_id = auth.uid()));


--
-- Name: categories categories_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_insert_own ON public.categories FOR INSERT TO authenticated, anon WITH CHECK ((user_id = auth.uid()));


--
-- Name: categories categories_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_select_own ON public.categories FOR SELECT TO authenticated, anon USING ((user_id = auth.uid()));


--
-- Name: categories categories_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_update_own ON public.categories FOR UPDATE TO authenticated, anon USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: dashboard_layouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dashboard_layouts ENABLE ROW LEVEL SECURITY;

--
-- Name: transactions delete_own_transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY delete_own_transactions ON public.transactions FOR DELETE USING ((((auth.jwt() ->> 'role'::text) = 'service_role'::text) OR ((auth.uid() IS NOT NULL) AND ((auth.uid())::text = (user_id)::text))));


--
-- Name: goal_contributions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.goal_contributions ENABLE ROW LEVEL SECURITY;

--
-- Name: goals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

--
-- Name: transactions insert_own_transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY insert_own_transactions ON public.transactions FOR INSERT WITH CHECK ((((auth.jwt() ->> 'role'::text) = 'service_role'::text) OR ((auth.uid())::text = (user_id)::text)));


--
-- Name: investment_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.investment_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: investments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_methods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

--
-- Name: plaid_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plaid_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: plaid_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plaid_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: plaid_webhooks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plaid_webhooks ENABLE ROW LEVEL SECURITY;

--
-- Name: recurring_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: transactions select_own_transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY select_own_transactions ON public.transactions FOR SELECT USING ((((auth.jwt() ->> 'role'::text) = 'service_role'::text) OR ((auth.uid())::text = (user_id)::text)));


--
-- Name: subscription_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

--
-- Name: subscription_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscription_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: subscription_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscription_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: transactions update_own_transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY update_own_transactions ON public.transactions FOR UPDATE USING ((((auth.jwt() ->> 'role'::text) = 'service_role'::text) OR ((auth.uid())::text = (user_id)::text))) WITH CHECK ((((auth.jwt() ->> 'role'::text) = 'service_role'::text) OR ((auth.uid())::text = (user_id)::text)));


--
-- Name: user_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: widget_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.widget_preferences ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict DFtg40lqIUw3isnnePZQnFeL5HlYY5FOhrwaVM20a86pCvHePwyXbALz34UiveM

