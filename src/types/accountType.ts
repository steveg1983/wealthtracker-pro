/**
 * The account types, in a module of their own because they are needed on BOTH
 * sides of the wire.
 *
 * api/ handlers are typechecked by tsconfig.api.json, which has neither the DOM
 * lib nor the `@app-types` path alias, so importing the types barrel from a
 * handler drags in browser-only modules and fails outright — the same
 * constraint that put the pure card and account-matching logic in
 * services/banking. A leaf module with no imports of its own can be shared by
 * both, which is what lets the card-number rule in utils/accountNumberInput
 * stay the ONE place that rule lives, the server included.
 */
export type AccountType =
  | 'current'
  | 'savings'
  | 'credit'
  | 'loan'
  | 'investment'
  | 'asset'
  | 'liability'
  | 'mortgage'
  | 'assets'
  | 'other'
  | 'checking'
  // No form offers 'cash' and the MS Money import files it as 'current', but
  // the accounts_type_check constraint has allowed it since the first schema
  // (and still does — migration 20260720120000), so a stored row may say it.
  // Listed here so the account mapper can carry such a row through as itself
  // rather than quietly refiling someone's account as 'other'.
  | 'cash';
