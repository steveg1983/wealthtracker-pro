-- Dashboard Layouts Migration
-- Stores user dashboard configurations and widget layouts

-- Dashboard layouts table
CREATE TABLE IF NOT EXISTS dashboard_layouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT false,
  layout_config JSONB NOT NULL, -- Stores grid layouts for different breakpoints
  widgets JSONB NOT NULL, -- Stores widget configuration
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure only one default layout per user
  CONSTRAINT unique_default_layout UNIQUE (user_id, is_default) WHERE is_default = true,
  -- Ensure only one active layout per user
  CONSTRAINT unique_active_layout UNIQUE (user_id, is_active) WHERE is_active = true
);

-- Scheduled exports table
CREATE TABLE IF NOT EXISTS scheduled_exports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  format VARCHAR(50) NOT NULL CHECK (format IN ('csv', 'pdf', 'xlsx', 'json', 'qif', 'ofx')),
  frequency VARCHAR(50) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  config JSONB NOT NULL, -- Export configuration (date range, filters, etc.)
  email VARCHAR(255),
  next_run TIMESTAMP WITH TIME ZONE NOT NULL,
  last_run TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Widget preferences table (for storing individual widget settings)
CREATE TABLE IF NOT EXISTS widget_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  widget_type VARCHAR(100) NOT NULL,
  settings JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- One preference per widget type per user
  CONSTRAINT unique_widget_preference UNIQUE (user_id, widget_type)
);

-- Dashboard templates table (pre-configured layouts)
CREATE TABLE IF NOT EXISTS dashboard_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,
  icon VARCHAR(50),
  layout_config JSONB NOT NULL,
  widgets JSONB NOT NULL,
  is_public BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default dashboard templates
INSERT INTO dashboard_templates (name, description, category, icon, layout_config, widgets, is_public) VALUES
('Minimalist', 'Clean and simple layout focusing on essential information', 'minimalist', 'sparkles', 
 '{"lg": [{"i": "net-worth", "x": 0, "y": 0, "w": 6, "h": 3}, {"i": "cash-flow", "x": 6, "y": 0, "w": 6, "h": 3}]}',
 '["net-worth", "cash-flow", "recent-transactions", "budget-summary"]',
 true),
 
('Budget Master', 'Perfect for tracking expenses and staying within budget', 'personal', 'chart-bar',
 '{"lg": [{"i": "budget-vs-actual", "x": 0, "y": 0, "w": 8, "h": 4}, {"i": "monthly-summary", "x": 8, "y": 0, "w": 4, "h": 4}]}',
 '["budget-vs-actual", "expense-breakdown", "budget-summary", "bill-reminder"]',
 true),
 
('Investor Pro', 'Advanced layout for investment tracking and analysis', 'professional', 'currency-dollar',
 '{"lg": [{"i": "investment-summary", "x": 0, "y": 0, "w": 8, "h": 4}, {"i": "net-worth", "x": 8, "y": 0, "w": 4, "h": 2}]}',
 '["investment-summary", "net-worth", "cash-flow", "ai-analytics", "goal-progress"]',
 true);

-- Create indexes for better performance
CREATE INDEX idx_dashboard_layouts_user_id ON dashboard_layouts(user_id);
CREATE INDEX idx_dashboard_layouts_is_active ON dashboard_layouts(user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_scheduled_exports_user_id ON scheduled_exports(user_id);
CREATE INDEX idx_scheduled_exports_next_run ON scheduled_exports(next_run) WHERE is_active = true;
CREATE INDEX idx_widget_preferences_user_id ON widget_preferences(user_id);
CREATE INDEX idx_dashboard_templates_category ON dashboard_templates(category) WHERE is_public = true;

-- Row Level Security (RLS)
ALTER TABLE dashboard_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for dashboard_layouts
CREATE POLICY "Users can view their own dashboard layouts" ON dashboard_layouts
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can create their own dashboard layouts" ON dashboard_layouts
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own dashboard layouts" ON dashboard_layouts
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete their own dashboard layouts" ON dashboard_layouts
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- RLS Policies for scheduled_exports
CREATE POLICY "Users can view their own scheduled exports" ON scheduled_exports
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can create their own scheduled exports" ON scheduled_exports
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own scheduled exports" ON scheduled_exports
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete their own scheduled exports" ON scheduled_exports
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- RLS Policies for widget_preferences
CREATE POLICY "Users can view their own widget preferences" ON widget_preferences
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can create their own widget preferences" ON widget_preferences
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own widget preferences" ON widget_preferences
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete their own widget preferences" ON widget_preferences
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- RLS Policies for dashboard_templates
CREATE POLICY "Everyone can view public templates" ON dashboard_templates
  FOR SELECT USING (is_public = true);

CREATE POLICY "Users can view their own private templates" ON dashboard_templates
  FOR SELECT USING (auth.uid()::text = created_by::text AND is_public = false);

CREATE POLICY "Users can create templates" ON dashboard_templates
  FOR INSERT WITH CHECK (auth.uid()::text = created_by::text);

CREATE POLICY "Users can update their own templates" ON dashboard_templates
  FOR UPDATE USING (auth.uid()::text = created_by::text);

CREATE POLICY "Users can delete their own templates" ON dashboard_templates
  FOR DELETE USING (auth.uid()::text = created_by::text);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_dashboard_layouts_updated_at BEFORE UPDATE ON dashboard_layouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_exports_updated_at BEFORE UPDATE ON scheduled_exports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_widget_preferences_updated_at BEFORE UPDATE ON widget_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dashboard_templates_updated_at BEFORE UPDATE ON dashboard_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON dashboard_layouts TO authenticated;
GRANT ALL ON scheduled_exports TO authenticated;
GRANT ALL ON widget_preferences TO authenticated;
GRANT ALL ON dashboard_templates TO authenticated;