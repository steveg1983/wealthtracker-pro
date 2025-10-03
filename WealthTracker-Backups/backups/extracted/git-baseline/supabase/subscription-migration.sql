-- WealthTracker Subscription Migration
-- Add Stripe subscription management tables
-- Run this after the main schema.sql

-- ========================================
-- UPDATE USER PROFILES TABLE
-- ========================================
-- Update subscription tiers to match Stripe integration
ALTER TABLE user_profiles 
ALTER COLUMN subscription_tier DROP DEFAULT,
ADD CONSTRAINT subscription_tier_check CHECK (subscription_tier IN ('free', 'premium', 'pro'));

-- Update subscription status to include all Stripe statuses
ALTER TABLE user_profiles 
ALTER COLUMN subscription_status DROP DEFAULT,
ADD CONSTRAINT subscription_status_check CHECK (
  subscription_status IN ('active', 'cancelled', 'incomplete', 'incomplete_expired', 'past_due', 'trialing', 'unpaid', 'paused')
);

-- Set new defaults
ALTER TABLE user_profiles 
ALTER COLUMN subscription_tier SET DEFAULT 'free',
ALTER COLUMN subscription_status SET DEFAULT 'active';

-- ========================================
-- SUBSCRIPTIONS TABLE
-- ========================================
-- Detailed subscription information from Stripe
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  stripe_price_id TEXT,
  tier TEXT NOT NULL CHECK (tier IN ('free', 'premium', 'pro')),
  status TEXT NOT NULL CHECK (
    status IN ('active', 'cancelled', 'incomplete', 'incomplete_expired', 'past_due', 'trialing', 'unpaid', 'paused')
  ),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- ========================================
-- SUBSCRIPTION USAGE TABLE
-- ========================================
-- Track usage against subscription limits
CREATE TABLE IF NOT EXISTS subscription_usage (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  accounts_count INTEGER DEFAULT 0,
  transactions_count INTEGER DEFAULT 0,
  budgets_count INTEGER DEFAULT 0,
  goals_count INTEGER DEFAULT 0,
  last_calculated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX idx_usage_user_id ON subscription_usage(user_id);

-- ========================================
-- PAYMENT METHODS TABLE
-- ========================================
-- Store Stripe payment method information
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  stripe_payment_method_id TEXT UNIQUE NOT NULL,
  last4 TEXT NOT NULL,
  brand TEXT NOT NULL,
  expiry_month INTEGER NOT NULL,
  expiry_year INTEGER NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payment_methods_user_id ON payment_methods(user_id);

-- ========================================
-- INVOICES TABLE
-- ========================================
-- Store Stripe invoice information
CREATE TABLE IF NOT EXISTS invoices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT UNIQUE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL CHECK (status IN ('draft', 'open', 'paid', 'uncollectible', 'void')),
  paid_at TIMESTAMP WITH TIME ZONE,
  due_date TIMESTAMP WITH TIME ZONE,
  invoice_url TEXT,
  invoice_pdf TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_invoices_status ON invoices(status);

-- ========================================
-- SUBSCRIPTION EVENTS TABLE
-- ========================================
-- Log subscription changes for audit trail
CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'created', 'updated', 'cancelled', 'trial_ended', etc.
  previous_tier TEXT,
  new_tier TEXT,
  previous_status TEXT,
  new_status TEXT,
  metadata JSONB,
  stripe_event_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_events_user_id ON subscription_events(user_id);
CREATE INDEX idx_events_subscription_id ON subscription_events(subscription_id);
CREATE INDEX idx_events_type ON subscription_events(event_type);

-- ========================================
-- ROW LEVEL SECURITY
-- ========================================
-- Enable RLS on new tables
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

-- Subscriptions Policies
CREATE POLICY "Users can view own subscriptions" ON subscriptions
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM user_profiles 
      WHERE clerk_user_id = current_setting('app.current_user_id', true)
    )
  );

CREATE POLICY "Users can update own subscriptions" ON subscriptions
  FOR UPDATE USING (
    user_id IN (
      SELECT id FROM user_profiles 
      WHERE clerk_user_id = current_setting('app.current_user_id', true)
    )
  );

CREATE POLICY "Users can insert own subscriptions" ON subscriptions
  FOR INSERT WITH CHECK (
    user_id IN (
      SELECT id FROM user_profiles 
      WHERE clerk_user_id = current_setting('app.current_user_id', true)
    )
  );

-- Usage Policies
CREATE POLICY "Users can view own usage" ON subscription_usage
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM user_profiles 
      WHERE clerk_user_id = current_setting('app.current_user_id', true)
    )
  );

CREATE POLICY "Users can update own usage" ON subscription_usage
  FOR ALL USING (
    user_id IN (
      SELECT id FROM user_profiles 
      WHERE clerk_user_id = current_setting('app.current_user_id', true)
    )
  );

-- Payment Methods Policies
CREATE POLICY "Users can view own payment methods" ON payment_methods
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM user_profiles 
      WHERE clerk_user_id = current_setting('app.current_user_id', true)
    )
  );

CREATE POLICY "Users can manage own payment methods" ON payment_methods
  FOR ALL USING (
    user_id IN (
      SELECT id FROM user_profiles 
      WHERE clerk_user_id = current_setting('app.current_user_id', true)
    )
  );

-- Invoices Policies  
CREATE POLICY "Users can view own invoices" ON invoices
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM user_profiles 
      WHERE clerk_user_id = current_setting('app.current_user_id', true)
    )
  );

-- Events Policies (read-only for users)
CREATE POLICY "Users can view own subscription events" ON subscription_events
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM user_profiles 
      WHERE clerk_user_id = current_setting('app.current_user_id', true)
    )
  );

-- ========================================
-- HELPER FUNCTIONS
-- ========================================

-- Function to get user's current subscription
CREATE OR REPLACE FUNCTION get_user_subscription(p_user_id UUID)
RETURNS TABLE (
  tier TEXT,
  status TEXT,
  trial_end TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT s.tier, s.status, s.trial_end, s.current_period_end
  FROM subscriptions s
  WHERE s.user_id = p_user_id
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user has feature access
CREATE OR REPLACE FUNCTION has_feature_access(p_user_id UUID, p_feature TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_tier TEXT;
BEGIN
  -- Get user's current tier
  SELECT tier INTO user_tier
  FROM subscriptions
  WHERE user_id = p_user_id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Default to free if no subscription found
  IF user_tier IS NULL THEN
    user_tier := 'free';
  END IF;
  
  -- Check feature access based on tier
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
      RETURN true; -- Default to allow basic features
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to get usage limits for tier
CREATE OR REPLACE FUNCTION get_usage_limits(p_tier TEXT)
RETURNS TABLE (
  max_accounts INTEGER,
  max_transactions INTEGER,
  max_budgets INTEGER,
  max_goals INTEGER
) AS $$
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
$$ LANGUAGE plpgsql;

-- Function to update usage counts
CREATE OR REPLACE FUNCTION update_usage_counts(p_user_id UUID)
RETURNS void AS $$
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
$$ LANGUAGE plpgsql;

-- ========================================
-- TRIGGERS
-- ========================================

-- Auto-update updated_at timestamp for new tables
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_usage_updated_at BEFORE UPDATE ON subscription_usage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to keep user_profiles in sync with subscriptions
CREATE OR REPLACE FUNCTION sync_user_subscription()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_subscription_changes 
  AFTER INSERT OR UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION sync_user_subscription();

-- Trigger to update usage counts when data changes
CREATE OR REPLACE FUNCTION trigger_update_usage()
RETURNS TRIGGER AS $$
BEGIN
  -- Update usage counts for the affected user
  PERFORM update_usage_counts(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Add triggers to relevant tables
CREATE TRIGGER update_usage_on_account_change
  AFTER INSERT OR UPDATE OR DELETE ON accounts
  FOR EACH ROW EXECUTE FUNCTION trigger_update_usage();

CREATE TRIGGER update_usage_on_transaction_change
  AFTER INSERT OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION trigger_update_usage();

CREATE TRIGGER update_usage_on_budget_change
  AFTER INSERT OR UPDATE OR DELETE ON budgets
  FOR EACH ROW EXECUTE FUNCTION trigger_update_usage();

CREATE TRIGGER update_usage_on_goal_change
  AFTER INSERT OR UPDATE OR DELETE ON goals
  FOR EACH ROW EXECUTE FUNCTION trigger_update_usage();