# Follow-up: re-graft features from main's PR #29

When `claude/great-shockley` was merged to `main`, the merge was resolved
**ours-favored**: every conflict took our branch's version, because #29
("UI polish, data integrity, and icon consolidation", commit a5583c8f) was
built on the OLD architecture our branch refactored away (Redux, the deleted
dead-code components, old jspdf). Resolving any other way would have dragged
that architecture back in.

That was the correct call for shipping the security/audit/refactor work
cleanly — but it means a handful of **genuinely new, valuable features from
#29 are not yet in the merged tree**. They were not lost from history (they
live in commit a5583c8f); they need deliberate re-grafting onto our refactored
files. None are urgent; no user data is affected (account fields persist in
the DB regardless of whether the edit UI exposes them).

## To re-graft (diff our file against `git show a5583c8f:<path>`)

1. **AddAccountModal — sort code + account number fields**
   - XX-XX-XX auto-formatting sort-code input; account-number input
   - prefill props + `onAccountCreated` callback (for the bank-linking flow)
   - Our version has the parseMoneyInput/a11y changes; graft the fields on top.

2. **SimpleAccountService — field persistence + integrity fixes**
   - Persist `sort_code`, `account_number`, `opening_balance_date`, `notes` to
     the Supabase insert (currently dropped)
   - Remove silent localStorage fallbacks so DB errors surface to the user
   - Map `'current'` → `'checking'` in account UPDATES (DB `accounts_type_check`
     expects `'checking'`); createAccount already does this
   - These are data-integrity improvements aligned with our audit work — worth
     prioritising over the pure-UX items.

3. **Modal — React portal rendering**
   - Render via `createPortal` to escape the PageTransition CSS-transform
     stacking context; top-align with `pt-16` below the search bar
   - Fixes modal positioning; check against our a11y/consent changes to Modal.

4. **LinkBankAccountsModal — bank-linking UX**
   - "match reason" text on auto-matched accounts
   - "+ Create New Account" option that opens the prefilled AddAccountModal

5. **Reconciliation bank-balance input** — onBlur submits instead of
   discarding; optimistic state keeps the value visible (race-condition fix).
   (We already touched ReconciliationBalanceBar for parseMoneyInput — reconcile
   the two.)

6. **Vite `/api` proxy** — proxy `/api` to the production Vercel backend for
   local dev testing. Low priority / dev-only.

## NOT to re-graft
- #29's `..._fix_accounts_rls_for_anon` migration (allow anon CRUD on
  accounts). This is the permissive RLS our 2026-06-11 hardening deliberately
  removed. Leave it superseded.
