# Message 3: API Contract & First Endpoint

Send this after database schema is confirmed:

---

## API Contract Definition & Implementation Start

Now that the database is ready, let's define the API contract (TypeScript interfaces) that both frontend and backend will use. This ensures type safety and prevents integration issues.

### Step 1: Create Shared Types File

Please create this file: `/types/banking-api.ts`

This will be shared between frontend and backend for type safety.

```typescript
/**
 * API Contract for Open Banking Integration
 * Shared between frontend and backend
 * DO NOT modify without coordinating with frontend team
 */

export namespace BankingAPI {
  // ========================================================================
  // Endpoint 1: POST /api/banking/create-link-token
  // ========================================================================

  export interface CreateLinkTokenRequest {
    userId: string;
    // Optional: specify which provider (defaults to truelayer)
    provider?: 'truelayer' | 'plaid';
  }

  export interface CreateLinkTokenResponse {
    authUrl: string;      // TrueLayer authorization URL
    state: string;        // CSRF protection token
    expiresAt: string;    // ISO timestamp when state expires
  }

  // ========================================================================
  // Endpoint 2: POST /api/banking/exchange-token
  // ========================================================================

  export interface ExchangeTokenRequest {
    code: string;         // Authorization code from OAuth callback
    state: string;        // CSRF token to validate
  }

  export interface ExchangeTokenResponse {
    success: boolean;
    connectionId: string; // UUID of created bank_connection
    institutionId: string;
    institutionName: string;
    institutionLogo?: string;
    accountsCount: number; // How many accounts were discovered
  }

  // ========================================================================
  // Endpoint 3: POST /api/banking/sync-accounts
  // ========================================================================

  export interface SyncAccountsRequest {
    connectionId: string; // UUID of bank_connection
  }

  export interface AccountInfo {
    id: string;           // External account ID from TrueLayer
    name: string;         // Account name (e.g., "Current Account")
    type: string;         // Account type (e.g., "TRANSACTION", "SAVINGS")
    balance: number;      // Current balance
    currency: string;     // Currency code (e.g., "GBP")
    mask?: string;        // Last 4 digits (e.g., "1234")
  }

  export interface SyncAccountsResponse {
    success: boolean;
    accountsSynced: number;
    accounts: AccountInfo[];
    error?: string;
  }

  // ========================================================================
  // Endpoint 4: POST /api/banking/sync-transactions
  // ========================================================================

  export interface SyncTransactionsRequest {
    connectionId: string;  // UUID of bank_connection
    accountId?: string;    // Optional: sync specific account only
    startDate?: string;    // ISO date (defaults to 90 days ago)
    endDate?: string;      // ISO date (defaults to today)
  }

  export interface SyncTransactionsResponse {
    success: boolean;
    transactionsImported: number;
    duplicatesSkipped: number;
    accountsProcessed: number;
    dateRange: {
      from: string;        // ISO date
      to: string;          // ISO date
    };
    error?: string;
  }

  // ========================================================================
  // Endpoint 5: GET /api/banking/connections
  // ========================================================================

  export interface Connection {
    id: string;
    provider: 'truelayer' | 'plaid';
    institutionId: string;
    institutionName: string;
    institutionLogo?: string;
    status: 'connected' | 'error' | 'reauth_required';
    lastSync?: string;      // ISO timestamp
    accountsCount: number;
    expiresAt?: string;     // ISO timestamp when token expires
    error?: string;
    needsReauth: boolean;
    createdAt: string;      // ISO timestamp
  }

  export type ConnectionsResponse = Connection[];

  // ========================================================================
  // Endpoint 6: POST /api/banking/disconnect
  // ========================================================================

  export interface DisconnectRequest {
    connectionId: string;
  }

  export interface DisconnectResponse {
    success: boolean;
    message?: string;
    error?: string;
  }

  // ========================================================================
  // Endpoint 7: POST /api/banking/webhook (Internal use only)
  // ========================================================================

  export interface WebhookPayload {
    provider: 'truelayer' | 'plaid';
    event_type: string;
    connection_id?: string;
    timestamp: string;
    signature: string;      // For verification
    data: Record<string, any>; // Provider-specific payload
  }

  export interface WebhookResponse {
    received: boolean;
    processed: boolean;
    error?: string;
  }

  // ========================================================================
  // Error Responses (All endpoints)
  // ========================================================================

  export interface ErrorResponse {
    error: string;          // Human-readable error message
    code: string;           // Error code (e.g., 'INVALID_STATE', 'TOKEN_EXPIRED')
    details?: any;          // Additional error context
    timestamp: string;      // ISO timestamp
  }

  // ========================================================================
  // Common Error Codes
  // ========================================================================

  export enum ErrorCode {
    // Authentication errors
    INVALID_STATE = 'INVALID_STATE',
    STATE_EXPIRED = 'STATE_EXPIRED',
    INVALID_TOKEN = 'INVALID_TOKEN',
    TOKEN_EXPIRED = 'TOKEN_EXPIRED',

    // Connection errors
    CONNECTION_NOT_FOUND = 'CONNECTION_NOT_FOUND',
    CONNECTION_FAILED = 'CONNECTION_FAILED',
    REAUTH_REQUIRED = 'REAUTH_REQUIRED',

    // Sync errors
    SYNC_FAILED = 'SYNC_FAILED',
    ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND',
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

    // Provider errors
    PROVIDER_ERROR = 'PROVIDER_ERROR',
    PROVIDER_MAINTENANCE = 'PROVIDER_MAINTENANCE',

    // Generic errors
    INTERNAL_ERROR = 'INTERNAL_ERROR',
    INVALID_REQUEST = 'INVALID_REQUEST',
    UNAUTHORIZED = 'UNAUTHORIZED'
  }
}
```

### Step 2: Implement First Endpoint

Let's start with the most critical endpoint: **POST /api/banking/create-link-token**

This generates the TrueLayer authorization URL that the frontend will redirect users to.

**Create file: `/api/banking/create-link-token.ts`**

Here's the structure (you'll need to fill in TrueLayer-specific implementation):

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { BankingAPI } from '../../types/banking-api';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Initialize Supabase client (service role for backend)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      code: BankingAPI.ErrorCode.INVALID_REQUEST
    } as BankingAPI.ErrorResponse);
  }

  try {
    const { userId, provider = 'truelayer' } = req.body as BankingAPI.CreateLinkTokenRequest;

    // Validate input
    if (!userId) {
      return res.status(400).json({
        error: 'userId is required',
        code: BankingAPI.ErrorCode.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      } as BankingAPI.ErrorResponse);
    }

    // Generate CSRF state token
    const stateToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store state in database for CSRF validation
    const { error: stateError } = await supabase
      .from('oauth_states')
      .insert({
        user_id: userId,
        state_token: stateToken,
        provider: provider,
        expires_at: expiresAt.toISOString()
      });

    if (stateError) {
      console.error('Failed to store OAuth state:', stateError);
      return res.status(500).json({
        error: 'Failed to create authorization link',
        code: BankingAPI.ErrorCode.INTERNAL_ERROR,
        details: stateError.message,
        timestamp: new Date().toISOString()
      } as BankingAPI.ErrorResponse);
    }

    // TODO: Initialize TrueLayer client and generate auth URL
    // You'll need to implement this part using TrueLayer's SDK
    //
    // Example (pseudo-code):
    // import { AuthAPIClient } from 'truelayer-client';
    //
    // const authClient = new AuthAPIClient({
    //   client_id: process.env.TRUELAYER_CLIENT_ID!,
    //   client_secret: process.env.TRUELAYER_CLIENT_SECRET!
    // });
    //
    // const authUrl = authClient.getAuthorizationURL({
    //   redirect_uri: process.env.TRUELAYER_REDIRECT_URI!,
    //   scope: ['info', 'accounts', 'balance', 'transactions', 'offline_access'],
    //   state: stateToken,
    //   providers: ['uk-oauth-all']
    // });

    const authUrl = 'YOUR_TRUELAYER_AUTH_URL_HERE';

    // Return response
    const response: BankingAPI.CreateLinkTokenResponse = {
      authUrl,
      state: stateToken,
      expiresAt: expiresAt.toISOString()
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Unexpected error in create-link-token:', error);
    return res.status(500).json({
      error: 'Internal server error',
      code: BankingAPI.ErrorCode.INTERNAL_ERROR,
      timestamp: new Date().toISOString()
    } as BankingAPI.ErrorResponse);
  }
}
```

### Step 3: Install Required Dependencies

You'll need to install:

```bash
# TrueLayer SDK
npm install truelayer-client

# Supabase client (should already be installed)
npm install @supabase/supabase-js

# TypeScript types for Vercel
npm install -D @vercel/node
```

### Step 4: TrueLayer SDK Setup

Here's how to use the TrueLayer SDK for the auth URL:

```typescript
import { AuthAPIClient } from 'truelayer-client';

const authClient = new AuthAPIClient({
  client_id: process.env.TRUELAYER_CLIENT_ID!,
  client_secret: process.env.TRUELAYER_CLIENT_SECRET!
});

const authUrl = authClient.getAuthorizationURL({
  redirect_uri: process.env.TRUELAYER_REDIRECT_URI!,
  scope: [
    'info',           // Basic provider info
    'accounts',       // Access to account details
    'balance',        // Account balances
    'transactions',   // Transaction history
    'offline_access'  // Refresh token for long-term access
  ],
  state: stateToken,
  providers: ['uk-oauth-all'] // All UK banks
});
```

### Your Tasks

1. **Create the types file** (`/types/banking-api.ts`)
2. **Review and confirm** the API contract matches your needs
3. **Install dependencies** (truelayer-client, etc.)
4. **Implement create-link-token endpoint** using the structure above
5. **Test locally** with:
   ```bash
   curl -X POST http://localhost:3000/api/banking/create-link-token \
     -H "Content-Type: application/json" \
     -d '{"userId": "test-user-123"}'
   ```

6. **Share the generated auth URL** - We'll test the full OAuth flow together

### Questions

1. **Have you worked with Vercel Serverless Functions before?** If not, I can provide more setup guidance.

2. **TrueLayer SDK** - Is the code example above clear, or do you need more details on their API?

3. **Testing approach** - Should we:
   - Test each endpoint locally before deploying?
   - Deploy to Vercel preview first?
   - Set up a development branch for testing?

Once this first endpoint is working, we'll move to the next one (exchange-token), which completes the OAuth flow.

Let me know when you have the endpoint implemented, and we'll test it together!

---

**This is the final message in the sequence. Wait for ChatGPT to implement and respond.**
