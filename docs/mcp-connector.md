# The Reckley connector for Claude

**Status**: in build, branch `feat/mcp-connector` (started 21 Oct 2026)
**Owner**: Platform
**Decided with**: the owner, 21 Oct 2026

A Claude connector is a remote MCP server: an HTTPS endpoint speaking the
Model Context Protocol, where each user signs in to Reckley with OAuth and
Claude then calls named tools on that user's ledger. This document records
what we are building, why it has the shape it has, and the rulings that
shaped it. The submission rules it answers to are Anthropic's
[connector submission](https://claude.com/docs/connectors/building/submission),
[authentication](https://claude.com/docs/connectors/building/authentication)
and [review criteria](https://claude.com/docs/connectors/building/review-criteria)
pages, read on 21 Oct 2026.

---

## 1. One server, two listings — and why not one listing with a choice

The owner asked (21 Oct): is it better to do one connector with a list of
options — full access, ask approval, read only — than two separate ones?

**The permission has to live in the token, not in a menu.** When a user
connects a listing, Claude asks Reckley's authorization server for the
scopes that listing advertises, the user consents on Clerk's screen, and the
access token carries exactly those scopes for as long as the connection
lives. There is no later moment in Claude's connector flow where the user
picks a level, and a scope the token does not carry cannot be exercised by
anyone — not by Claude, not by a prompt-injection hidden in a bank
description, not by a user clicking "approve" without reading. A single
listing can only advertise one scope set, so "read-only" as a promise on the
directory card needs its own listing with its own scopes. That is what
PocketSmith is doing and it is the right shape.

**"Ask approval" already exists, and it is Claude's.** Every write tool is
annotated `destructiveHint: true`, and Claude prompts the user before each
such call; read-only tools run without prompts. So the three levels the owner
named map like this:

| Level | How it is delivered |
| --- | --- |
| Read only | the **Reckley Read-Only** listing: token carries `reckley:read` only; the server does not even list the write tools to it |
| Ask approval | the **Reckley Complete Access** listing: token carries `reckley:read reckley:write`; every write prompts the user, because Claude prompts on every destructive-annotated tool |
| Full access without asking | not something we offer. Claude may let a user mark a tool "always allow" in its own settings; that is the user's choice in Claude, not a mode of ours |

**One codebase.** Both listings point at the same function with different
URLs (`/api/mcp-read` and `/api/mcp`), because the protected-resource
metadata's `resource` field must equal the listing's URL exactly and its
`scopes_supported` is what Claude asks for. Same tools, same data port, same
tests; the only difference is which scopes the metadata advertises and which
tools the server registers for the token it was handed.

## 2. What already exists, and is reused rather than rebuilt

- **Identity → ledger user.** Every API route verifies a Clerk token and
  resolves it to the `users` row (`api/_lib/auth.ts`). The connector does
  the same with Clerk **OAuth** tokens instead of session tokens
  (`clerkClient.authenticateRequest(request, { acceptsToken: 'oauth_token' })`,
  which returns `userId`, `clientId` and `scopes`).
- **The verbs.** The database exposes the atomic operations the app itself
  uses — `update_transaction_atomic`, `apply_category_to_uncategorized`,
  `confirm_transaction_categories`, `set_transactions_cleared`,
  `link_transfer_pair`, `create_transfer_counterpart`,
  `create_transaction_atomic` and the rest — each carrying the audit log,
  row-level security and the review semantics. Write tools call those and
  nothing else, so Claude can do nothing the register cannot.
- **Hosting.** Vercel functions, stateless per request, which is exactly
  what the v2 SDK's `createMcpHandler` wants. Rate limiting and CORS helpers
  already in `api/_lib`.
- **A reviewer account.** Anthropic requires credentials for a fully
  populated account. The seeded demo account is that.

## 3. Authentication

Clerk is the OAuth 2.0 authorization server. Nothing about tokens is written
by us.

- **Client registration**: Clerk supports both modes Claude uses — Client ID
  Metadata Documents (preferred; no registration call) and Dynamic Client
  Registration (fallback). Both are enabled in the Clerk dashboard under
  OAuth applications → Settings → Client onboarding. PKCE S256 is required.
- **Scopes**: custom scopes have been available in Clerk since Aug 2026.
  Two are defined and advertised in Clerk's metadata: `reckley:read`,
  `reckley:write`.
- **Discovery**: an unauthenticated call to the MCP endpoint answers `401`
  with `WWW-Authenticate: Bearer resource_metadata="<url>"`. That URL is
  served by our own function (`/api/mcp-oauth-protected-resource`) and
  names Clerk's issuer in `authorization_servers`; Clerk serves its own
  authorization-server metadata. The `401` is required — Claude ignores the
  header on a `200`.
- **Callbacks**: `https://claude.ai/api/mcp/auth_callback` for the hosted
  apps and a loopback redirect on any port for Claude Code. Clerk's dynamic
  registration accepts what the client registers; nothing to configure
  per listing.
- **Token verification**: `@clerk/backend`'s `authenticateRequest` with
  `acceptsToken: 'oauth_token'`, networkless when `CLERK_JWT_KEY` is set.
  The verified `userId` is mapped to the `users` row exactly as
  `requireAuth` does today. The scopes on the token decide which tools are
  registered for that request.
- **Timeouts that matter**: Claude gives discovery, registration and token
  endpoints 10 seconds. Discovery is ours and is static JSON; the rest is
  Clerk's.

## 4. The tools

Names are `reckley_*`, snake_case, 64 characters or fewer, every one with a
`title`, a description that says when to use it, and `readOnlyHint` or
`destructiveHint`. Read and write never share a tool — Anthropic rejects a
tool that does both.

**Read (both listings)**

| Tool | Returns |
| --- | --- |
| `reckley_list_accounts` | accounts with type, currency, computed balance, cleared/bank balance where known |
| `reckley_search_transactions` | one page of rows matching text, account, category, date range, amount range, review/cleared state; `next_offset` when more |
| `reckley_get_transaction` | one row with its splits and transfer counterpart |
| `reckley_list_categories` | the category tree with ids, so filing can name a category correctly |
| `reckley_spending_by_category` | totals per category over a period, refunds netted |
| `reckley_spending_by_payee` | totals per payee over a period |
| `reckley_income_vs_expenses` | income, expenses, net, month by month over a period |
| `reckley_net_worth` | assets, liabilities and net worth today, per currency, from the register |
| `reckley_net_worth_series` | the Net Worth report's points over a period, per currency — the app's cadence (`utils/netWorthCadence`) and opening-date rule (`utils/openingDates`), walked BACKWARDS from today's balances over the rows after the window's first day (`api/_lib/mcp/netWorthSeries.ts`), so a year costs a few thousand rows however long the history; each account's first activity comes from `account_first_activity_for_user` (migration 20261022180000, service role only) |
| `reckley_budget_status` | each budget over its own period, through `utils/budgetEvaluation` — the Budget page's and the Dashboard card's one evaluation |
| `reckley_review_queue` | what is in To Review, grouped by account |

**Write (Complete Access only)** — each calls one existing verb, each
prompts in Claude (`destructiveHint`), each names up to 50 rows, and each
validates the whole request against the rows as they are now before touching
any of them, so a refusal means nothing was changed — the editor's and the
sweep's stance that a stale list is refused rather than acted on. Built
22 Oct 2026:

| Tool | Verb | Review |
| --- | --- | --- |
| `reckley_set_category` | `update_transaction_atomic` per row | a suggestion unless `confirm` (§5); refuses transfers, splits, To/From categories, groups, retired categories |
| `reckley_confirm_categories` | `confirm_transaction_categories` | ends it; counts only rows that were suggestions |
| `reckley_update_transaction_text` | `update_transaction_atomic`, description and notes only | untouched |
| `reckley_mark_reviewed` | `update_transaction_atomic`, `needs_review = false` | refuses an unfiled row — it would stay in To Review whatever its flag |
| `reckley_mark_cleared` | `set_transactions_cleared` | the verb's own rule: a filed row that is marked is reviewed |
| `reckley_link_transfer` | `link_transfer_pair` | both sides stay in review unless `confirm` |
| `reckley_create_transfer_counterpart` | `create_transfer_counterpart` | the source stays in review unless `confirm` |
| `reckley_add_transaction` | `create_transaction_atomic`, manual rows only; not idempotent | a category is a suggestion unless `confirm`; no category is unfiled |

Not in the first release: deletes, splits, bank connections, billing,
budgets and categories themselves. A delete is a verb with a confirmation
in the app; Claude's prompt is not that confirmation.

**Policy fit.** The directory refuses connectors that "transfer money,
cryptocurrency, or other financial assets". Ours moves none: a "transfer"
here is bookkeeping between two of the user's own ledgers, and the tool
descriptions say so in those words.

## 5. Rulings that shape the writes

- **A filing by Claude is a suggestion unless the user says confirm** —
  proposed here, and ruled by the owner on 22 Oct 2026: "I agree, it stays a
  suggestion and in 'to review'." The app's standing rule (11 Sep 2026) is
  that an automatic filing is a suggestion that stays in review until a
  person agrees. Claude acting on a
  conversation is closer to the categoriser than to a person at the
  register, so `reckley_set_category` writes what the app's own suggestion
  verb writes (`suggest_category_to_uncategorized`, 11 Sep 2026: "a machine
  guess stays a guess") — `category_confirmed = false` AND
  `needs_review = true` — so the row is visibly provisional and in To
  Review. A `confirm: true` argument, which Claude passes only when the user
  has said so in the conversation, writes the editor's own save instead:
  confirmed, review ended. The same flag is on the two transfer tools and on
  adding a row, for the same reason. Either way the To Review list keeps the
  trail.
- **Bank text is untrusted.** Descriptions and notes come from banks and
  files. Tool results return them as data, never as anything
  instruction-shaped, and tool descriptions describe the tool, never tell
  Claude how to behave.
- **Small answers.** Every list is paginated with `limit`/`offset` and
  capped at 25,000 characters by returning fewer rows, never by cutting
  text. Money is a string with its currency.
- **Provenance.** Every write goes through the same verbs as the register,
  so the audit log records it. The log's actor column is derived from the
  caller's session token, which the service role does not carry, so the port
  stamps `metadata.mcp` (the OAuth client id and the instant) on every row
  it writes through `update_transaction_atomic` or
  `create_transaction_atomic`, merged over what the row's metadata already
  held; the audit entry's after_data then carries the stamp. The three
  count-returning verbs (confirm, clear, link) take no metadata, so their
  entries say what changed but not that Claude did it — a limit worth a
  `p_actor` argument on those verbs one day, not a reason to write them any
  other way.

## 6. Hosting and URLs

- `api/mcp.ts` — the Complete Access endpoint, `POST` only, stateless.
- `api/mcp-read.ts` — the Read-Only endpoint, same handler, read scope only.
- `api/mcp-oauth-protected-resource.ts` — RFC 9728 metadata for both,
  chosen by a query or path parameter, `resource` built from the request
  host so previews and production each name themselves.
- The MCP functions get a longer `maxDuration` than the API default of ten
  seconds.
- **The listing URL is permanent** and the metadata `resource` must match
  it exactly, so the listings are submitted only after the domain move
  (rename phase 6). Until then the server is tested as a custom connector,
  which works on any host including previews.

## 7. Sequence

1. Scopes, the filing ruling and the first tool list — this document.
2. Clerk dashboard (owner): enable CIMD and DCR, require PKCE, create the
   two scopes, advertise them; set `CLERK_JWT_KEY` in Vercel for networkless
   verification. Check the plan includes OAuth applications.
3. Read-only server: data port, tools, metadata, 401 handshake, in-process
   specs through a real MCP client.
4. MCP Inspector, then a custom connector in the owner's own Claude.
5. Write tools, each behind the write scope, each with specs.
6. Ten evaluation questions against the showcase ledger, per the MCP guide —
   written and verified 22 Oct 2026, §9.
7. After phase 6: submit both listings. Any paid Claude plan can submit;
   listings go live as Community connectors after an automated scan.

## 8. The desktop edition

The directory no longer accepts local servers on their own; they ship
inside a plugin. The Rust bridge (`wealth-core-cli`) could power a local
stdio MCP server over an open ledger file later, with the same tool names.
Not in scope here.

## 9. The evaluation set, and the connector on localhost

Anthropic's MCP guide asks for ten questions a model with no other context
must answer through the server's tools alone, each with one verifiable
answer. Ours are in `docs/mcp-evaluation.xml`, against the **showcase ledger**
(`scripts/seedShowcaseUser.mts`: ten deterministic, invented years to a fixed
29 August 2026, seeded into the review account — the Danielle demo login is
empty). Every question is pinned to a closed window — a calendar year, a tax
year, "the first ever" — so the answer cannot drift as the account is used,
and every answer was derived through the tools themselves, two of them
cross-checked two ways (the mortgage balance at a past month-end equals the
series' "owe" for that month, the cards being clear). The file says what each
question exercises. **Re-verify after any reseed that changes the seeder.**

Two scripts make this possible without OAuth, and are never deployed:

- `scripts/mcp-local.mts --email <users.email> [--env .env.local] [--port 8787] [--write]`
  serves the production server code for one ledger on 127.0.0.1, read-only
  unless `--write`, resolving the ledger by the email on the `users` row and
  the service-role key from the env file. The harness connects to it over
  Streamable HTTP, which is the only transport it has.
- `scripts/mcp-call.mts <url> list | <tool> '<json>' [--json]` calls one tool
  and prints what the model would read (or, with `--json` and
  `response_format: 'json'`, the structured content).

Running the harness: `pip install anthropic 'mcp<2'` (the harness is written
against the 1.x Python SDK; 2.x renamed its HTTP client), an
`ANTHROPIC_API_KEY`, then
`python3 <mcp-builder skill>/scripts/evaluation.py -t http -u http://127.0.0.1:8788/mcp -m claude-sonnet-5-5 -o docs/mcp-evaluation-report.md docs/mcp-evaluation.xml`.
Two patches to a COPY of the harness were needed on 22 Oct 2026 and will be
again until the skill is updated: its agent loop answers only the first
`tool_use` block in a turn (current models issue several, and the API refuses
a turn with an unanswered one), and its `call_tool` returns the SDK's content
objects, which its serialiser cannot encode (return the blocks' `.text`).
Without the second, every call "fails" before the model sees any data and the
score is a meaningless 0/10.

**Runs of 22 Oct 2026, Sonnet 5.5: 10/10 both before and after the changes
below, 2.5 tool calls per question on average, 9.9 s then 8.2 s each** —
`docs/mcp-evaluation-report.md` is the second. What the model asked for after
the first run, and what was done the same day: a transfer row now always names the
other account (it had read "Transfer with X" beside a null id); search takes
`sort: 'oldest'`; the search description says text matches the description
only, that every bound is inclusive, and that a page may be shorter than
`limit`; spending by payee takes `category_id`. Asked for and deferred: an
account balance as of a date, a one-call total of one account's transfers over
a period, and a payee's price history.

