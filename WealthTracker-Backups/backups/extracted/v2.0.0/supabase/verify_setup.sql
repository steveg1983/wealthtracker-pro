-- Verify all tables were created successfully
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
AND table_name IN (
  'users', 'accounts', 'transactions', 'categories', 
  'budgets', 'goals', 'recurring_templates', 'tags', 
  'sync_queue', 'audit_log'
)
ORDER BY table_name;