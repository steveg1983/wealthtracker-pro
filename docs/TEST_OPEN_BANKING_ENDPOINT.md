# Test Open Banking Endpoint #1

## Copy/Paste This Command

Open your terminal and paste this entire command:

```bash
curl -X POST https://wealthtracker-web.vercel.app/api/banking/create-link-token \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-user-123"}'
```

---

## Expected Response (Success)

If it works, you should see something like:

```json
{
  "authUrl": "https://auth.truelayer-sandbox.com/?response_type=code&client_id=sandbox-wealthtracker-dd0b41&scope=info%20accounts%20balance%20transactions%20offline_access&redirect_uri=http://localhost:5173/auth/callback&state=SOME_SIGNED_TOKEN&nonce=RANDOM_NONCE",
  "state": "SOME_SIGNED_TOKEN"
}
```

The important parts:
- ✅ `authUrl` starts with `https://auth.truelayer-sandbox.com/`
- ✅ Contains your client ID: `sandbox-wealthtracker-dd0b41`
- ✅ Has a `state` token (CSRF protection)

---

## Possible Errors

### Error 1: Missing Environment Variables

```json
{
  "error": "Missing required environment variable: TRUELAYER_CLIENT_ID",
  "code": "config_error"
}
```

**Fix**: Environment variables not set in Vercel. Go back and add them.

---

### Error 2: 404 Not Found

```
404: NOT_FOUND
```

**Fix**: Vercel deployment hasn't completed yet. Wait 2-3 minutes and try again.

---

### Error 3: 500 Internal Server Error

```json
{
  "error": "Some error message",
  "code": "internal_error"
}
```

**Fix**: Check Vercel function logs for details. The endpoint has an issue.

---

## After Testing

Once you get a successful response, copy the entire output and send this message to ChatGPT:

```markdown
Great work on Endpoint #1 (create-link-token)!

I've tested it on Vercel and it's working:

[PASTE YOUR CURL RESPONSE HERE]

The authUrl is generating correctly with our TrueLayer sandbox credentials!

Environment variables confirmed working:
- ✅ TRUELAYER_CLIENT_ID
- ✅ TRUELAYER_CLIENT_SECRET
- ✅ TRUELAYER_REDIRECT_URI
- ✅ TRUELAYER_ENVIRONMENT
- ✅ BANKING_STATE_SECRET

Ready for Endpoint #2 (exchange-token). Please implement the token exchange endpoint that handles the OAuth callback.

This should:
1. Accept code and state from the OAuth callback
2. Verify the state token (CSRF protection)
3. Exchange code for access tokens using TrueLayer API
4. Store encrypted tokens in Supabase bank_connections table
5. Return connection details to frontend

Let me know when it's ready to test!
```

---

## Quick Test

Just copy and paste this into your terminal:

```bash
curl -X POST https://wealthtracker-web.vercel.app/api/banking/create-link-token \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-user-123"}'
```

Then show me the response!
