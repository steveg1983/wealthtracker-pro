-- Financial Planning Database Schema
-- Created: 2025-09-02
-- Purpose: Store user financial calculations and plans

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Financial Plans - Master table for all types of financial calculations
CREATE TABLE financial_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  plan_type VARCHAR(50) NOT NULL CHECK (plan_type IN ('retirement', 'mortgage', 'investment', 'tax', 'insurance', 'education')),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  data JSONB NOT NULL, -- Flexible storage for different plan types
  region VARCHAR(10) DEFAULT 'US', -- 'US', 'UK', etc.
  currency VARCHAR(3) DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Mortgage Calculations - Specific table for detailed mortgage data
CREATE TABLE mortgage_calculations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  financial_plan_id UUID REFERENCES financial_plans(id) ON DELETE CASCADE,
  
  -- Property Details
  property_price DECIMAL(15,2) NOT NULL,
  down_payment DECIMAL(15,2) NOT NULL,
  loan_amount DECIMAL(15,2) NOT NULL,
  
  -- Mortgage Terms
  interest_rate DECIMAL(5,4) NOT NULL,
  term_years INTEGER NOT NULL,
  mortgage_type VARCHAR(50) NOT NULL, -- 'fixed', 'variable', 'tracker', 'arm', etc.
  
  -- Regional Details
  region VARCHAR(10) NOT NULL, -- 'UK', 'US'
  state_county VARCHAR(100), -- US state or UK county
  
  -- Calculator Type
  calculation_type VARCHAR(50) NOT NULL CHECK (calculation_type IN (
    'standard', 'helpToBuy', 'sharedOwnership', 'remortgage', 'affordability', 'arm'
  )),
  
  -- Results (stored as JSONB for flexibility)
  monthly_payment DECIMAL(15,2) NOT NULL,
  total_interest DECIMAL(15,2) NOT NULL,
  results JSONB NOT NULL, -- Full calculation results
  
  -- Additional costs
  stamp_duty DECIMAL(15,2),
  pmi_amount DECIMAL(15,2),
  property_tax DECIMAL(15,2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Retirement Plans - Specific table for retirement calculations
CREATE TABLE retirement_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  financial_plan_id UUID REFERENCES financial_plans(id) ON DELETE CASCADE,
  
  -- Personal Details
  current_age INTEGER NOT NULL,
  retirement_age INTEGER NOT NULL,
  life_expectancy INTEGER DEFAULT 85,
  
  -- Income Details
  current_income DECIMAL(15,2) NOT NULL,
  desired_replacement_ratio DECIMAL(5,4) DEFAULT 0.80, -- 80% of current income
  
  -- Savings Details
  current_savings DECIMAL(15,2) DEFAULT 0,
  monthly_contribution DECIMAL(15,2) DEFAULT 0,
  employer_match DECIMAL(5,4) DEFAULT 0,
  
  -- Assumptions
  expected_return DECIMAL(5,4) DEFAULT 0.07, -- 7% annual return
  inflation_rate DECIMAL(5,4) DEFAULT 0.03, -- 3% inflation
  
  -- Regional Details
  region VARCHAR(10) NOT NULL,
  plan_type VARCHAR(50) NOT NULL, -- '401k', 'ira', 'pension', 'sipp', etc.
  
  -- Results
  results JSONB NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Investment Plans - For investment analysis and portfolio management
CREATE TABLE investment_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  financial_plan_id UUID REFERENCES financial_plans(id) ON DELETE CASCADE,
  
  -- Portfolio Details
  total_value DECIMAL(15,2) NOT NULL,
  target_allocation JSONB NOT NULL, -- {"stocks": 0.60, "bonds": 0.30, "cash": 0.10}
  current_allocation JSONB NOT NULL,
  
  -- Risk Profile
  risk_tolerance VARCHAR(20) CHECK (risk_tolerance IN ('conservative', 'moderate', 'aggressive')),
  time_horizon INTEGER, -- years until needed
  
  -- Holdings
  holdings JSONB, -- Array of holdings data
  
  -- Analysis Results
  expected_return DECIMAL(5,4),
  volatility DECIMAL(5,4),
  sharpe_ratio DECIMAL(5,4),
  
  -- ESG Scoring
  esg_score DECIMAL(3,1), -- 0.0 to 10.0
  
  results JSONB NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Saved Calculations - Quick storage for calculator results
CREATE TABLE saved_calculations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  
  calculator_type VARCHAR(50) NOT NULL, -- 'mortgage', 'retirement', 'tax', etc.
  calculation_name VARCHAR(255),
  
  -- Input parameters
  inputs JSONB NOT NULL,
  
  -- Calculated results
  results JSONB NOT NULL,
  
  -- Metadata
  region VARCHAR(10),
  currency VARCHAR(3) DEFAULT 'USD',
  tags TEXT[], -- Array of tags for organization
  
  is_favorite BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_financial_plans_user_id ON financial_plans(user_id);
CREATE INDEX idx_financial_plans_type ON financial_plans(plan_type);
CREATE INDEX idx_financial_plans_active ON financial_plans(user_id, is_active);

CREATE INDEX idx_mortgage_calculations_user_id ON mortgage_calculations(user_id);
CREATE INDEX idx_mortgage_calculations_type ON mortgage_calculations(calculation_type);
CREATE INDEX idx_mortgage_calculations_plan_id ON mortgage_calculations(financial_plan_id);

CREATE INDEX idx_retirement_plans_user_id ON retirement_plans(user_id);
CREATE INDEX idx_retirement_plans_region ON retirement_plans(region);
CREATE INDEX idx_retirement_plans_plan_id ON retirement_plans(financial_plan_id);

CREATE INDEX idx_investment_plans_user_id ON investment_plans(user_id);
CREATE INDEX idx_investment_plans_plan_id ON investment_plans(financial_plan_id);

CREATE INDEX idx_saved_calculations_user_id ON saved_calculations(user_id);
CREATE INDEX idx_saved_calculations_type ON saved_calculations(calculator_type);
CREATE INDEX idx_saved_calculations_favorite ON saved_calculations(user_id, is_favorite);

-- Row Level Security (RLS)
ALTER TABLE financial_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE mortgage_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE retirement_plans ENABLE ROW LEVEL SECURITY;  
ALTER TABLE investment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_calculations ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can only access their own data
CREATE POLICY "Users can view own financial plans" ON financial_plans
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own financial plans" ON financial_plans
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own financial plans" ON financial_plans
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own financial plans" ON financial_plans
  FOR DELETE USING (user_id = auth.uid());

-- Similar policies for other tables
CREATE POLICY "Users can view own mortgage calculations" ON mortgage_calculations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own mortgage calculations" ON mortgage_calculations
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own mortgage calculations" ON mortgage_calculations
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own mortgage calculations" ON mortgage_calculations
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Users can view own retirement plans" ON retirement_plans
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own retirement plans" ON retirement_plans
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own retirement plans" ON retirement_plans
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own retirement plans" ON retirement_plans
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Users can view own investment plans" ON investment_plans
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own investment plans" ON investment_plans
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own investment plans" ON investment_plans
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own investment plans" ON investment_plans
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Users can view own saved calculations" ON saved_calculations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own saved calculations" ON saved_calculations
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own saved calculations" ON saved_calculations
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own saved calculations" ON saved_calculations
  FOR DELETE USING (user_id = auth.uid());

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_financial_plans_updated_at 
  BEFORE UPDATE ON financial_plans 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_mortgage_calculations_updated_at 
  BEFORE UPDATE ON mortgage_calculations 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_retirement_plans_updated_at 
  BEFORE UPDATE ON retirement_plans 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_investment_plans_updated_at 
  BEFORE UPDATE ON investment_plans 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_saved_calculations_updated_at 
  BEFORE UPDATE ON saved_calculations 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Sample data for testing (optional - remove in production)
-- INSERT INTO financial_plans (user_id, plan_type, name, description, data, region) VALUES
-- ('00000000-0000-0000-0000-000000000000', 'mortgage', 'First Home Purchase', 'Calculate mortgage for first home', '{"propertyPrice": 350000, "deposit": 70000}', 'UK');