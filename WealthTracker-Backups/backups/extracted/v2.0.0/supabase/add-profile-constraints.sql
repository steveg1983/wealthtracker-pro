-- Add constraints to ensure user profiles remain unique
-- This prevents any future duplicate issues

-- Check if constraints already exist
SELECT 
    conname as constraint_name
FROM pg_constraint 
WHERE conrelid = 'user_profiles'::regclass;

-- Add UNIQUE constraint on clerk_user_id if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'user_profiles'::regclass 
        AND conname = 'unique_clerk_user_id'
    ) THEN
        ALTER TABLE user_profiles 
        ADD CONSTRAINT unique_clerk_user_id UNIQUE (clerk_user_id);
        RAISE NOTICE 'Added unique constraint on clerk_user_id';
    ELSE
        RAISE NOTICE 'Unique constraint on clerk_user_id already exists';
    END IF;
END $$;

-- Add UNIQUE constraint on email if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'user_profiles'::regclass 
        AND conname = 'unique_email'
    ) THEN
        ALTER TABLE user_profiles 
        ADD CONSTRAINT unique_email UNIQUE (email);
        RAISE NOTICE 'Added unique constraint on email';
    ELSE
        RAISE NOTICE 'Unique constraint on email already exists';
    END IF;
END $$;

-- Verify constraints are in place
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'user_profiles'::regclass
AND contype = 'u';