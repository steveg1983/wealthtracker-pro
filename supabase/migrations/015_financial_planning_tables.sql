-- Migration: Create Financial Planning Tables
-- Description: Tables for retirement plans, mortgage calculations, and other financial planning features
-- Date: 2025-09-02

-- Create financial_plans table
CREATE TABLE IF NOT EXISTS financial_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('retirement', 'mortgage', 'debt', 'goal', 'insurance', 'networth')),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
  data JSONB NOT NULL DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create saved_calculations table (if not exists)
CREATE TABLE IF NOT EXISTS saved_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  calculation_name VARCHAR(255) NOT NULL,
  calculator_type VARCHAR(50) NOT NULL,
  calculation_data JSONB NOT NULL,
  result_data JSONB,
  is_favorite BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create mortgage_calculations table (specific mortgage data)
CREATE TABLE IF NOT EXISTS mortgage_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES financial_plans(id) ON DELETE CASCADE,
  property_value DECIMAL(15,2) NOT NULL,
  down_payment DECIMAL(15,2) NOT NULL,
  loan_amount DECIMAL(15,2) NOT NULL,
  interest_rate DECIMAL(5,4) NOT NULL,
  loan_term_years INTEGER NOT NULL,
  monthly_payment DECIMAL(10,2) NOT NULL,
  total_interest DECIMAL(15,2),
  total_paid DECIMAL(15,2),
  property_taxes DECIMAL(10,2),
  home_insurance DECIMAL(10,2),
  hoa_fees DECIMAL(10,2),
  pmi_amount DECIMAL(10,2),
  region VARCHAR(10) CHECK (region IN ('US', 'UK')),
  calculation_type VARCHAR(50),
  additional_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create retirement_projections table
CREATE TABLE IF NOT EXISTS retirement_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES financial_plans(id) ON DELETE CASCADE,
  current_age INTEGER NOT NULL,
  retirement_age INTEGER NOT NULL,
  current_savings DECIMAL(15,2) DEFAULT 0,
  monthly_contribution DECIMAL(10,2) DEFAULT 0,
  employer_match DECIMAL(10,2) DEFAULT 0,
  expected_return DECIMAL(5,4) DEFAULT 0.07,
  inflation_rate DECIMAL(5,4) DEFAULT 0.025,
  target_monthly_income DECIMAL(10,2),
  projected_balance DECIMAL(15,2),
  monthly_income_available DECIMAL(10,2),
  shortfall DECIMAL(10,2),
  projection_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create debt_payoff_plans table
CREATE TABLE IF NOT EXISTS debt_payoff_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES financial_plans(id) ON DELETE CASCADE,
  strategy VARCHAR(50) CHECK (strategy IN ('avalanche', 'snowball', 'custom')),
  total_debt DECIMAL(15,2) NOT NULL,
  monthly_payment DECIMAL(10,2) NOT NULL,
  payoff_date DATE,
  total_interest DECIMAL(15,2),
  debts JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_financial_plans_user_id ON financial_plans(user_id);
CREATE INDEX idx_financial_plans_type ON financial_plans(type);
CREATE INDEX idx_financial_plans_status ON financial_plans(status);
CREATE INDEX idx_saved_calculations_user_id ON saved_calculations(user_id);
CREATE INDEX idx_saved_calculations_type ON saved_calculations(calculator_type);
CREATE INDEX idx_mortgage_calculations_user_id ON mortgage_calculations(user_id);
CREATE INDEX idx_mortgage_calculations_plan_id ON mortgage_calculations(plan_id);
CREATE INDEX idx_retirement_projections_user_id ON retirement_projections(user_id);
CREATE INDEX idx_retirement_projections_plan_id ON retirement_projections(plan_id);
CREATE INDEX idx_debt_payoff_plans_user_id ON debt_payoff_plans(user_id);

-- Row Level Security (RLS)
ALTER TABLE financial_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE mortgage_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE retirement_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_payoff_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own financial plans" ON financial_plans
  FOR SELECT USING (auth.uid()::uuid = user_id);

CREATE POLICY "Users can create own financial plans" ON financial_plans
  FOR INSERT WITH CHECK (auth.uid()::uuid = user_id);

CREATE POLICY "Users can update own financial plans" ON financial_plans
  FOR UPDATE USING (auth.uid()::uuid = user_id);

CREATE POLICY "Users can delete own financial plans" ON financial_plans
  FOR DELETE USING (auth.uid()::uuid = user_id);

-- Similar policies for saved_calculations
CREATE POLICY "Users can view own calculations" ON saved_calculations
  FOR SELECT USING (auth.uid()::uuid = user_id);

CREATE POLICY "Users can create own calculations" ON saved_calculations
  FOR INSERT WITH CHECK (auth.uid()::uuid = user_id);

CREATE POLICY "Users can update own calculations" ON saved_calculations
  FOR UPDATE USING (auth.uid()::uuid = user_id);

CREATE POLICY "Users can delete own calculations" ON saved_calculations
  FOR DELETE USING (auth.uid()::uuid = user_id);

-- Similar policies for mortgage_calculations
CREATE POLICY "Users can view own mortgage calculations" ON mortgage_calculations
  FOR SELECT USING (auth.uid()::uuid = user_id);

CREATE POLICY "Users can create own mortgage calculations" ON mortgage_calculations
  FOR INSERT WITH CHECK (auth.uid()::uuid = user_id);

CREATE POLICY "Users can update own mortgage calculations" ON mortgage_calculations
  FOR UPDATE USING (auth.uid()::uuid = user_id);

CREATE POLICY "Users can delete own mortgage calculations" ON mortgage_calculations
  FOR DELETE USING (auth.uid()::uuid = user_id);

-- Similar policies for retirement_projections
CREATE POLICY "Users can view own retirement projections" ON retirement_projections
  FOR SELECT USING (auth.uid()::uuid = user_id);

CREATE POLICY "Users can create own retirement projections" ON retirement_projections
  FOR INSERT WITH CHECK (auth.uid()::uuid = user_id);

CREATE POLICY "Users can update own retirement projections" ON retirement_projections
  FOR UPDATE USING (auth.uid()::uuid = user_id);

CREATE POLICY "Users can delete own retirement projections" ON retirement_projections
  FOR DELETE USING (auth.uid()::uuid = user_id);

-- Similar policies for debt_payoff_plans
CREATE POLICY "Users can view own debt plans" ON debt_payoff_plans
  FOR SELECT USING (auth.uid()::uuid = user_id);

CREATE POLICY "Users can create own debt plans" ON debt_payoff_plans
  FOR INSERT WITH CHECK (auth.uid()::uuid = user_id);

CREATE POLICY "Users can update own debt plans" ON debt_payoff_plans
  FOR UPDATE USING (auth.uid()::uuid = user_id);

CREATE POLICY "Users can delete own debt plans" ON debt_payoff_plans
  FOR DELETE USING (auth.uid()::uuid = user_id);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_financial_plans_updated_at BEFORE UPDATE ON financial_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_saved_calculations_updated_at BEFORE UPDATE ON saved_calculations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mortgage_calculations_updated_at BEFORE UPDATE ON mortgage_calculations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_retirement_projections_updated_at BEFORE UPDATE ON retirement_projections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_debt_payoff_plans_updated_at BEFORE UPDATE ON debt_payoff_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE financial_plans IS 'Stores user financial plans of various types';
COMMENT ON TABLE saved_calculations IS 'Stores saved calculator results for quick access';
COMMENT ON TABLE mortgage_calculations IS 'Detailed mortgage calculation data';
COMMENT ON TABLE retirement_projections IS 'Retirement planning projections and scenarios';
COMMENT ON TABLE debt_payoff_plans IS 'Debt payoff strategies and tracking';

COMMENT ON COLUMN financial_plans.type IS 'Type of financial plan: retirement, mortgage, debt, goal, insurance, networth';
COMMENT ON COLUMN financial_plans.status IS 'Status of the plan: active, archived, completed';
COMMENT ON COLUMN financial_plans.data IS 'Flexible JSON data specific to each plan type';

COMMENT ON COLUMN mortgage_calculations.region IS 'Geographic region for region-specific calculations: US or UK';
COMMENT ON COLUMN debt_payoff_plans.strategy IS 'Debt payoff strategy: avalanche (highest interest first), snowball (smallest balance first), custom';