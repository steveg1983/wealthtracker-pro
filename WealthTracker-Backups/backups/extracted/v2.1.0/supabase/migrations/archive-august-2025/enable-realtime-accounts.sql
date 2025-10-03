-- Check current publications
SELECT * FROM pg_publication;

-- Check tables in the supabase_realtime publication  
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- Enable realtime for accounts table if not already enabled
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS accounts;

-- Set replica identity to FULL for accounts table
ALTER TABLE accounts REPLICA IDENTITY FULL;

-- Verify the changes
SELECT 
    schemaname,
    tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' 
    AND tablename = 'accounts';

-- Also check RLS policies are set correctly
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual 
FROM pg_policies 
WHERE tablename = 'accounts';