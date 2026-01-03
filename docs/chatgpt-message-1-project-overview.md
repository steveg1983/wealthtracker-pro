# Message 1: Project Overview & Credentials

Send this to ChatGPT first to establish context:

---

## WealthTracker - Open Banking Implementation Request

Hi! We're implementing UK Open Banking for my SaaS app (WealthTracker) using TrueLayer. I need you to build the complete backend infrastructure while the frontend team (Claude) handles the UI integration.

### Project Context

**Frontend Stack:**
- React + TypeScript + Vite
- Already built with complete Open Banking UI (currently mocked)
- Deployed on Vercel: https://wealthtracker-web.vercel.app

**Backend Requirements:**
- Vercel Serverless Functions (`/api` directory)
- Database: Supabase PostgreSQL (already configured)
- Auth: Clerk (already integrated)

**Provider:**
- TrueLayer (UK Open Banking)
- Starting with Sandbox environment
- Will add production credentials when ready to launch

### TrueLayer Credentials (PRIVATE - SANDBOX)

⚠️ **IMPORTANT**: These are sensitive credentials. Store in environment variables only, never commit to git.

```bash
TRUELAYER_CLIENT_ID=sandbox-wealthtracker-dd0b41
TRUELAYER_CLIENT_SECRET=02abb51d-4045-42ad-a139-d218b949edd9
TRUELAYER_REDIRECT_URI=http://localhost:5173/auth/callback
TRUELAYER_ENVIRONMENT=sandbox
BANKING_STATE_SECRET=f92f0acfcdeb4d8997056f801792a7e657a829e323df06db26a6dde8461cc88e
```

For production later, we'll add:
- Production credentials from TrueLayer
- Production redirect URI: https://wealthtracker-web.vercel.app/auth/callback

### Your Scope (Backend)

You're responsible for:

1. **Database schema** - Already 80% done, needs enhancements (I'll provide SQL)
2. **7 API endpoints** - OAuth flow, account sync, transaction sync, webhooks
3. **Security layer** - Encrypted token storage, webhook verification, CSRF protection
4. **TrueLayer integration** - Using their official Node.js SDK

### My Scope (Frontend - Claude)

Frontend team handles:
- Updating UI to call real APIs (currently mocked)
- OAuth callback page handling
- Error states and reauth flows

### Architecture Decision

**Use Vercel Serverless Functions** (in `/api` directory) because:
- We're already deployed on Vercel
- Seamless integration with frontend
- Auto-scaling for free
- Easy environment variable management

Alternative (Supabase Edge Functions) would work too, but Vercel is preferred for consistency with our deployment.

### Timeline

**Total: 8-10 weeks**
- Database enhancements: 3-5 days
- Core API endpoints (OAuth + sync): 2-3 weeks
- Additional endpoints (connections, webhooks): 1 week
- Integration testing: 1-2 weeks
- Security audit: 3-5 days
- Production prep: 1 week

**Your backend work: ~4-5 weeks** (we'll work in parallel with frontend integration)

### Questions Before We Start

Before I send the detailed requirements, I need to know:

1. **Are you comfortable with OAuth 2.0 flows?** (Specifically the authorization code flow that TrueLayer uses)

2. **Have you worked with encrypted token storage before?** (We'll use pgcrypto or pgsodium in PostgreSQL)

3. **Vercel Serverless Functions vs Supabase Edge Functions** - Any preference? (I recommend Vercel for consistency)

4. **TrueLayer SDK familiarity** - Have you used it before, or would you like me to provide integration examples?

5. **Database migrations** - Should I provide SQL scripts, or do you prefer to write them yourself with my requirements?

### Next Steps

Once you confirm you're comfortable with the scope:
1. I'll send you the enhanced database migration SQL
2. I'll send you the TypeScript API contract (shared types between frontend/backend)
3. We'll implement endpoints one at a time, starting with the OAuth flow
4. We'll test each endpoint before moving to the next

### Resources

- **TrueLayer Docs**: https://docs.truelayer.com/
- **TrueLayer Node.js SDK**: https://www.npmjs.com/package/truelayer-client
- **Our existing database schema**: Already has `bank_connections`, `linked_accounts`, `sync_history` tables

Let me know if you have any questions or concerns about the scope!

---

**Wait for ChatGPT to respond before sending the next message.**
