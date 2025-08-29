-- Fix user table references
-- The accounts table has a foreign key to 'user_profiles' but should reference 'users'

-- First, check if user_profiles table exists
DO $$ 
BEGIN
  -- If user_profiles exists and users doesn't, rename it
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'user_profiles' AND table_schema = 'public'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'users' AND table_schema = 'public'
  ) THEN
    ALTER TABLE user_profiles RENAME TO users;
  END IF;
  
  -- If both exist, we need to merge them
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'user_profiles' AND table_schema = 'public'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'users' AND table_schema = 'public'
  ) THEN
    -- Copy any data from user_profiles to users if needed
    INSERT INTO users (id, clerk_id, email, first_name, last_name, subscription_tier, subscription_status)
    SELECT id, clerk_user_id, email, display_name, NULL, subscription_tier, subscription_status
    FROM user_profiles
    WHERE clerk_user_id NOT IN (SELECT clerk_id FROM users)
    ON CONFLICT (clerk_id) DO NOTHING;
    
    -- Drop the foreign key constraint on accounts if it references user_profiles
    ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_user_id_fkey;
    
    -- Add the correct foreign key constraint
    ALTER TABLE accounts ADD CONSTRAINT accounts_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    
    -- Drop user_profiles table
    DROP TABLE IF EXISTS user_profiles CASCADE;
  END IF;
END $$;

-- Ensure the users table has all required columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';

-- Ensure the constraint on accounts references the correct table
DO $$ 
BEGIN
  -- Check if the constraint references user_profiles
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu 
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'accounts' 
      AND tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'user_profiles'
  ) THEN
    ALTER TABLE accounts DROP CONSTRAINT accounts_user_id_fkey;
    ALTER TABLE accounts ADD CONSTRAINT accounts_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;