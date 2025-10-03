# 🚀 Supabase Setup Guide for WealthTracker

## Step 1: Create Your Supabase Project

1. **Go to** https://supabase.com and sign up/login
2. **Create New Project** with these settings:
   - Name: `wealthtracker` (or `wealthtracker-prod`)
   - Database Password: **SAVE THIS PASSWORD!**
   - Region: Choose closest to you
   - Plan: Free tier to start

3. **Wait 2 minutes** for project to provision

## Step 2: Get Your API Keys

1. Go to **Settings** (gear icon) → **API**
2. Copy these values to your `.env.local`:

```bash
# Add to your .env.local file
VITE_SUPABASE_URL=https://[YOUR-PROJECT-ID].supabase.co
VITE_SUPABASE_ANON_KEY=[YOUR-ANON-KEY]
```

## Step 3: Set Up Database Tables

1. In Supabase dashboard, click **SQL Editor** (left sidebar)
2. Click **New query**
3. **Copy and paste** the ENTIRE contents of `/supabase/schema.sql`
4. Click **Run** (or press Ctrl/Cmd + Enter)
5. You should see "Success. No rows returned"

## Step 4: Configure Authentication

Since we use Clerk for auth, we need to configure Supabase to accept Clerk users:

1. Go to **Authentication** → **Policies**
2. Our RLS policies are already created via SQL
3. No need to enable Supabase Auth (we use Clerk)

## Step 5: Test the Connection

1. Start your dev server:
```bash
npm run dev
```

2. Open browser console (F12)
3. You should NOT see Supabase errors anymore
4. Check for: "Supabase client initialized" message

## Step 6: Create Your First User

1. Go to your app at http://localhost:5173
2. Click "Sign Up" or "Sign In"
3. Complete Clerk authentication
4. Check Supabase dashboard → **Table Editor** → `user_profiles`
5. You should see your user record!

## 🔧 Troubleshooting

### "Missing Supabase environment variables"
- Make sure `.env.local` has your keys
- Restart dev server after adding keys
- Keys should start with correct prefixes

### "Permission denied" errors
- Check RLS policies are enabled
- Make sure user is synced to `user_profiles` table
- Check Clerk user ID matches

### Can't see data in Supabase dashboard
- RLS hides data by default in dashboard
- Click "Disable RLS" temporarily to view all data
- Or use SQL Editor with: `SELECT * FROM table_name;`

## 📊 Database Schema Overview

- **user_profiles**: Links Clerk users to our database
- **accounts**: Bank/investment accounts
- **transactions**: All financial transactions
- **budgets**: Budget settings
- **goals**: Financial goals
- **categories**: Transaction categories
- **recurring_transactions**: Scheduled transactions
- **investments**: Stock/crypto holdings

## 🔒 Security Features

- **Row Level Security (RLS)**: Users only see their own data
- **Clerk Integration**: Secure authentication
- **Encrypted Connections**: All data encrypted in transit
- **Automatic Backups**: Daily backups on paid plans

## 🎯 Next Steps

1. ✅ Database is ready
2. ✅ Authentication connected
3. Next: Update React components to use Supabase
4. Next: Migrate from localStorage to Supabase
5. Next: Add real-time sync features

## 📚 Useful Supabase Dashboard Pages

- **Table Editor**: View/edit data
- **SQL Editor**: Run queries
- **Database → Backups**: Download backups
- **Authentication → Users**: See all users
- **Storage**: Upload files/receipts
- **Realtime**: Monitor live connections
- **Logs**: Debug issues

## 🆘 Need Help?

- Supabase Docs: https://supabase.com/docs
- Discord: https://discord.supabase.com
- Status: https://status.supabase.com

---

Remember: Your database is now LIVE! Any data you add is real and persistent.