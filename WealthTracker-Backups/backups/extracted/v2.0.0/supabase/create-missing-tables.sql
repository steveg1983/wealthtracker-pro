-- Create Missing Tables
-- Run this BEFORE the UUID migration if you get errors about missing tables

-- ========================================
-- SUBSCRIPTION USAGE TABLE (if missing)
-- ========================================
-- Track usage for subscription limits
CREATE TABLE IF NOT EXISTS subscription_usage (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  accounts_count INTEGER DEFAULT 0,
  transactions_count INTEGER DEFAULT 0,
  budgets_count INTEGER DEFAULT 0,
  goals_count INTEGER DEFAULT 0,
  attachments_size_mb DECIMAL(10,2) DEFAULT 0,
  api_calls_count INTEGER DEFAULT 0,
  last_reset_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_usage_user_id ON subscription_usage(user_id);

-- Enable RLS
ALTER TABLE subscription_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own usage" ON subscription_usage
  FOR SELECT USING (user_id::TEXT = current_setting('app.current_user_id', true));

CREATE POLICY "System can update usage" ON subscription_usage
  FOR ALL USING (true);

-- ========================================
-- PAYMENT METHODS TABLE (if missing)
-- ========================================
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  stripe_payment_method_id TEXT UNIQUE,
  type TEXT,
  last4 TEXT,
  brand TEXT,
  exp_month INTEGER,
  exp_year INTEGER,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods(user_id);

-- Enable RLS
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment methods" ON payment_methods
  FOR SELECT USING (user_id::TEXT = current_setting('app.current_user_id', true));

-- ========================================
-- INVOICES TABLE (if missing)
-- ========================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT UNIQUE,
  amount_paid INTEGER, -- in cents
  amount_due INTEGER, -- in cents
  currency TEXT DEFAULT 'usd',
  status TEXT,
  invoice_pdf TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);

-- Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invoices" ON invoices
  FOR SELECT USING (user_id::TEXT = current_setting('app.current_user_id', true));

-- ========================================
-- Check what tables exist
-- ========================================
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;