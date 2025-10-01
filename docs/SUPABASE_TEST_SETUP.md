# Supabase Test User Setup Guide

**Purpose**: Configure credentials for real Supabase integration tests
**Required For**: Running `*.real.test.ts` files with actual database authentication
**Security**: Test credentials only, never commit to git

---

## Quick Start (5 Minutes)

### Step 1: Access Supabase Dashboard

**URL**: https://supabase.com/dashboard (or https://app.supabase.com)

**Navigation**:
1. Log in to Supabase
2. You'll see a list of your projects
3. Click on your **WealthTracker project**
   - URL will be: `https://nqbacrjjgdjabygqtcah.supabase.co` (from `.env.test`)

### Step 2: Navigate to User Management

**In the Supabase Dashboard**:
1. Look at the **left sidebar**
2. Find and click **"Authentication"** (shield icon)
3. Under Authentication, click **"Users"**
4. You'll see a list of all users (may be empty)

**Screenshot Location**: Should look like:
```
┌─ Left Sidebar ─────────┐
│ 🏠 Home                │
│ 📊 Table Editor        │
│ 🔐 Authentication  ← CLICK THIS
│    └─ Users        ← THEN THIS
│ 📡 Database            │
│ 🔧 Settings            │
└────────────────────────┘
```

### Step 3: Create Test User

**In the Users page**:
1. Look for **"Add User"** or **"Invite User"** button (top right)
2. Click it
3. A modal will appear with fields:

**Fill in**:
```
Email Address: test@wealthtracker.local
Password: TestPassword123!
☑ Auto Confirm User (check this to skip email verification)
```

4. Click **"Create User"** or **"Send Invitation"**

### Step 4: Add Credentials to .env.test.local

**Open**: `.env.test.local` (already created for you)

**Replace**:
```bash
# Change this line:
VITEST_SUPABASE_PASSWORD=REPLACE_WITH_YOUR_TEST_PASSWORD

# To your actual password:
VITEST_SUPABASE_PASSWORD=TestPassword123!
```

**Save the file**.

### Step 5: Test the Setup

```bash
# Load the environment variables
source .env.test.local

# Run a single real test
VITEST_SUPABASE_MODE=real npx vitest run src/services/__tests__/categoryService.real.test.ts

# If it passes, you're done! ✅
```

---

## Troubleshooting

### Issue: "Cannot find Authentication in sidebar"

**Solution**: You might be in the wrong dashboard. Make sure you're in:
- Supabase dashboard (not Vercel, not Clerk)
- Your specific project (not organization settings)

**Try**: https://app.supabase.com/project/nqbacrjjgdjabygqtcah/auth/users
(Replace with your project ref if different)

---

### Issue: "Add User button not visible"

**Possible causes**:
1. **Insufficient permissions** - You need admin/owner role
2. **Wrong section** - Make sure you're in Authentication → Users, not Settings → Users

**Solution**: Check your project permissions or try the SQL approach below

---

### Issue: "User created but tests still fail with PGRST100"

**Cause**: User exists but doesn't have database access permissions

**Solution**: Check Row Level Security (RLS) policies
1. Go to **Authentication → Policies**
2. Make sure your tables allow access for authenticated users
3. Or temporarily disable RLS for testing (not recommended for production)

---

## Alternative: Create User via SQL

If you can't find the UI, you can create a test user via SQL:

**Navigate to**: SQL Editor in Supabase dashboard

**Run this query**:
```sql
-- Create test user in auth.users table
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'test@wealthtracker.local',
  crypt('TestPassword123!', gen_salt('bf')),  -- Encrypted password
  NOW(),
  NOW(),
  NOW()
);
```

**Note**: This requires `pgcrypto` extension enabled. Supabase usually has this by default.

---

## Security Best Practices

### ✅ DO:
- Create a dedicated test user (not your real account)
- Use a strong password
- Add credentials to `.env.test.local` only (gitignored)
- Use test database if possible (separate from production)
- Limit test user permissions (read/write test data only)

### ❌ DON'T:
- Commit `.env.test.local` to git
- Use production credentials for testing
- Share test credentials publicly
- Use weak passwords
- Give test user admin permissions

---

## Environment Variable Reference

**Required for Real Tests**:
```bash
VITEST_SUPABASE_EMAIL=test@wealthtracker.local
VITEST_SUPABASE_PASSWORD=YourTestPassword
```

**Already Configured** (in `.env.test`):
```bash
VITE_SUPABASE_URL=https://nqbacrjjgdjabygqtcah.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

---

## Running Tests with Real Supabase

### Option 1: Load from file
```bash
source .env.test.local
VITEST_SUPABASE_MODE=real npm run test:real
```

### Option 2: Inline variables
```bash
VITEST_SUPABASE_MODE=real \
VITEST_SUPABASE_EMAIL=test@wealthtracker.local \
VITEST_SUPABASE_PASSWORD=TestPassword123! \
npm run test:real
```

### Option 3: Single test file
```bash
VITEST_SUPABASE_MODE=real \
VITEST_SUPABASE_EMAIL=test@wealthtracker.local \
VITEST_SUPABASE_PASSWORD=TestPassword123! \
npx vitest run src/services/__tests__/categoryService.real.test.ts
```

---

## Verification Checklist

After setup, verify:
- [ ] `.env.test.local` file exists
- [ ] `VITEST_SUPABASE_EMAIL` is set
- [ ] `VITEST_SUPABASE_PASSWORD` is set
- [ ] `.gitignore` excludes `.env.test.local` (pattern `.env.*`)
- [ ] Test user exists in Supabase Authentication → Users
- [ ] Test user is confirmed (not pending email)
- [ ] Single real test passes: `VITEST_SUPABASE_MODE=real npx vitest run src/services/__tests__/categoryService.real.test.ts`

---

## Next Steps

Once test user is created and credentials are in `.env.test.local`:

1. **Run smoke tests**:
   ```bash
   npm run test:smoke
   ```

2. **Run unit tests** (mocked Supabase):
   ```bash
   npm run test:unit
   ```

3. **Run integration tests** (real Supabase):
   ```bash
   source .env.test.local
   npm run test:integration
   ```

4. **Run all tests**:
   ```bash
   source .env.test.local
   npm run test:all
   ```

---

## Still Can't Find It?

### Direct Link (try this):
```
https://app.supabase.com/project/nqbacrjjgdjabygqtcah/auth/users
```

Replace `nqbacrjjgdjabygqtcah` with your project ref if different.

### Or Search:
1. In Supabase dashboard, use the **search bar** (top of page)
2. Type: "users" or "authentication"
3. Click the result that says "Authentication → Users"

---

**Once you've created the test user and added the password to `.env.test.local`, ChatGPT can run the real integration tests!**