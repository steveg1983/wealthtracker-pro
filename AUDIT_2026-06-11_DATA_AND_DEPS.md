# Data Integrity & Dependency Audits — 2026-06-11

Follow-on audits to AUDIT_2026-06-10.md (frontend/security/backend).

---

## 1. Data Integrity Audit

**Tool**: `npm run audit:data` (scripts/audit-data-integrity.mjs, read-only).
Verifies per account: `stored balance === initial_balance + Σ(transactions)`.
Report written to `logs/data-integrity/`.

### Findings (run 2026-06-11 against the dev database)

| Metric | Value |
|---|---|
| Accounts | 70 |
| Transactions | 298 |
| Accounts satisfying the invariant | **1 / 70** |
| Total absolute drift | £444,370.60 |
| Orphaned transactions | 0 |
| NULL/NaN amounts | 0 |

**Diagnosis — two distinct causes, neither ongoing:**

1. **Test-data pollution (68 accounts)**: dozens of duplicate "Test
   Checking"/"Test Savings" rows seeded by past runs of
   `packages/testing/databaseTestUtils.ts` (`seedTestDatabase()` sets
   `balance: 5000` but never `initial_balance`, so the invariant fails from
   birth). That utility currently has **zero callers** — the rows are stale
   junk. The nightly smoke tests are NOT the source (they clean up).

2. **Genuine historical corruption (1 account)**: the "TEST" account with 22
   real transactions shows expected £14,397.18 vs stored **−£2,000** — drift
   of −£16,397.18 accumulated through the old float read-modify-write and
   partial-failure balance paths. This is concrete, measured proof of the
   damage class the 2026-06-10 atomic-RPC work eliminated.

**Current code is clean**: both account-creation paths set `initial_balance`,
and all balance mutations now run through the atomic SQL RPCs.

### ✅ RESOLVED 2026-06-11 — invariant now holds 4/4

Cleanup executed on user instruction (scripts/cleanup-test-data.mjs,
dry-run shown first): deleted **125 synthetic users** (complete-test@,
test.*@test.com, faker smoke leftovers) with their 66 accounts, 48
transactions, 575 categories, 20 budgets, 3 goals. Deletion boundary was
"every user whose email ≠ s.green1983@outlook.com" — both real user rows
untouched.

Per-account repairs on the 3 remaining drifted accounts:
- **GREEN S A** (real data, 227 txns): `trust-balance` — recorded the
  £2,773.42 opening balance the import path never wrote to
  initial_balance. Displayed balance unchanged (£15,462.82).
- **TEST Savings**: `trust-balance` — recorded the £1,000 opening balance.
  Displayed balance unchanged (£2,000).
- **TEST** (the corrupted account): `trust-ledger` — the 22-transaction
  history is the truth; stored balance corrected from −£2,000 to
  **£14,397.18**. (Pre-repair values preserved in
  logs/data-integrity/2026-06-11T07-47-27-850Z_audit.json if reversal is
  ever needed.)

Post-repair audit: **4/4 accounts clean, zero drift.**

NOTE: a side-finding remains open — the user has TWO users rows for the
same email under different Clerk ids (user_31Ng… from 2025-08 owning the
real accounts; user_3524… from 2025-11 owning the TEST accounts). Data is
split across identities depending on which Clerk instance issued the
session. Worth consolidating when convenient.

### Remediation options (as originally written — superseded by the above)

`npm run audit:data:repair -- --strategy=<s> [--apply]` (dry-run by default):
- `trust-ledger` — balance := initial + Σtxns (transaction history wins;
  right for the corrupted TEST account)
- `trust-balance` — initial := balance − Σtxns (stored balance wins; right
  for rows seeded with a balance but no opening balance)

Since this is a dev database, the simplest option is deleting the test junk
outright — **deletion is your call**, the repair script never deletes.

**Standing recommendation**: run `npm run audit:data` against production
before launch and on a schedule thereafter; a clean invariant is the
product's core correctness claim.

---

## 2. Dependency / Supply-Chain Audit

### Vulnerabilities

| | Before | After |
|---|---|---|
| Total | 72 (11 critical, 36 high) | 38 (0 critical, 24 high) |
| **Production (--omit=dev)** | ~30 incl. criticals | **0** |

All 38 remaining are in dev-only tooling (Vercel CLI dependency tree,
@lhci/cli) — never shipped to users, never deployed.

**Runtime fixes applied:**
- `@clerk/clerk-react` + `@clerk/backend` — **authorization bypass**
  (GHSA-w24r-5266-9c3c) in the auth library of a finance app; updated
- `dompurify` — the XSS sanitizer itself was vulnerable; updated
- `react-router-dom` — XSS via open redirects; updated
- `jspdf` 3→4 major — local file inclusion/path traversal (PDF export
  verified: 17 tests pass)
- `lodash` template code injection — moot, see phantom-dependency fix below

**Removed packages (13):**
- `truelayer-client` — **zero importers** (the banking integration is
  hand-rolled in api/_lib/truelayer.ts) and it carried an UNFIXABLE SSRF via
  the abandoned `request` package. Dead weight with a hole in it.
- 11 unused runtime deps: @clerk/themes, @tanstack/react-virtual, csv-parse,
  fuse.js, lodash-es, lru-cache, ml-matrix, react-circular-progressbar,
  react-hot-toast, react-is, react-markdown (+ orphaned @types/lodash,
  @types/lru-cache)
- Side effect: main bundle 1,111 KB → **1,020 KB raw**

**Phantom (undeclared) dependencies fixed (2):**
- `lodash` — imported by conflictResolutionService but never declared;
  resolved only through hoisting and would break on any lockfile change.
  Switched to the declared `es-toolkit`.
- `@clerk/types` — imported by authService but never declared; was resolving
  from the PARENT checkout's node_modules (worktree path walking). Declared
  as a devDependency.

### xlsx provenance (reviewed, intentionally unchanged)

`xlsx` installs from `cdn.sheetjs.com/xlsx-0.20.3` rather than the npm
registry. This is CORRECT: SheetJS stopped publishing to npm at 0.18.5, and
the registry version carries known CVEs (prototype pollution, ReDoS) fixed
only in the CDN releases. The unusual source is the secure choice here.

### Verification
Build clean, lint zero warnings, full suite 2,962 tests passing
(unit + integration), `npm audit --omit=dev`: **0 vulnerabilities**.

### Recommendations
1. Decide the dev-DB cleanup (delete test junk vs repair script) and run
   `npm run audit:data` against production before launch.
2. Add `npm audit --omit=dev --audit-level=high` to CI so production-path
   vulnerabilities fail the build.
3. Re-run the unused-dependency scan quarterly — this codebase accretes
   packages (TensorFlow yesterday, 12 more today).
