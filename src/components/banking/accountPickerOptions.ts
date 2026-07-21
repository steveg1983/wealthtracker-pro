import type { Account } from '../../types';

/**
 * Pure option-model helpers for AccountPickerCombobox, in their own module so
 * the component file only exports a component (react-refresh requirement).
 */

export const CREATE_NEW_VALUE = '__create_new__';
export const SKIP_ID = '__skip__';

// Same section order the app uses elsewhere; alphabetised within each group.
const ACCOUNT_GROUP_ORDER: Array<{ label: string; types: Array<Account['type']> }> = [
  { label: 'Current Accounts', types: ['current', 'checking'] },
  { label: 'Savings', types: ['savings'] },
  { label: 'Credit Cards', types: ['credit'] },
  { label: 'Loans', types: ['loan'] },
  { label: 'Mortgages', types: ['mortgage'] },
  { label: 'Investments', types: ['investment'] },
  { label: 'Assets', types: ['asset', 'assets'] },
  { label: 'Liabilities', types: ['liability'] },
  { label: 'Other', types: ['other'] }
];

export const groupAccountsForPicker = (
  accounts: Account[]
): Array<{ label: string; accounts: Account[] }> => {
  const active = accounts.filter((a) => a.isActive !== false);
  return ACCOUNT_GROUP_ORDER.map((group) => ({
    label: group.label,
    accounts: active
      .filter((a) => group.types.includes(a.type))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  })).filter((group) => group.accounts.length > 0);
};

/** Type-to-filter across name, institution and sort code (dashes optional). */
export const accountMatchesSearch = (account: Account, rawTerm: string): boolean => {
  const term = rawTerm.trim().toLowerCase();
  if (!term) {
    return true;
  }
  if (account.name.toLowerCase().includes(term)) {
    return true;
  }
  if (account.institution && account.institution.toLowerCase().includes(term)) {
    return true;
  }
  if (account.sortCode) {
    const digitsTerm = term.replace(/\D/g, '');
    const sortDigits = account.sortCode.replace(/\D/g, '');
    if (digitsTerm.length >= 2 && sortDigits.includes(digitsTerm)) {
      return true;
    }
    if (account.sortCode.toLowerCase().includes(term)) {
      return true;
    }
  }
  return false;
};

