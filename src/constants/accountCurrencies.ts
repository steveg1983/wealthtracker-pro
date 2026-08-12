/**
 * The currencies an account may be denominated in — ONE list, offered by every
 * form that asks.
 *
 * It used to live inside AddAccountModal, which was the only form that asked:
 * an account's currency was chosen once at creation and then never shown again,
 * anywhere. Account Settings now displays it too, and a second copy of this
 * array is exactly how the two forms would come to disagree about what a user
 * may pick — the failure `services/api/accountMapping` was written to end, in
 * miniature.
 *
 * ── WHY THIS LIST IS SHORT, AND WHY THAT IS NOT THE WHOLE STORY ──────────────
 *
 * Three entries, because these are the three the product supports end to end
 * (rates, formatting, the cross-currency transfer flow). But a STORED currency
 * need not be one of them — an account can arrive from a backup restore or an
 * MS Money import holding anything at all — so no form may assume its account's
 * currency is in here. {@link accountCurrencyOptions} is the function that
 * settles that: it always includes the account's own code, because a `<select>`
 * whose value is missing from its own option list silently displays something
 * else, and saving that would re-denominate the account to whatever happened to
 * be first.
 */

export interface AccountCurrencyOption {
  /** ISO 4217 code, as stored on the account. */
  value: string;
  /** The currency's name, for the option's text. */
  label: string;
  symbol: string;
}

export const ACCOUNT_CURRENCIES: readonly AccountCurrencyOption[] = [
  { value: 'GBP', label: 'British Pound', symbol: '£' },
  { value: 'USD', label: 'US Dollar', symbol: '$' },
  { value: 'EUR', label: 'Euro', symbol: '€' },
];

/**
 * The options a form should offer for an account that currently holds `code`.
 *
 * The supported list, plus `code` itself when it is not already in it. An
 * unknown code is offered under its own name — there is nothing else truthful
 * to call it, and hiding it would be the silent re-denomination described
 * above.
 *
 * `code` is optional so a creation form, which has no account yet, gets the
 * plain supported list.
 */
export function accountCurrencyOptions(code?: string): readonly AccountCurrencyOption[] {
  if (!code) return ACCOUNT_CURRENCIES;
  if (ACCOUNT_CURRENCIES.some(option => option.value === code)) return ACCOUNT_CURRENCIES;
  return [...ACCOUNT_CURRENCIES, { value: code, label: code, symbol: code }];
}

/**
 * How a currency reads when it is being SHOWN rather than chosen: "£ British
 * Pound (GBP)", or just the code when the app has no name for it.
 *
 * The code is always present, even for a currency this list knows, because the
 * code is what the account actually stores and what every other screen and
 * every export will show.
 */
export function describeAccountCurrency(code: string): string {
  const option = ACCOUNT_CURRENCIES.find(entry => entry.value === code);
  return option ? `${option.symbol} ${option.label} (${option.value})` : code;
}
