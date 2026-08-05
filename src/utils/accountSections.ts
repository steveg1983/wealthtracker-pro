/**
 * The ONE definition of the account-type sections — titles, order, icons,
 * colours — used by every page that groups accounts (Accounts, Reconciliation).
 * Keeping it shared guarantees the groupings always match.
 *
 * The order, titles and type-aliasing live in `accountGrouping.ts` (pure, no
 * React) so a dropdown can group accounts without importing icons; this module
 * adds the visual dressing the section HEADERS need, and re-exports the rest.
 */
import type { ComponentType } from 'react';
import type { IconProps } from '../components/icons';
import {
  WalletIcon, PiggyBankIcon, CreditCardIcon, TrendingDownIcon, TrendingUpIcon, HomeIcon,
  PackageIcon,
} from '../components/icons';
import type { Account } from '../types';
import {
  ACCOUNT_SECTION_DEFINITIONS,
  OTHER_SECTION_DEFINITION,
  sectionTypeForAccount,
  type AccountSectionDefinition,
} from './accountGrouping';

// Re-exported because every existing caller imports it from here; grouping
// itself is imported straight from accountGrouping (no icons needed).
export { sectionTypeForAccount } from './accountGrouping';

export interface AccountTypeSection extends AccountSectionDefinition {
  icon: ComponentType<IconProps>;
  color: string;
  bgColor: string;
  borderColor: string;
}

/** Icon + colours per section type — the header dressing, keyed by section. */
const SECTION_STYLES: Record<string, Omit<AccountTypeSection, 'type' | 'title'>> = {
  current: {
    icon: WalletIcon,
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-200 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  savings: {
    icon: PiggyBankIcon,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-200 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
  },
  credit: {
    icon: CreditCardIcon,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-200 dark:bg-orange-900/20',
    borderColor: 'border-orange-200 dark:border-orange-800',
  },
  loan: {
    icon: TrendingDownIcon,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-200 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
  },
  investment: {
    icon: TrendingUpIcon,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-200 dark:bg-purple-900/20',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
  asset: {
    icon: HomeIcon,
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-200 dark:bg-indigo-900/20',
    borderColor: 'border-indigo-200 dark:border-indigo-800',
  },
  liability: {
    icon: TrendingDownIcon,
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-200 dark:bg-gray-900/20',
    borderColor: 'border-gray-200 dark:border-gray-800',
  },
};

/** A section with no style of its own still renders — grey, like the catch-all. */
const FALLBACK_STYLE: Omit<AccountTypeSection, 'type' | 'title'> = {
  icon: PackageIcon,
  color: 'text-gray-600 dark:text-gray-400',
  bgColor: 'bg-gray-200 dark:bg-gray-900/20',
  borderColor: 'border-gray-200 dark:border-gray-800',
};

const withStyle = (section: AccountSectionDefinition): AccountTypeSection => ({
  ...section,
  ...(SECTION_STYLES[section.type] ?? FALLBACK_STYLE),
});

export const ACCOUNT_TYPE_SECTIONS: AccountTypeSection[] =
  ACCOUNT_SECTION_DEFINITIONS.map(withStyle);

/** The catch-all for any type without a section of its own. */
export const OTHER_SECTION: AccountTypeSection = withStyle(OTHER_SECTION_DEFINITION);

/** Every section, catch-all last — what a grouping page should iterate. */
export const ALL_ACCOUNT_SECTIONS: AccountTypeSection[] = [...ACCOUNT_TYPE_SECTIONS, OTHER_SECTION];

/** The section a given account belongs to — never undefined any more. */
export function sectionForAccountType(type: Account['type']): AccountTypeSection {
  const sectionType = sectionTypeForAccount(type);
  return ACCOUNT_TYPE_SECTIONS.find(s => s.type === sectionType) ?? OTHER_SECTION;
}
