# CLAUDE_WORKFILE — Active Work Context

**Last updated**: 2026-03-09
**Branch**: `fix/merge-hardening-and-test-cleanup`
**Status**: Plan approved, implementation starting

---

## CURRENT TASK: Reconciliation System — Microsoft Money Model

### Background / What Was Done This Session

1. **TrueLayer Open Banking** is now fully working. User connected their HSBC bank account via live TrueLayer. 208 real transactions synced to DB.
2. **RLS fix**: Transactions weren't visible because `transactions` table had restrictive RLS (`auth.uid() = user_id`). Frontend uses anon key so `auth.uid()` was NULL. Fixed with migration `20260309_fix_transactions_rls_for_anon_reads.sql` — changed SELECT policy to `USING (true)` (matches accounts table pattern). **User needs to run this SQL in Supabase SQL Editor if not already done.**
3. **Diagnostic logging** added to `api/banking/sync-transactions.ts` and `api/_lib/truelayer.ts` (console.log statements for Vercel runtime logs). These are still in the code.
4. **Transactions now visible** in the Transactions tab but show "Unknown" under Account column. Account detail page shows "No transactions found" — the `account_id` on bank-synced transactions isn't mapping to the account display name properly.

### Known Issues Before Starting Reconciliation Work
- Transactions show "Unknown" account in transactions list (account name lookup issue)
- Account detail page shows bank-synced transactions as missing
- Bank Balance is hard-coded to £0.00 in `AccountTransactions.tsx`
- `cleared` field exists in TypeScript but **never persists to DB** (silently lost — `transactionService.ts` sends camelCase `cleared` but DB column doesn't exist)
- 5+ fragmented reconciliation components with no coherent workflow

---

## APPROVED PLAN: Reconciliation System

### Balance Semantics

| Concept | Source | Storage |
|---------|--------|---------|
| **Bank Balance** | TrueLayer sync / import statement / manual entry | `accounts.bank_balance` (new column) |
| **Account Balance** | Computed: `initial_balance + SUM(all txn amounts)` | Calculated at runtime |
| **Cleared Balance** | Computed: `initial_balance + SUM(cleared txn amounts)` | Calculated at runtime |
| **Difference** | `bank_balance - cleared_balance` | Calculated at runtime |

`accounts.balance` (existing) continues to be updated by sync. We ADD `bank_balance` as the explicit reconciliation target.

---

### Phase 1: Database + Persistence (Foundation)

**Status**: NOT STARTED

#### 1a. Migration: `supabase/migrations/20260310_add_reconciliation_columns.sql`

```sql
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_cleared BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS bank_balance NUMERIC(20,2);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_reconciled_date DATE;
CREATE INDEX IF NOT EXISTS idx_transactions_account_cleared
  ON transactions(account_id, is_cleared) WHERE is_cleared = FALSE;
```

**IMPORTANT**: After creating migration file, user must run this SQL in Supabase SQL Editor to apply to production DB.

#### 1b. Fix TransactionService field mapping

**File**: `src/services/api/transactionService.ts`

The `updateTransaction` method (line 171) sends `updates as never` directly to Supabase — camelCase fields silently fail. Add a mapper:

```typescript
const mapToDb = (updates: Partial<Transaction>): Record<string, unknown> => {
  const map: Record<string, string> = {
    accountId: 'account_id', cleared: 'is_cleared', isRecurring: 'is_recurring',
    categoryId: 'category_id', transferAccountId: 'transfer_account_id',
    bankReference: 'bank_reference', isImported: 'is_imported',
  };
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    result[map[key] ?? key] = value;
  }
  return result;
};
```

Apply in `updateTransaction` (line 171), `createTransaction` (line 115), `bulkCreateTransactions`.

#### 1c. Update TypeScript interfaces

**File**: `src/types/index.ts`

Account interface — add:
```typescript
bankBalance?: number | null;
lastReconciledDate?: Date | null;
```

Transaction interface — `cleared?: boolean` already exists. Keep it. Remove unused: `reconciledWith`, `reconciledDate`, `reconciledNotes`.

#### 1d. Update AccountService field mapping

Ensure `bank_balance` ↔ `bankBalance` and `last_reconciled_date` ↔ `lastReconciledDate` map correctly when reading/writing accounts.

---

### Phase 2: Sync Fix

**Status**: NOT STARTED

#### 2a. `api/banking/sync-accounts.ts` — write bank_balance

**Existing account update** (line 117-131): Add `bank_balance: account.balance` alongside existing `balance` update.

**New account insert** (line 142-158): Add `bank_balance: account.balance` alongside existing `balance` and `initial_balance`.

---

### Phase 3: Account Detail Page Fix

**Status**: NOT STARTED

#### 3a. `src/pages/AccountTransactions.tsx`

- **Bank Balance box** (currently hardcoded 0): Display `account.bankBalance ?? 'N/A'`
- **Account Balance**: Compute from `initial_balance + SUM(transactions)` instead of stored `account.balance`
- **Difference box**: `bankBalance - computedAccountBalance`
- **R column**: Already shows checkmark when `cleared` — will now persist via DB

---

### Phase 4: Reconciliation Page Rewrite

**Status**: NOT STARTED

#### Workflow: 3 Steps

**Step 1 — Account Selection** (`ReconciliationAccountList`)
- Grid of accounts showing: name, institution, unreconciled count, bank balance, account balance, difference
- Accounts with differences highlighted in amber/red
- Click account → Step 2

**Step 2 — Transaction Review** (`ReconciliationTransactionList` + `ReconciliationBalanceBar`)
- **Balance bar** at top: Bank Balance | Account Balance | Cleared Balance | Difference (live-updating)
- If no bank balance known, show manual entry field
- **Transaction table** (all transactions for account, sorted by date ascending):
  - Date | R/U checkbox | Description (inline-editable) | Category (inline-editable dropdown) | Amount | Running Balance
  - Click R/U checkbox → toggles `cleared`, persists to DB immediately
  - Filter: All / Uncleared / Cleared
  - Search bar
- "Add Transaction" button → opens transaction creation modal
- "Finalize Reconciliation" button → Step 3

**Step 3 — Finalization** (`ReconciliationFinalizationModal`)
- If `bank_balance === cleared_balance`: Success! Update `last_reconciled_date`. Done.
- If difference exists, modal shows:
  - Difference amount prominently displayed
  - **Option A**: "Go Back" — return to Step 2
  - **Option B**: "Create Adjustment" — form with:
    - Amount pre-filled (the difference)
    - Type: auto-set income/expense based on sign
    - Description: "Account Reconciliation Adjustment"
    - Category: dropdown (user picks)
    - Date: defaults to today
    - Auto-marked as `cleared = true`
  - On confirm: creates adjustment transaction, updates `last_reconciled_date`

#### New Components

```
src/components/reconciliation/
  ReconciliationAccountList.tsx    — Step 1: account grid
  ReconciliationBalanceBar.tsx     — Balance header for Step 2
  ReconciliationTransactionList.tsx — Step 2: transaction table with inline editing
  ReconciliationFinalizationModal.tsx — Step 3: difference handling + adjustment form
```

#### Enhanced Hook: `src/hooks/useReconciliation.ts`

Add:
- `computeAccountBalance(accountId)` — `initialBalance + SUM(txns)`
- `computeClearedBalance(accountId)` — `initialBalance + SUM(cleared txns)`
- `toggleCleared(transactionId)` — persists to DB
- `finalizeReconciliation(accountId)` — sets `last_reconciled_date`
- `createAdjustmentTransaction(accountId, amount, category)` — creates cleared adjustment

---

### Phase 5: Cleanup

**Status**: NOT STARTED

#### Delete fragmented components:
- `src/components/ReconciliationModal.tsx`
- `src/components/BalanceReconciliationModal.tsx`
- `src/components/SimplifiedReconciliation.tsx`
- `src/components/TransactionReconciliation.tsx`
- `src/components/AccountReconciliationModal.tsx`

Remove any references/imports to these from other files.

---

### Files to Modify Summary

| File | Change |
|------|--------|
| `supabase/migrations/20260310_add_reconciliation_columns.sql` | **NEW** — add `is_cleared`, `bank_balance`, `last_reconciled_date` |
| `src/types/index.ts` | Add `bankBalance`, `lastReconciledDate` to Account; clean up Transaction |
| `src/services/api/transactionService.ts` | Add camelCase→snake_case field mapper |
| `src/services/api/accountService.ts` | Map `bank_balance` ↔ `bankBalance` |
| `api/banking/sync-accounts.ts` | Write `bank_balance` on sync |
| `src/pages/AccountTransactions.tsx` | Wire real bank balance, computed account balance |
| `src/pages/Reconciliation.tsx` | **REWRITE** — 3-step workflow |
| `src/hooks/useReconciliation.ts` | Enhance with balance computations + DB operations |
| `src/utils/reconciliation.ts` | Update summary calculations |
| `src/components/reconciliation/*.tsx` | **NEW** — 4 components |
| 5 old reconciliation components | **DELETE** |

---

### Implementation Order

1. Migration + apply to Supabase
2. Type interfaces
3. TransactionService field mapper (so `cleared` persists)
4. AccountService field mapping
5. sync-accounts.ts bank_balance fix
6. AccountTransactions page balance display
7. Reconciliation components (AccountList → BalanceBar → TransactionList → FinalizationModal)
8. Reconciliation page rewrite
9. useReconciliation hook enhancement
10. Delete old components
11. Full verification: build, lint, test, manual test

---

### Verification Checklist

1. `npm run build:check` — passes
2. `npm run lint` — zero errors
3. `npm test --run` — passes
4. Manual: Toggle R/U on a transaction → reload page → status persists
5. Manual: Sync bank account → `bank_balance` updates on account detail
6. Manual: Reconciliation page → select account → review transactions → finalize
7. Manual: Finalization with difference → create adjustment → balances match

---

## PENDING MIGRATIONS TO APPLY IN SUPABASE

1. **`20260309_fix_transactions_rls_for_anon_reads.sql`** — May already be applied. Changes transactions SELECT RLS to `USING (true)`.
2. **`20260310_add_reconciliation_columns.sql`** — NOT YET CREATED/APPLIED. Adds `is_cleared` to transactions, `bank_balance` and `last_reconciled_date` to accounts.

---

## KEY TECHNICAL CONTEXT

- **TrueLayer**: Live production environment (`TRUELAYER_ENVIRONMENT=production`). Client ID: `wealthtracker-dd0b41`. User's HSBC connected successfully.
- **Supabase**: Frontend uses anon key (no Supabase auth session). RLS policies on transactions were blocking reads — fixed with permissive SELECT.
- **TransactionService bug**: `updateTransaction` sends camelCase fields via `as never` to Supabase. Fields like `cleared`, `accountId` silently fail because DB uses `is_cleared`, `account_id`. This is a critical bug to fix in Phase 1b.
- **Account balance**: Currently `accounts.balance` gets overwritten by TrueLayer sync. Need to separate into `balance` (ledger) and `bank_balance` (from bank).
- **Diagnostic logging**: `console.log` statements in `api/banking/sync-transactions.ts` and `api/_lib/truelayer.ts` — can be removed after reconciliation work is complete.
