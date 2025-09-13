# Auth & RLS Architecture (Clerk → Supabase JWT)

Goal: Strict, row‑level isolation in Supabase using Clerk as the IdP. The client talks directly to Supabase with a Supabase‑signed JWT containing the Clerk user identifier. RLS policies enforce access by matching `users.clerk_id` to the JWT claim.

## Overview
- Identity Provider: Clerk
- Database: Supabase (Postgres + RLS)
- Client DB Access: Supabase JS v2 with a Supabase JWT (not the anon key). The JWT includes a `clerk_id` claim for RLS.

## JWT Flow
1) User signs in with Clerk (browser).
2) Client calls a secure serverless endpoint (your backend) with the Clerk session token.
3) Backend verifies Clerk session with Clerk’s server SDK.
4) Backend generates a short‑lived Supabase JWT embedding `{ clerk_id: <clerk_user_id> }` using the Supabase JWT secret.
5) Client sets the Supabase session with that JWT:
   ```ts
   const { data, error } = await supabase.auth.setSession({ access_token: token, refresh_token: token })
   ```
   or `supabase.auth.setAuth(token)` if you keep a separate refresh strategy.

Important: The Supabase JWT secret resides on the server only.

## RLS Enforcement
Migration `supabase/migrations/017_strict_rls_policies.sql` installs strict policies that:
- Allow full access for `service_role` (server), and
- Allow end‑users access only to rows where `users.clerk_id = (auth.jwt() ->> 'clerk_id')`.

Tables covered: `users, accounts, transactions, budgets, goals, categories, recurring_templates, tags`.

## Backend Endpoint (pseudo‑code)
Example implementation (Vercel function), omitting actual key usage:
```ts
// api/supabase-token.ts (example only)
import { Webhook } from '@clerk/clerk-sdk-node' // or @clerk/backend
import jwt from 'jsonwebtoken'

export default async function handler(req, res) {
  // 1) Verify Clerk session (implementation depends on your Clerk setup)
  const session = await verifyClerk(req)
  if (!session?.userId) return res.status(401).json({ error: 'Unauthorized' })

  // 2) Generate Supabase JWT with clerk_id claim
  const payload = { clerk_id: session.userId, role: 'authenticated' }
  const token = jwt.sign(payload, process.env.SUPABASE_JWT_SECRET, { expiresIn: '15m' })

  return res.status(200).json({ token })
}
```

Client side after Clerk sign‑in:
```ts
const resp = await fetch('/api/supabase-token', { credentials: 'include' })
const { token } = await resp.json()
await supabase.auth.setSession({ access_token: token, refresh_token: token })
```

## Local & Migration Notes
- `supabase/schema.sql` is now legacy/demo and should not be used in prod.
- Always apply migrations in order. The authoritative chain is `supabase/migrations/`.
- After RLS changes, verify with:
  - A user A JWT: can only see A’s rows
  - A user B JWT: can only see B’s rows
  - `service_role` can access all rows

## Security Considerations
- Never expose the Supabase JWT secret or service role key to the client.
- Minimize JWT lifetime (e.g., 15 minutes) and refresh conservatively.
- Log and alert on RLS policy violations and auth errors.

## Next Steps
- Implement `/api/supabase-token` with Clerk verification.
- Wire the client to fetch and set the Supabase session after Clerk login.
- Run `017_strict_rls_policies.sql` and validate isolation in staging.

