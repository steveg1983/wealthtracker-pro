-- Create dashboard layouts table for customizable widget configurations

-- 1. Create dashboard_layouts table
CREATE TABLE IF NOT EXISTS dashboard_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  widgets JSONB NOT NULL DEFAULT '[]',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, is_default) WHERE is_default = TRUE
);

-- 2. Create widget preferences table for individual widget settings
CREATE TABLE IF NOT EXISTS widget_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}',
  is_collapsed BOOLEAN DEFAULT FALSE,
  last_refreshed TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, widget_type)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_user_id ON dashboard_layouts(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_is_default ON dashboard_layouts(is_default);
CREATE INDEX IF NOT EXISTS idx_widget_preferences_user_id ON widget_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_widget_preferences_widget_type ON widget_preferences(widget_type);

-- Create updated_at triggers
DROP TRIGGER IF EXISTS update_dashboard_layouts_updated_at ON dashboard_layouts;
CREATE TRIGGER update_dashboard_layouts_updated_at 
  BEFORE UPDATE ON dashboard_layouts
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_widget_preferences_updated_at ON widget_preferences;
CREATE TRIGGER update_widget_preferences_updated_at 
  BEFORE UPDATE ON widget_preferences
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS (Row Level Security)
ALTER TABLE dashboard_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Dashboard layouts policies
DROP POLICY IF EXISTS "Users can view own dashboard layouts" ON dashboard_layouts;
CREATE POLICY "Users can view own dashboard layouts" ON dashboard_layouts
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Users can create own dashboard layouts" ON dashboard_layouts;
CREATE POLICY "Users can create own dashboard layouts" ON dashboard_layouts
  FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Users can update own dashboard layouts" ON dashboard_layouts;
CREATE POLICY "Users can update own dashboard layouts" ON dashboard_layouts
  FOR UPDATE USING (TRUE);

DROP POLICY IF EXISTS "Users can delete own dashboard layouts" ON dashboard_layouts;
CREATE POLICY "Users can delete own dashboard layouts" ON dashboard_layouts
  FOR DELETE USING (TRUE);

-- Widget preferences policies
DROP POLICY IF EXISTS "Users can view own widget preferences" ON widget_preferences;
CREATE POLICY "Users can view own widget preferences" ON widget_preferences
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Users can manage own widget preferences" ON widget_preferences;
CREATE POLICY "Users can manage own widget preferences" ON widget_preferences
  FOR ALL USING (TRUE);

-- Grant permissions
GRANT ALL ON dashboard_layouts TO service_role;
GRANT ALL ON widget_preferences TO service_role;

-- Create function to ensure only one default layout per user
CREATE OR REPLACE FUNCTION ensure_single_default_layout()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_single_default_layout_trigger ON dashboard_layouts;
CREATE TRIGGER ensure_single_default_layout_trigger
  BEFORE INSERT OR UPDATE ON dashboard_layouts
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_layout();

-- Insert default layout for existing users
INSERT INTO dashboard_layouts (user_id, name, widgets, is_default)
SELECT 
  id as user_id,
  'Default Layout' as name,
  '[
    {
      "id": "net-worth",
      "type": "net-worth",
      "title": "Net Worth",
      "size": "medium",
      "position": {"x": 0, "y": 0},
      "isVisible": true,
      "settings": {},
      "order": 0
    },
    {
      "id": "cash-flow",
      "type": "cash-flow",
      "title": "Cash Flow",
      "size": "large",
      "position": {"x": 2, "y": 0},
      "isVisible": true,
      "settings": {"forecastPeriod": 6},
      "order": 1
    },
    {
      "id": "budget-summary",
      "type": "budget-summary",
      "title": "Budget Summary",
      "size": "medium",
      "position": {"x": 0, "y": 1},
      "isVisible": true,
      "settings": {"period": "current"},
      "order": 2
    },
    {
      "id": "recent-transactions",
      "type": "recent-transactions",
      "title": "Recent Transactions",
      "size": "medium",
      "position": {"x": 2, "y": 1},
      "isVisible": true,
      "settings": {"count": 5},
      "order": 3
    }
  ]'::jsonb as widgets,
  TRUE as is_default
FROM users
WHERE NOT EXISTS (
  SELECT 1 FROM dashboard_layouts WHERE user_id = users.id AND is_default = TRUE
);