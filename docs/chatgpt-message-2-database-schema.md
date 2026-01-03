# Message 2: Database Schema & Migration

Send this after ChatGPT confirms they're comfortable with the scope:

---

## Database Schema - Open Banking Tables

### Current Status

We already have the base tables created from a previous attempt:
- ✅ `bank_connections` - Stores encrypted connection credentials
- ✅ `linked_accounts` - Maps external accounts to our internal accounts
- ✅ `sync_history` - Audit log of sync operations

These are in: `/supabase/migrations/20250124_add_open_banking_tables.sql`

### What Needs to Be Added

I've created an **enhancement migration** that adds:

1. **Transaction deduplication** - Prevents importing the same transaction twice
2. **OAuth state management** - CSRF protection for auth flow
3. **Token refresh tracking** - Automatic token renewal before expiry
4. **Webhook logging** - Audit trail of provider events
5. **Sync metadata** - Per-connection sync state and cursors

The migration file is: `/supabase/migrations/20250102_enhance_open_banking.sql`

### Your Tasks

**Task 1: Review the enhancement migration**

Please review the SQL file I created:
- Path: `/supabase/migrations/20250102_enhance_open_banking.sql`
- Check if anything is unclear or needs adjustment
- Verify it matches your backend implementation needs

**Task 2: Run the migrations (in order)**

When ready to set up the database:

```bash
# Assuming you have Supabase CLI installed
# If not: npm install -g supabase

# Login to Supabase
npx supabase login

# Link to our project
npx supabase link --project-ref nqbacrjjgdjabygqtcah

# Run migrations in order
npx supabase db push
```

Or manually run in Supabase dashboard:
1. Go to: https://supabase.com/dashboard/project/nqbacrjjgdjabygqtcah/sql/new
2. Copy content from `20250124_add_open_banking_tables.sql`
3. Execute
4. Copy content from `20250102_enhance_open_banking.sql`
5. Execute

**Task 3: Verify tables created successfully**

After running migrations, confirm these tables exist:

```sql
-- Verify tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'bank_connections',
    'linked_accounts',
    'sync_history',
    'oauth_states',
    'webhook_events',
    'sync_metadata'
  );

-- Verify transactions table was enhanced
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'transactions'
  AND column_name IN ('external_transaction_id', 'connection_id', 'external_provider');
```

### Key Schema Concepts

**1. Token Encryption**

Access tokens MUST be encrypted before storing in `bank_connections.access_token_encrypted`:

```javascript
// Using pgcrypto (already enabled)
const encryptedToken = await supabase.rpc('encrypt_token', {
  token: accessToken,
  key: process.env.ENCRYPTION_KEY
});

// Or using Supabase's built-in encryption (preferred)
// We'll discuss implementation approach in next message
```

**2. Transaction Deduplication**

When importing transactions from TrueLayer:

```javascript
// Each TrueLayer transaction has a unique transaction_id
// Store it in external_transaction_id to prevent duplicates
await supabase.from('transactions').insert({
  user_id: userId,
  account_id: accountId,
  amount: transaction.amount,
  description: transaction.description,
  date: transaction.timestamp,

  // Deduplication fields
  external_transaction_id: transaction.transaction_id, // TrueLayer's ID
  connection_id: connectionId,
  external_provider: 'truelayer'
});

// The unique index will reject duplicates automatically
```

**3. OAuth State Flow**

When generating TrueLayer auth URL:

```javascript
// 1. Generate random state token
const stateToken = crypto.randomBytes(32).toString('hex');

// 2. Store in oauth_states table
await supabase.from('oauth_states').insert({
  user_id: userId,
  state_token: stateToken,
  provider: 'truelayer',
  expires_at: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
});

// 3. Include in TrueLayer auth URL
const authUrl = trueLayer.getAuthUrl({ state: stateToken });

// 4. When callback returns, verify state and mark as used
```

### Environment Variables Needed

Add these to your Vercel project (and `.env.local` for local dev):

```bash
# TrueLayer
TRUELAYER_CLIENT_ID=[your new rotated ID]
TRUELAYER_CLIENT_SECRET=[your new rotated secret]
TRUELAYER_REDIRECT_URI=http://localhost:5173/auth/callback
TRUELAYER_ENVIRONMENT=sandbox

# Supabase (you already have these)
VITE_SUPABASE_URL=https://nqbacrjjgdjabygqtcah.supabase.co
VITE_SUPABASE_ANON_KEY=[already configured]
VITE_SUPABASE_SERVICE_ROLE_KEY=[already configured]

# Encryption (generate a strong random key)
ENCRYPTION_KEY=[generate with: openssl rand -hex 32]
```

### Questions for You

1. **Migration approach** - Do you prefer:
   - A) I run the migrations on our Supabase instance
   - B) You run them yourself to verify
   - C) We do it together on a call

2. **Encryption strategy** - Which approach do you prefer:
   - A) Use pgcrypto with symmetric encryption (simpler)
   - B) Use Supabase Vault with pgsodium (more secure, requires setup)
   - C) Backend-only encryption (encrypt before INSERT, decrypt after SELECT)

3. **Database access** - For testing, do you need:
   - Direct Supabase SQL access?
   - Just access via Supabase client in API endpoints?

Let me know your preferences, and I'll proceed with the next step (API contract definition)!

---

**Wait for ChatGPT's response before sending Message 3.**
