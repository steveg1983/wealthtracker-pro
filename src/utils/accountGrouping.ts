/**
 * WHERE an account files — the section order, the section titles, and the
 * aliasing of legacy type spellings. Pure data and pure functions: no React,
 * no icons, so any module can group accounts without dragging the icon barrel
 * in behind it (a dropdown does not need a wallet glyph to sort itself).
 *
 * `accountSections.ts` dresses these same sections with icons and colours for
 * the pages that draw section headers; it re-exports everything here, so
 * existing imports keep working and there is still ONE definition of the
 * sections.
 */
import type { Account } from '../types';

/** A section's identity: the key it groups by and the words it prints. */
export interface AccountSectionDefinition {
  type: string;
  title: string;
}

/** The sections, in the order every account list shows them. */
export const ACCOUNT_SECTION_DEFINITIONS: AccountSectionDefinition[] = [
  { type: 'current', title: 'Current Accounts' },
  { type: 'savings', title: 'Savings Accounts' },
  { type: 'credit', title: 'Credit Cards' },
  { type: 'loan', title: 'Loans' },
  { type: 'investment', title: 'Investments' },
  { type: 'asset', title: 'Assets' },
  { type: 'liability', title: 'Liabilities' },
];

/**
 * The catch-all for any type without a section of its own. It exists because
 * the alternative was silence: `Account['type']` is wider than the section
 * list ('other' is in the DB constraint, 'cash' too), and an account whose
 * type had no section simply never rendered under type grouping — created in
 * the Add Account modal, visible in the search count's denominator, absent
 * from the page. No type, present or future, may vanish that way again.
 */
export const OTHER_SECTION_DEFINITION: AccountSectionDefinition = {
  type: 'other',
  title: 'Other Accounts',
};

const SECTION_TYPES = new Set(ACCOUNT_SECTION_DEFINITIONS.map(s => s.type));

/**
 * The section TYPE an account files under. Three aliases, then the catch-all:
 *  - 'checking' is the DB's spelling of 'current' (the account mapper already
 *    translates on load; handled here too so a raw DB value cannot regress);
 *  - 'assets' is the Add Account modal's "Other Assets" — same concept as
 *    'asset', which has been the section since the beginning;
 *  - 'mortgage' files under Loans, which is what the app itself says a loan
 *    is ("Mortgages, personal loans" — the Add Account modal's own label).
 * Anything else without a section lands in the catch-all rather than nowhere.
 */
export function sectionTypeForAccount(type: Account['type'] | string): string {
  if (type === 'checking') return 'current';
  if (type === 'assets') return 'asset';
  if (type === 'mortgage') return 'loan';
  return SECTION_TYPES.has(type) ? type : OTHER_SECTION_DEFINITION.type;
}

/**
 * The least an account must carry to be grouped: a name to sort by and a type
 * to file under. Deliberately structural, so a caller's own option shape
 * (`{ id: 'transfer:…', name, type }`) groups without being converted to a
 * full `Account` first.
 */
export interface GroupableAccount {
  name: string;
  type: Account['type'] | string;
}

/** Same shape the Accounts page's own groups use: a stable key, a heading, rows. */
export interface AccountSectionGroup<T extends GroupableAccount> {
  /** The section type — a stable React key, and how to look its styling up. */
  label: string;
  /** The section heading — the same words the Accounts page prints. */
  title: string;
  accounts: T[];
}

/**
 * Group accounts the way the Accounts page does: sections in order (catch-all
 * last), alphabetical inside each, empty sections omitted. Every account list
 * in the app — the page, the transfer-target dropdowns — reads from this one
 * function, so the groupings cannot drift apart.
 *
 * The input is never mutated: each section sorts its own filtered copy.
 */
export function groupAccountsBySection<T extends GroupableAccount>(
  accounts: readonly T[]
): AccountSectionGroup<T>[] {
  return [...ACCOUNT_SECTION_DEFINITIONS, OTHER_SECTION_DEFINITION]
    .map(section => ({
      label: section.type,
      title: section.title,
      accounts: accounts
        .filter(account => sectionTypeForAccount(account.type) === section.type)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    }))
    .filter(group => group.accounts.length > 0);
}
