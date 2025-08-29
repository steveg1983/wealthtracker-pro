-- Enable Realtime for accounts and other tables
-- This is required for Supabase to broadcast changes via WebSocket

-- Enable realtime for the accounts table
ALTER PUBLICATION supabase_realtime ADD TABLE accounts;

-- Enable realtime for the transactions table
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;

-- Enable realtime for the users table
ALTER PUBLICATION supabase_realtime ADD TABLE users;

-- Set replica identity to FULL for better change tracking
-- This ensures all column values are included in the realtime payload
ALTER TABLE accounts REPLICA IDENTITY FULL;
ALTER TABLE transactions REPLICA IDENTITY FULL;
ALTER TABLE users REPLICA IDENTITY FULL;

-- Note: After running this migration, you may need to:
-- 1. Go to Supabase Dashboard > Database > Replication
-- 2. Verify that the tables are listed under "Source"
-- 3. If not visible, manually enable them in the dashboard