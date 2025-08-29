# Enable Real-time Sync in Supabase Dashboard

## ⚠️ IMPORTANT: Real-time Must Be Enabled in Supabase Dashboard

The real-time sync feature requires enabling replication for the accounts table in your Supabase project dashboard. The code is ready, but **Supabase needs to be configured**.

## Steps to Enable Real-time

### 1. Log into Supabase Dashboard
Go to https://app.supabase.com and select your project.

### 2. Navigate to Database Settings
1. Click on **Database** in the left sidebar
2. Click on **Replication** tab

### 3. Enable Real-time for Tables
1. Find the **supabase_realtime** publication
2. Click on **Select tables** or **Edit tables**
3. Enable replication for these tables:
   - ✅ `accounts`
   - ✅ `transactions` (optional, for future)
   - ✅ `budgets` (optional, for future)
   - ✅ `goals` (optional, for future)
4. Click **Save**

### Alternative Method (Table Editor)
1. Go to **Table Editor** in the left sidebar
2. Select the `accounts` table
3. Click on the **Replication** toggle at the top of the table view
4. Turn it **ON**

## Verify Real-time is Working

### Method 1: Check in Browser Console
Open the app and check the browser console (F12). You should see:
```
✅ [SimpleAccountService] Successfully subscribed!
   Channel: accounts-[uuid]
   Filter: user_id=eq.[uuid]
```

### Method 2: Use the Test Components
1. Open the app at `/accounts`
2. Look for two debugging panels in the bottom-right:
   - **Realtime Debugger** - Shows connection status
   - **Realtime Sync Test** - Auto-tests by creating/deleting an account

### Method 3: Manual Test
1. Open the app in two different browser windows
2. Log in with the same account in both
3. Add an account in Window 1
4. Account should appear instantly in Window 2 (no refresh needed)

## Troubleshooting

### If Real-time Isn't Working:

1. **Check Supabase Status**
   - Ensure your Supabase project is active
   - Check https://status.supabase.com for any outages

2. **Verify Replication is Enabled**
   ```sql
   -- Run this in Supabase SQL Editor
   SELECT * FROM pg_publication_tables 
   WHERE pubname = 'supabase_realtime';
   ```
   You should see `accounts` in the results.

3. **Check Browser Console for Errors**
   - Look for WebSocket connection errors
   - Check for "CHANNEL_ERROR" messages

4. **Verify Row Level Security (RLS)**
   - RLS policies must allow SELECT for real-time to work
   - Check Database → Tables → accounts → RLS Policies

5. **Check Network Tab**
   - Open DevTools → Network → WS (WebSocket)
   - You should see an active WebSocket connection to Supabase

## Current Implementation Details

### What's Working:
- ✅ Client-side subscription setup
- ✅ Proper user ID mapping (Clerk ID → Database UUID)
- ✅ Event handlers for INSERT, UPDATE, DELETE
- ✅ UI auto-refresh on events
- ✅ Debugging tools included

### What Needs Configuration:
- ⚠️ Enable replication in Supabase Dashboard (see steps above)

## SQL to Run (Optional)

If you have SQL access, you can run this directly:

```sql
-- Enable real-time for accounts table
ALTER PUBLICATION supabase_realtime ADD TABLE accounts;

-- Set replica identity to FULL
ALTER TABLE accounts REPLICA IDENTITY FULL;

-- Verify it's enabled
SELECT * FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'accounts';
```

## Success Indicators

When real-time is working correctly:
1. ✅ Green "SUBSCRIBED" status in debugger panel
2. ✅ Events appear in debugger when accounts change
3. ✅ Changes sync instantly across all open browsers
4. ✅ No manual refresh needed
5. ✅ Console shows successful subscription messages

## Support

If you continue to have issues after following these steps:
1. Check the Supabase documentation: https://supabase.com/docs/guides/realtime
2. Verify your Supabase project plan supports real-time (Free tier includes it)
3. Check the browser console for specific error messages