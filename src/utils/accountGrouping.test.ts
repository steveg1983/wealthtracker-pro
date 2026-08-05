import { describe, it, expect } from 'vitest';
import {
  ACCOUNT_SECTION_DEFINITIONS,
  OTHER_SECTION_DEFINITION,
  groupAccountsBySection,
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
