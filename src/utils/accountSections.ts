/**
 * The ONE definition of the account-type sections — titles, order, icons,
 * colours — used by every page that groups accounts (Accounts, Reconciliation).
 * Keeping it shared guarantees the groupings always match.
 */
import type { ComponentType } from 'react';
import type { IconProps } from '../components/icons';
import {
  WalletIcon, PiggyBankIcon, CreditCardIcon, TrendingDownIcon, TrendingUpIcon, HomeIcon,
  PackageIcon,
} from '../components/icons';
import type { Account } from '../types';

export interface AccountTypeSection {
  type: string;
  title: string;
  icon: ComponentType<IconProps>;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const ACCOUNT_TYPE_SECTIONS: AccountTypeSection[] = [
  {
    type: 'current',
    title: 'Current Accounts',
    icon: WalletIcon,
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-200 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  {
    type: 'savings',
    title: 'Savings Accounts',
    icon: PiggyBankIcon,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-200 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
  },
  {
    type: 'credit',
    title: 'Credit Cards',
    icon: CreditCardIcon,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-200 dark:bg-orange-900/20',
    borderColor: 'border-orange-200 dark:border-orange-800',
  },
  {
    type: 'loan',
    title: 'Loans',
    icon: TrendingDownIcon,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-200 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
  },
  {
    type: 'investment',
    title: 'Investments',
    icon: TrendingUpIcon,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-200 dark:bg-purple-900/20',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
  {
    type: 'asset',
    title: 'Assets',
    icon: HomeIcon,
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-200 dark:bg-indigo-900/20',
    borderColor: 'border-indigo-200 dark:border-indigo-800',
  },
  {
    type: 'liability',
    title: 'Liabilities',
    icon: TrendingDownIcon,
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-200 dark:bg-gray-900/20',
    borderColor: 'border-gray-200 dark:border-gray-800',
  },
];

/**
 * The catch-all for any type without a section of its own. It exists because
 * the alternative was silence: `Account['type']` is wider than the section
 * list ('other' is in the DB constraint, 'cash' too), and an account whose
 * type had no section simply never rendered under type grouping — created in
 * the Add Account modal, visible in the search count's denominator, absent
 * from the page. No type, present or future, may vanish that way again.
 */
export const OTHER_SECTION: AccountTypeSection = {
  type: 'other',
  title: 'Other Accounts',
  icon: PackageIcon,
  color: 'text-gray-600 dark:text-gray-400',
  bgColor: 'bg-gray-200 dark:bg-gray-900/20',
  borderColor: 'border-gray-200 dark:border-gray-800',
};

/** Every section, catch-all last — what a grouping page should iterate. */
export const ALL_ACCOUNT_SECTIONS: AccountTypeSection[] = [...ACCOUNT_TYPE_SECTIONS, OTHER_SECTION];

const SECTION_TYPES = new Set(ACCOUNT_TYPE_SECTIONS.map(s => s.type));

/**
 * The section TYPE an account files under. Three aliases, then the catch-all:
 *  - 'checking' is the DB's spelling of 'current' (the account mapper already
 *    translates on load; handled here too so a raw DB value cannot regress);
 *  - 'assets' is the Add Account modal's "Other Assets" — same concept as
 *    'asset', which has been the section since the beginning;
 *  - 'mortgage' files under Loans, which is what the app itself says a loan
 *    is ("Mortgages, personal loans" — the Add Account modal's own label).
 * Anything else without a section lands in OTHER_SECTION rather than nowhere.
 */
export function sectionTypeForAccount(type: Account['type'] | string): string {
  if (type === 'checking') return 'current';
  if (type === 'assets') return 'asset';
  if (type === 'mortgage') return 'loan';
  return SECTION_TYPES.has(type) ? type : OTHER_SECTION.type;
}

/** The section a given account belongs to — never undefined any more. */
export function sectionForAccountType(type: Account['type']): AccountTypeSection {
  const sectionType = sectionTypeForAccount(type);
  return ACCOUNT_TYPE_SECTIONS.find(s => s.type === sectionType) ?? OTHER_SECTION;
}
