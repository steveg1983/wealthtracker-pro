import { describe, it, expect } from 'vitest';
import {
  ACCOUNT_SECTION_DEFINITIONS,
  OTHER_SECTION_DEFINITION,
  DEFAULT_ACCOUNT_GROUPING,
  accountMatchesQuery,
  compareAccountsByName,
  groupAccountsBySection,
  groupAccountsForDisplay,
  parseAccountGroupingPreference,
  serializeAccountGroupingPreference,
  type AccountDisplayGrouping,
  type AccountDisplayGroup,
  type GroupableAccount,
} from './accountGrouping';
import { ALL_ACCOUNT_SECTIONS } from './accountSections';
import type { Account } from '../types';

/**
 * The one grouping every account list reads — the Accounts page's sections in
 * the Accounts page's order. What these pin is that a transfer dropdown and
 * the page itself can never disagree about where an account belongs.
 */
describe('groupAccountsBySection', () => {
  const acct = (name: string, type: string) => ({ name, type });

  it('orders sections as the Accounts page does, catch-all last', () => {
    const groups = groupAccountsBySection([
      acct('Nationwide Cash ISA', 'savings'),
      acct('Barclaycard', 'credit'),
      acct('Hoverboard Fund', 'hoverboard'),
      acct('HSBC Current', 'current'),
    ]);
    expect(groups.map(g => g.title)).toEqual([
      'Current Accounts', 'Savings Accounts', 'Credit Cards', 'Other Accounts',
    ]);
  });

  it('sorts alphabetically inside a section, case-insensitively', () => {
    const groups = groupAccountsBySection([
      acct('zebra current', 'current'),
      acct('Alpha Current', 'current'),
      acct('beta current', 'current'),
    ]);
    expect(groups[0].accounts.map(a => a.name)).toEqual([
      'Alpha Current', 'beta current', 'zebra current',
    ]);
  });

  it('omits empty sections rather than printing bare headings', () => {
    const groups = groupAccountsBySection([acct('Solo', 'investment')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe('Investments');
  });

  it('exports the one comparator the lists that band themselves also use', () => {
    // The picker and the archive manager band with groupAccountsForDisplay,
    // which keeps input order for the Accounts page's sake, and then sort with
    // THIS. If it ever disagreed with the sort above, "alphabetical" would
    // mean two things in two corners of the app.
    const names = [acct('zebra current', 'current'), acct('Alpha Current', 'current')];
    expect([...names].sort(compareAccountsByName).map(a => a.name))
      .toEqual(groupAccountsBySection(names)[0].accounts.map(a => a.name));
  });

  it('files legacy spellings alongside their modern twins', () => {
    // 'checking' is the DB's 'current'; 'assets' the modal's 'asset';
    // 'mortgage' a loan. All three must land in the SAME section as the
    // canonical spelling, not in a section of their own.
    const groups = groupAccountsBySection([
      acct('Legacy Checking', 'checking'),
      acct('Modern Current', 'current'),
      acct('Home', 'assets'),
      acct('Car', 'asset'),
      acct('House Mortgage', 'mortgage'),
      acct('Car Loan', 'loan'),
    ]);
    const byTitle = new Map(groups.map(g => [g.title, g.accounts.map(a => a.name)]));
    expect(byTitle.get('Current Accounts')).toEqual(['Legacy Checking', 'Modern Current']);
    expect(byTitle.get('Loans')).toEqual(['Car Loan', 'House Mortgage']);
    expect(byTitle.get('Assets')).toEqual(['Car', 'Home']);
  });

  it('never drops an account, whatever its type', () => {
    const input = [
      acct('A', 'current'), acct('B', 'cash'), acct('C', 'other'),
      acct('D', 'liability'), acct('E', 'investment'),
    ];
    const grouped = groupAccountsBySection(input).flatMap(g => g.accounts);
    expect(grouped).toHaveLength(input.length);
  });

  it('leaves the caller\'s array untouched', () => {
    const input = [acct('Zed', 'current'), acct('Ada', 'current')];
    groupAccountsBySection(input);
    expect(input.map(a => a.name)).toEqual(['Zed', 'Ada']);
  });

  it('carries the caller\'s own fields through — a select needs its option value', () => {
    const groups = groupAccountsBySection([
      { id: 'transfer:acc-1', name: 'HSBC Current', type: 'current' as Account['type'] },
    ]);
    expect(groups[0].accounts[0].id).toBe('transfer:acc-1');
    // `label` is the section type — a stable key, and the way back to its styling.
    expect(groups[0].label).toBe(ACCOUNT_SECTION_DEFINITIONS[0].type);
  });
});

/**
 * The Accounts page's "Group by" switches are two INDEPENDENT toggles, so this
 * one function has to serve four views: type sections, institution bands, the
 * two nested, and neither. What these pin is that each view keeps the shape the
 * page draws — and that no account is lost in any of them.
 */
describe('groupAccountsForDisplay', () => {
  const acct = (name: string, type: string, institution?: string): GroupableAccount =>
    institution === undefined ? { name, type } : { name, type, institution };

  // Deliberately awkward: the same institution in two casings, one blank
  // string, one absent, spread across three sections and out of section order.
  const book: GroupableAccount[] = [
    acct('Calderbank Current', 'current', 'Calderbank'),
    acct('Argent Platinum', 'credit', 'ARGENT'),
    acct('Loose Change', 'current'),
    acct('Calderbank Savings', 'savings', 'calderbank'),
    acct('Argent Gold', 'credit', 'Argent'),
    acct('Barclays Current', 'current', 'Barclays'),
    acct('Blank Jar', 'savings', '   '),
  ];

  const groupsOf = (
    result: AccountDisplayGrouping<GroupableAccount>
  ): AccountDisplayGroup<GroupableAccount>[] => {
    if (result.mode !== 'grouped') throw new Error(`expected grouped bands, got ${result.mode}`);
    return result.groups;
  };
  const namesIn = (accounts: GroupableAccount[]): string[] => accounts.map(a => a.name);

  describe('Account Type on, Institution off', () => {
    const options = { byType: true, byInstitution: false };

    it('bands into the page\'s sections, in section order, empty ones omitted', () => {
      const groups = groupsOf(groupAccountsForDisplay(book, options));
      expect(groups.map(g => g.title)).toEqual(['Current Accounts', 'Savings Accounts', 'Credit Cards']);
      expect(groups.every(g => g.kind === 'type')).toBe(true);
      // The label is the section type — the page's collapse key and the way
      // back to the section's icon and colour.
      expect(groups[0].label).toBe('current');
    });

    it('keeps the caller\'s order inside a band — the page applies its own sort', () => {
      const groups = groupsOf(groupAccountsForDisplay(book, options));
      expect(namesIn(groups[0].accounts)).toEqual(['Calderbank Current', 'Loose Change', 'Barclays Current']);
    });

    it('carries no sub-bands when the Institution switch is off', () => {
      const groups = groupsOf(groupAccountsForDisplay(book, options));
      expect(groups.every(g => g.subGroups === undefined)).toBe(true);
    });
  });

  describe('Institution on, Account Type off', () => {
    const options = { byType: false, byInstitution: true };

    it('bands by institution alphabetically, unfiled accounts last', () => {
      const groups = groupsOf(groupAccountsForDisplay(book, options));
      expect(groups.map(g => g.title)).toEqual(['ARGENT', 'Barclays', 'Calderbank', 'No institution recorded']);
      expect(groups.every(g => g.kind === 'institution')).toBe(true);
    });

    it('merges casings into one band and prints the casing that arrived first', () => {
      const groups = groupsOf(groupAccountsForDisplay(book, options));
      // 'ARGENT' then 'Argent' is ONE institution — the book's own spelling wins.
      const amex = groups.find(g => g.title === 'ARGENT');
      expect(namesIn(amex?.accounts ?? [])).toEqual(['Argent Platinum', 'Argent Gold']);
      expect(groups.some(g => g.title === 'Argent')).toBe(false);
      // …and 'calderbank' joins 'Calderbank' rather than starting a band of its own.
      const calderbank = groups.find(g => g.title === 'Calderbank');
      expect(namesIn(calderbank?.accounts ?? [])).toEqual(['Calderbank Current', 'Calderbank Savings']);
    });

    it('files absent AND blank institutions under the one catch-all', () => {
      const groups = groupsOf(groupAccountsForDisplay(book, options));
      const other = groups.find(g => g.title === 'No institution recorded');
      // '   ' is not an institution called three spaces: it is nothing said.
      expect(namesIn(other?.accounts ?? [])).toEqual(['Loose Change', 'Blank Jar']);
    });

    it('ignores the accounts\' types entirely', () => {
      const groups = groupsOf(groupAccountsForDisplay(
        [acct('Solo', 'hoverboard', 'Calderbank')],
        options
      ));
      expect(groups).toHaveLength(1);
      expect(groups[0].title).toBe('Calderbank');
    });
  });

  describe('both switches on', () => {
    const options = { byType: true, byInstitution: true };

    it('nests institution sub-bands inside the type sections', () => {
      const groups = groupsOf(groupAccountsForDisplay(book, options));
      expect(groups.map(g => ({
        title: g.title,
        subs: (g.subGroups ?? []).map(s => ({ title: s.title, accounts: namesIn(s.accounts) })),
      }))).toEqual([
        {
          title: 'Current Accounts',
          subs: [
            { title: 'Barclays', accounts: ['Barclays Current'] },
            { title: 'Calderbank', accounts: ['Calderbank Current'] },
            { title: 'No institution recorded', accounts: ['Loose Change'] },
          ],
        },
        {
          // 'Calderbank Savings' carries the institution as 'calderbank', yet its
          // sub-band still reads 'Calderbank': the spelling is settled once across
          // the whole book, so one institution cannot head two sections two
          // different ways.
          title: 'Savings Accounts',
          subs: [
            { title: 'Calderbank', accounts: ['Calderbank Savings'] },
            { title: 'No institution recorded', accounts: ['Blank Jar'] },
          ],
        },
        {
          title: 'Credit Cards',
          subs: [{ title: 'ARGENT', accounts: ['Argent Platinum', 'Argent Gold'] }],
        },
      ]);
    });

    it('keeps the band\'s full account list alongside its sub-bands', () => {
      // The section heading counts and totals the WHOLE section, not one sub-band.
      const groups = groupsOf(groupAccountsForDisplay(book, options));
      expect(namesIn(groups[0].accounts)).toEqual(['Calderbank Current', 'Loose Change', 'Barclays Current']);
    });

    it('puts the catch-all sub-band last inside every section that has one', () => {
      const groups = groupsOf(groupAccountsForDisplay(book, options));
      groups.forEach(group => {
        const subs = group.subGroups ?? [];
        const catchAll = subs.findIndex(s => s.title === 'No institution recorded');
        if (catchAll !== -1) expect(catchAll).toBe(subs.length - 1);
      });
    });

    it('merges casings within a section, not across the whole book', () => {
      const groups = groupsOf(groupAccountsForDisplay(
        [acct('Card One', 'credit', 'ARGENT'), acct('Card Two', 'credit', 'argent')],
        options
      ));
      expect(groups[0].subGroups).toHaveLength(1);
      expect(groups[0].subGroups?.[0].title).toBe('ARGENT');
    });
  });

  describe('both switches off', () => {
    const options = { byType: false, byInstitution: false };

    it('returns one flat list in the caller\'s order, with no band chrome', () => {
      const result = groupAccountsForDisplay(book, options);
      expect(result.mode).toBe('flat');
      if (result.mode !== 'flat') throw new Error('expected a flat list');
      expect(namesIn(result.accounts)).toEqual(namesIn(book));
    });

    it('hands back a copy, not the caller\'s array', () => {
      const result = groupAccountsForDisplay(book, options);
      if (result.mode !== 'flat') throw new Error('expected a flat list');
      expect(result.accounts).not.toBe(book);
    });
  });

  it('never drops an account, in any of the four modes', () => {
    const counts = [
      { byType: true, byInstitution: false },
      { byType: false, byInstitution: true },
      { byType: true, byInstitution: true },
      { byType: false, byInstitution: false },
    ].map(options => {
      const result = groupAccountsForDisplay(book, options);
      return result.mode === 'flat'
        ? result.accounts.length
        : result.groups.reduce((sum, g) => sum + g.accounts.length, 0);
    });
    expect(counts).toEqual([book.length, book.length, book.length, book.length]);
    // Nesting must not duplicate either: the sub-bands hold each account once.
    const nested = groupAccountsForDisplay(book, { byType: true, byInstitution: true });
    const inSubBands = groupsOf(nested).flatMap(g => (g.subGroups ?? []).flatMap(s => namesIn(s.accounts)));
    expect(inSubBands.sort()).toEqual(namesIn(book).sort());
  });

  it('leaves the caller\'s array untouched in every mode', () => {
    const input = [acct('Zed', 'current', 'Calderbank'), acct('Ada', 'current')];
    const before = namesIn(input);
    groupAccountsForDisplay(input, { byType: true, byInstitution: true });
    groupAccountsForDisplay(input, { byType: false, byInstitution: true });
    groupAccountsForDisplay(input, { byType: false, byInstitution: false });
    expect(namesIn(input)).toEqual(before);
  });

  it('bands nothing into nothing rather than empty headings', () => {
    expect(groupsOf(groupAccountsForDisplay([], { byType: true, byInstitution: true }))).toEqual([]);
    expect(groupsOf(groupAccountsForDisplay([], { byType: false, byInstitution: true }))).toEqual([]);
  });
});

/**
 * The upgrade. Before the two switches there was ONE stored choice
 * ('type' | 'institution'); nobody's page may re-band itself just because a new
 * bundle landed.
 */
describe('parseAccountGroupingPreference', () => {
  it('defaults to Account Type alone — what an untouched page shows today', () => {
    expect(parseAccountGroupingPreference(null, null)).toEqual({ byType: true, byInstitution: false });
    expect(DEFAULT_ACCOUNT_GROUPING).toEqual({ byType: true, byInstitution: false });
  });

  it('migrates a stored v1 choice to the identical view', () => {
    expect(parseAccountGroupingPreference(null, 'type')).toEqual({ byType: true, byInstitution: false });
    expect(parseAccountGroupingPreference(null, 'institution')).toEqual({ byType: false, byInstitution: true });
  });

  it('prefers the v2 switches once they exist, whatever v1 still says', () => {
    const stored = serializeAccountGroupingPreference({ byType: true, byInstitution: true });
    expect(parseAccountGroupingPreference(stored, 'institution')).toEqual({ byType: true, byInstitution: true });
  });

  it('round-trips all four combinations', () => {
    [
      { byType: true, byInstitution: false },
      { byType: false, byInstitution: true },
      { byType: true, byInstitution: true },
      { byType: false, byInstitution: false },
    ].forEach(options => {
      expect(parseAccountGroupingPreference(serializeAccountGroupingPreference(options), null)).toEqual(options);
    });
  });

  it('falls back to the default on junk rather than wedging the page', () => {
    expect(parseAccountGroupingPreference('not json', null)).toEqual(DEFAULT_ACCOUNT_GROUPING);
    expect(parseAccountGroupingPreference('null', null)).toEqual(DEFAULT_ACCOUNT_GROUPING);
    expect(parseAccountGroupingPreference('{"byType":"yes"}', null)).toEqual(DEFAULT_ACCOUNT_GROUPING);
    // A stored v2 value, however broken, still beats re-reading v1: the user
    // has used the switches since, so the old choice is stale.
    expect(parseAccountGroupingPreference('not json', 'institution')).toEqual(DEFAULT_ACCOUNT_GROUPING);
    expect(parseAccountGroupingPreference(null, 'nonsense')).toEqual(DEFAULT_ACCOUNT_GROUPING);
  });
});

/**
 * The drift guard. The icon-carrying sections the pages draw are built FROM
 * these definitions — if the two lists ever disagree on order or wording, a
 * dropdown and the Accounts page would band the same accounts differently.
 */
describe('section definitions and the styled sections stay in step', () => {
  it('same sections, same order, same titles', () => {
    expect(ALL_ACCOUNT_SECTIONS.map(s => ({ type: s.type, title: s.title }))).toEqual(
      [...ACCOUNT_SECTION_DEFINITIONS, OTHER_SECTION_DEFINITION]
    );
  });
});

/**
 * What a picker's search box answers to. One definition of "matches", shared
 * by every account combobox — the bank-link wizard used to carry its own.
 */
describe('accountMatchesQuery', () => {
  const premier: GroupableAccount = {
    name: 'Premier Bank',
    type: 'current',
    institution: 'HSBC',
    sortCode: '40-18-41',
  };

  it('matches the account name, case-insensitively', () => {
    expect(accountMatchesQuery(premier, 'premier')).toBe(true);
    expect(accountMatchesQuery(premier, 'PREM')).toBe(true);
    expect(accountMatchesQuery(premier, 'zebra')).toBe(false);
  });

  it('matches the institution, so a bank name finds accounts named nothing like it', () => {
    expect(accountMatchesQuery(premier, 'hsbc')).toBe(true);
    expect(accountMatchesQuery({ name: 'ISA', type: 'savings' }, 'hsbc')).toBe(false);
  });

  it('matches a sort code with or without its dashes', () => {
    expect(accountMatchesQuery(premier, '40-18-41')).toBe(true);
    expect(accountMatchesQuery(premier, '401841')).toBe(true);
    expect(accountMatchesQuery(premier, '1841')).toBe(true);
    expect(accountMatchesQuery(premier, '0184')).toBe(true); // spans two dashes
    expect(accountMatchesQuery(premier, '99-99')).toBe(false);
    // The dash-stripping path needs two digits of its own, so a stray digit
    // inside a word does not drag in every sort code that contains it.
    expect(accountMatchesQuery(premier, 'x4')).toBe(false);
  });

  it('matches everything on an empty or blank query', () => {
    expect(accountMatchesQuery(premier, '')).toBe(true);
    expect(accountMatchesQuery(premier, '   ')).toBe(true);
  });
});
