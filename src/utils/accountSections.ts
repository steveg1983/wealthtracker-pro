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
}

/**
 * Icon per section type — the header dressing, keyed by section.
 *
 * This record used to carry three colour fields beside the icon — `color`,
 * `bgColor`, `borderColor`, a seven-hue categorical family with blue as one
 * member. Nothing anywhere read them; they were dressing for a header that
 * never wore it. The 29 August stock-blue sweep flagged the blue member, and
 * the honest question it raised — revive the dead set or delete it — was
 * answered by what the fields already were: dead. Deleted 29 Aug 2026, which
 * also retired three lint suppressions that existed only to hold a dead blue
 * past the stock-blue rule. A section's colour, should one ever be wanted,
 * is a fresh Design question, not a resurrection.
 */
const SECTION_STYLES: Record<string, Omit<AccountTypeSection, 'type' | 'title'>> = {
  current: {
    icon: WalletIcon,
  },
  savings: {
    icon: PiggyBankIcon,
  },
  credit: {
    icon: CreditCardIcon,
  },
  loan: {
    icon: TrendingDownIcon,
  },
  investment: {
    icon: TrendingUpIcon,
  },
  asset: {
    icon: HomeIcon,
  },
  liability: {
    icon: TrendingDownIcon,
  },
};

/** A section with no style of its own still renders — grey, like the catch-all. */
const FALLBACK_STYLE: Omit<AccountTypeSection, 'type' | 'title'> = {
  icon: PackageIcon,
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
