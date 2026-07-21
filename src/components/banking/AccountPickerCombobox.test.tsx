import { describe, it, expect } from 'vitest';
import { accountMatchesSearch, groupAccountsForPicker } from './accountPickerOptions';
import type { Account } from '../../types';

const account = (overrides: Partial<Account>): Account => ({
  id: 'id',
  name: 'Name',
  type: 'current',
  balance: 0,
  currency: 'GBP',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides
} as Account);

describe('groupAccountsForPicker', () => {
  it('groups by section in fixed order and alphabetises within each group', () => {
    const groups = groupAccountsForPicker([
      account({ id: 's1', name: 'Zebra Saver', type: 'savings' }),
      account({ id: 'c1', name: 'Premier Bank', type: 'current' }),
      account({ id: 'cc1', name: 'Amex BA', type: 'credit' }),
      account({ id: 'c2', name: 'Basic Current', type: 'current' }),
      account({ id: 's2', name: 'apple ISA', type: 'savings' })
    ]);

    expect(groups.map((g) => g.label)).toEqual(['Current Accounts', 'Savings', 'Credit Cards']);
    expect(groups[0].accounts.map((a) => a.name)).toEqual(['Basic Current', 'Premier Bank']);
    // case-insensitive alphabetical
    expect(groups[1].accounts.map((a) => a.name)).toEqual(['apple ISA', 'Zebra Saver']);
  });

  it('merges current+checking and asset+assets into single sections', () => {
    const groups = groupAccountsForPicker([
      account({ id: '1', name: 'A', type: 'checking' }),
      account({ id: '2', name: 'B', type: 'current' }),
      account({ id: '3', name: 'C', type: 'asset' }),
      account({ id: '4', name: 'D', type: 'assets' })
    ]);
    expect(groups.map((g) => g.label)).toEqual(['Current Accounts', 'Assets']);
    expect(groups[0].accounts).toHaveLength(2);
    expect(groups[1].accounts).toHaveLength(2);
  });

  it('excludes inactive accounts and empty sections', () => {
    const groups = groupAccountsForPicker([
      account({ id: '1', name: 'Open', type: 'current' }),
      account({ id: '2', name: 'Closed', type: 'savings', isActive: false })
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Current Accounts');
  });
});

describe('accountMatchesSearch', () => {
  const premier = account({
    id: 'p',
    name: 'Premier Bank',
    institution: 'HSBC',
    sortCode: '40-18-41'
  });

  it('matches on account name, case-insensitively', () => {
    expect(accountMatchesSearch(premier, 'premier')).toBe(true);
    expect(accountMatchesSearch(premier, 'PREM')).toBe(true);
    expect(accountMatchesSearch(premier, 'zebra')).toBe(false);
  });

  it('matches on institution', () => {
    expect(accountMatchesSearch(premier, 'hsbc')).toBe(true);
  });

  it('matches sort code with or without dashes', () => {
    expect(accountMatchesSearch(premier, '40-18-41')).toBe(true);
    expect(accountMatchesSearch(premier, '401841')).toBe(true);
    expect(accountMatchesSearch(premier, '1841')).toBe(true);
    expect(accountMatchesSearch(premier, '99-99')).toBe(false);
  });

  it('empty search matches everything', () => {
    expect(accountMatchesSearch(premier, '')).toBe(true);
    expect(accountMatchesSearch(premier, '   ')).toBe(true);
  });
});
