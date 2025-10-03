-- Complete Account Deletion Script
-- This will properly DELETE all accounts and related data (not soft delete)
-- WARNING: This is a permanent deletion!

-- First, let's see what we're about to delete
SELECT 'Current Accounts:' as info;
SELECT id, name, type, balance, created_at, user_id 
FROM accounts 
ORDER BY created_at DESC;

SELECT '---' as separator;
SELECT 'Related Transactions:' as info;
SELECT COUNT(*) as transaction_count 
FROM transactions 
WHERE account_id IN (SELECT id FROM accounts);

SELECT '---' as separator;
SELECT 'Related Categories (Transfer):' as info;
SELECT COUNT(*) as transfer_category_count 
FROM categories 
WHERE account_id IN (SELECT id FROM accounts);

-- Now perform the actual deletion
-- We need to delete in the correct order due to foreign key constraints

-- Step 1: Delete all transactions associated with accounts
DELETE FROM transactions 
WHERE account_id IN (SELECT id FROM accounts);

-- Step 2: Delete transfer categories associated with accounts
DELETE FROM categories 
WHERE account_id IS NOT NULL 
AND account_id IN (SELECT id FROM accounts);

-- Step 3: Delete investment holdings (if table exists)
DELETE FROM holdings 
WHERE account_id IN (SELECT id FROM accounts);

-- Step 4: Delete recurring transactions (if any)
DELETE FROM recurring_transactions 
WHERE account_id IN (SELECT id FROM accounts);

-- Step 5: Delete goals linked to accounts (update to remove account links)
UPDATE goals 
SET linked_account_ids = '[]'::jsonb 
WHERE linked_account_ids IS NOT NULL;

-- Step 6: Finally, delete all accounts
DELETE FROM accounts;

-- Verify deletion
SELECT '---' as separator;
SELECT 'Verification - Remaining Accounts:' as info;
SELECT COUNT(*) as remaining_accounts FROM accounts;

SELECT 'Verification - Remaining Related Transactions:' as info;
SELECT COUNT(*) as remaining_transactions 
FROM transactions 
WHERE account_id IS NOT NULL;

SELECT 'Verification - Remaining Transfer Categories:' as info;
SELECT COUNT(*) as remaining_transfer_categories 
FROM categories 
WHERE account_id IS NOT NULL;

SELECT '---' as separator;
SELECT 'Account deletion complete!' as status;