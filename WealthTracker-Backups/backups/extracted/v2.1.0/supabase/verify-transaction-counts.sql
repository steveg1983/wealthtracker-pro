-- Verify transaction counts and user IDs

-- 1. Count total transactions
SELECT COUNT(*) as total_transactions FROM transactions;

-- 2. Count UNIQUE user_ids in transactions
SELECT COUNT(DISTINCT user_id) as unique_users_in_transactions FROM transactions;

-- 3. Count transactions per user
SELECT 
    user_id,
    COUNT(*) as transaction_count
FROM transactions
GROUP BY user_id;

-- 4. Sample of transactions to see the data
SELECT 
    id,
    user_id,
    description,
    amount,
    date,
    type
FROM transactions
ORDER BY date DESC
LIMIT 10;