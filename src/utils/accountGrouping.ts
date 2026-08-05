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
 * full `Account` first. `institution` is optional because most callers group
 * by type alone; the Accounts page's Institution band reads it.
 */
export interface GroupableAccount {
  name: string;
  type: Account['type'] | string;
  institution?: string;
}

/** Same shape the Accounts page's own groups use: a stable key, a heading, rows. */
export interface AccountSectionGroup<T extends GroupableAccount> {
  /** The section type — a stable React key, and how to look its styling up. */
  label: string;
  /** The section heading — the same words the Accounts page prints. */
  title: string;
  accounts: T[];
}

/** Sections in page order (catch-all last), empty ones dropped, input order kept. */
function bucketBySection<T extends GroupableAccount>(
  accounts: readonly T[]
): { section: AccountSectionDefinition; accounts: T[] }[] {
  return [...ACCOUNT_SECTION_DEFINITIONS, OTHER_SECTION_DEFINITION]
    .map(section => ({
      section,
      accounts: accounts.filter(account => sectionTypeForAccount(account.type) === section.type),
    }))
    .filter(bucket => bucket.accounts.length > 0);
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
  return bucketBySection(accounts).map(({ section, accounts: sectionAccounts }) => ({
    label: section.type,
    title: section.title,
    accounts: sectionAccounts
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
  }));
}

/**
 * How the Accounts page bands its list: two INDEPENDENT switches, not a choice
 * of one. Both on nests institutions inside the type sections; both off is a
 * single flat list.
 */
export interface AccountGroupingOptions {
  byType: boolean;
  byInstitution: boolean;
}

/** What today's page shows before anyone touches a switch. */
export const DEFAULT_ACCOUNT_GROUPING: AccountGroupingOptions = { byType: true, byInstitution: false };

/**
 * What a band groups BY. The page keys its collapsed-set entries off this
 * ("type:current", "institution:Coutts"), so a fold survives the other switch
 * being flipped and can never leak across the two dimensions.
 */
export type AccountGroupKind = 'type' | 'institution';

/**
 * Where an account with no institution files. Deliberately the same words as
 * the type catch-all: in both dimensions it means "nothing said where this
 * belongs", and it sorts last for the same reason.
 */
export const NO_INSTITUTION_TITLE = OTHER_SECTION_DEFINITION.title;

/** An institution band — a top-level band, or a sub-band inside a type section. */
export interface AccountInstitutionGroup<T extends GroupableAccount> {
  /** Stable key AND heading: the institution as first seen, or the catch-all. */
  label: string;
  title: string;
  accounts: T[];
}

/** One band of the grouped list, with institution sub-bands when both switches are on. */
export interface AccountDisplayGroup<T extends GroupableAccount> {
  kind: AccountGroupKind;
  /** The section type ('current') or the institution name — stable per kind. */
  label: string;
  title: string;
  /** Every account in the band, input order preserved for the caller to sort. */
  accounts: T[];
  /** Institution sub-bands, catch-all last. Present only when BOTH switches are on. */
  subGroups?: AccountInstitutionGroup<T>[];
}

/**
 * Flat carries no band chrome at all, so it is a separate shape rather than
 * one nameless group — the caller cannot accidentally draw a heading for it.
 */
export type AccountDisplayGrouping<T extends GroupableAccount> =
  | { mode: 'flat'; accounts: T[] }
  | { mode: 'grouped'; groups: AccountDisplayGroup<T>[] };

/** Comparison key for an institution: trimmed and case-folded ('' when unset). */
const institutionKey = (account: GroupableAccount): string =>
  (account.institution ?? '').trim().toLowerCase();

/**
 * The spelling each institution prints under: the casing that arrived first
 * across the WHOLE list. Resolved once and shared by every band, so a nested
 * view cannot head one section 'Coutts' and the next 'coutts' just because a
 * stray row was typed in lower case.
 */
function institutionDisplayNames(accounts: readonly GroupableAccount[]): Map<string, string> {
  const names = new Map<string, string>();
  accounts.forEach(account => {
    const key = institutionKey(account);
    if (key !== '' && !names.has(key)) names.set(key, (account.institution ?? '').trim());
  });
  return names;
}

/**
 * Bucket by institution, alphabetically, unfiled accounts last. Matching is
 * case-insensitive so 'AMEX' and 'Amex' are ONE institution, but the heading
 * prints the data's own spelling, never a normalised one nobody typed.
 */
function groupByInstitution<T extends GroupableAccount>(
  accounts: readonly T[],
  displayNames: Map<string, string>
): AccountInstitutionGroup<T>[] {
  const bands = new Map<string, AccountInstitutionGroup<T>>();
  accounts.forEach(account => {
    const key = institutionKey(account);
    const band = bands.get(key);
    if (band) {
      band.accounts.push(account);
      return;
    }
    const title = key === '' ? NO_INSTITUTION_TITLE : displayNames.get(key) ?? key;
    bands.set(key, { label: title, title, accounts: [account] });
  });
  return [...bands.entries()]
    .sort(([keyA, bandA], [keyB, bandB]) => {
      if (keyA === '') return 1;
      if (keyB === '') return -1;
      return bandA.title.localeCompare(bandB.title, undefined, { sensitivity: 'base' });
    })
    .map(([, band]) => band);
}

/**
 * The Accounts page's banding, for all four switch combinations:
 *  - type only          → the type sections, as they have always been;
 *  - institution only   → one band per institution, unfiled last;
 *  - both               → type sections with institution sub-bands inside;
 *  - neither            → one flat list.
 *
 * Order inside a band is the caller's input order: the page applies its own
 * Default/Name/Value sort to the innermost list, so this must not impose one.
 * The input is never mutated.
 */
export function groupAccountsForDisplay<T extends GroupableAccount>(
  accounts: readonly T[],
  options: AccountGroupingOptions
): AccountDisplayGrouping<T> {
  if (!options.byType && !options.byInstitution) {
    return { mode: 'flat', accounts: [...accounts] };
  }

  const displayNames = institutionDisplayNames(accounts);

  if (!options.byType) {
    return {
      mode: 'grouped',
      groups: groupByInstitution(accounts, displayNames).map(band => ({
        kind: 'institution',
        label: band.label,
        title: band.title,
        accounts: band.accounts,
      })),
    };
  }

  return {
    mode: 'grouped',
    groups: bucketBySection(accounts).map(({ section, accounts: sectionAccounts }) => ({
      kind: 'type',
      label: section.type,
      title: section.title,
      accounts: sectionAccounts,
      ...(options.byInstitution ? { subGroups: groupByInstitution(sectionAccounts, displayNames) } : {}),
    })),
  };
}

/** Where both switches are stored. Versioned: v1 held a single either/or choice. */
export const ACCOUNT_GROUPING_STORAGE_KEY = 'accountsGroupBy.v2';
/** The pre-toggle key, still read once so an existing view survives the upgrade. */
export const LEGACY_ACCOUNT_GROUPING_STORAGE_KEY = 'accountsGroupBy';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Read the stored switches, migrating the single v1 choice when v2 is absent:
 * 'institution' → institution only, anything else (including nothing stored)
 * → type only, which is what those users are looking at right now. Junk in
 * either slot falls back to the default rather than blanking the page.
 */
export function parseAccountGroupingPreference(
  stored: string | null,
  legacy: string | null
): AccountGroupingOptions {
  if (stored !== null) {
    try {
      const parsed: unknown = JSON.parse(stored);
      if (isRecord(parsed) && typeof parsed.byType === 'boolean' && typeof parsed.byInstitution === 'boolean') {
        return { byType: parsed.byType, byInstitution: parsed.byInstitution };
      }
    } catch {
      // Corrupt JSON must never wedge the page — fall through to the default.
    }
    return DEFAULT_ACCOUNT_GROUPING;
  }
  if (legacy === 'institution') {
    return { byType: false, byInstitution: true };
  }
  return DEFAULT_ACCOUNT_GROUPING;
}

/** The stored form of both switches. */
export function serializeAccountGroupingPreference(options: AccountGroupingOptions): string {
  return JSON.stringify({ byType: options.byType, byInstitution: options.byInstitution });
}
