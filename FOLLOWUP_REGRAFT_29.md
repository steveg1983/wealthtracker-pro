# PR #29 re-graft — VERIFIED COMPLETE (no action needed)

When `claude/great-shockley` was merged to `main` (PR #30), conflicts were
resolved **ours-favored**. This doc originally flagged a risk that #29's
genuinely-new features were dropped and needed re-grafting.

**Verified 2026-06-12: that risk did not materialise.** Our branch's
comprehensive UI transformation had independently (and more completely)
implemented everything #29 did. Each feature was checked in the merged tree
and is present:

| #29 feature | Status in merged code |
|---|---|
| AddAccountModal sort-code/account-number fields, prefill, onAccountCreated | ✅ present (`AddAccountModal.tsx`) |
| SimpleAccountService persists sort_code/account_number/opening_balance_date | ✅ present (`simpleAccountService.ts`) |
| `current`→`checking` type mapping in account writes | ✅ present (mapper, "DB constraint expects 'checking'") |
| Modal React-portal rendering + pt-16 top-align | ✅ present (`common/Modal.tsx` — `createPortal`) |
| LinkBankAccountsModal match-reason + "+ Create New Account" | ✅ present (`banking/LinkBankAccountsModal.tsx`) |
| Reconciliation onBlur optimistic-balance fix | ✅ present (`ReconciliationBalanceBar.tsx`) |
| Vite `/api` proxy for local dev | ✅ present (`vite.config.ts`) |

**Deliberately NOT carried over** (correct): #29's
`fix_accounts_rls_for_anon` migration (allow anon CRUD on accounts) — the
permissive RLS our 2026-06-11 hardening removed. Left superseded.

Conclusion: the ours-favored merge lost nothing of substance. No re-graft
work is required. This file is retained as the record of that verification.
