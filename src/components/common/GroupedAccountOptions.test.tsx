import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import GroupedAccountOptions from './GroupedAccountOptions';

/**
 * The multi-select's share of the account grouping, pinned: sections in the
 * Accounts page's order, alphabetical inside each, empty sections absent —
 * and the call site's own option wording still its own.
 */

interface TestAccount {
  id: string;
  name: string;
  type: string;
  balance: number;
}

const account = (id: string, name: string, type: string, balance = 0): TestAccount =>
  ({ id, name, type, balance });

const select = (): HTMLSelectElement => screen.getByLabelText<HTMLSelectElement>('Accounts');

const sectionLabels = (): string[] =>
  Array.from(select().querySelectorAll('optgroup')).map(group => group.label);

/** Option text under one section heading. */
const optionsInSection = (label: string): string[] => {
  const group = Array.from(select().querySelectorAll('optgroup')).find(g => g.label === label);
  return group ? Array.from(group.querySelectorAll('option')).map(o => o.textContent ?? '') : [];
};

const renderMultiSelect = (accounts: TestAccount[], formatLabel?: (a: TestAccount) => string) =>
  render(
    <select aria-label="Accounts" multiple size={3} defaultValue={[]}>
      <GroupedAccountOptions accounts={accounts} formatLabel={formatLabel} />
    </select>
  );

const mixedAccounts: TestAccount[] = [
  account('a1', 'Zebra Savings', 'savings'),
  account('a2', 'Barclaycard', 'credit'),
  account('a3', 'Halifax Current', 'current'),
  account('a4', 'Alpha Savings', 'savings'),
  account('a5', 'Abbey Current', 'checking'),
];

describe('GroupedAccountOptions', () => {
  it('bands options into the Accounts page sections, in page order', () => {
    renderMultiSelect(mixedAccounts);

    expect(sectionLabels()).toEqual(['Current Accounts', 'Savings Accounts', 'Credit Cards']);
  });

  it('sorts alphabetically inside a section, case-insensitively', () => {
    renderMultiSelect([
      account('a1', 'zebra current', 'current'),
      account('a2', 'Alpha Current', 'current'),
      account('a3', 'beta current', 'current'),
    ]);

    expect(optionsInSection('Current Accounts')).toEqual([
      'Alpha Current', 'beta current', 'zebra current',
    ]);
  });

  it('omits sections nothing files under rather than printing bare headings', () => {
    renderMultiSelect([account('a1', 'Solo Investment', 'investment')]);

    expect(sectionLabels()).toEqual(['Investments']);
  });

  it('files a type with no section of its own under the catch-all, last', () => {
    renderMultiSelect([
      account('a1', 'Hoverboard Fund', 'hoverboard'),
      account('a2', 'Halifax Current', 'current'),
    ]);

    expect(sectionLabels()).toEqual(['Current Accounts', 'Other Accounts']);
  });

  it('prints the caller’s own option wording when it passes a formatter', () => {
    renderMultiSelect(
      [account('a1', 'Halifax Current', 'current', 1234.5)],
      (acc) => `${acc.name} (£${acc.balance.toFixed(2)})`
    );

    expect(optionsInSection('Current Accounts')).toEqual(['Halifax Current (£1234.50)']);
  });

  it('names the account when no formatter is given', () => {
    renderMultiSelect([account('a1', 'Halifax Current', 'current', 1234.5)]);

    expect(optionsInSection('Current Accounts')).toEqual(['Halifax Current']);
  });

  it('carries the account id as each option’s value', () => {
    renderMultiSelect(mixedAccounts);

    expect(Array.from(select().querySelectorAll('option')).map(o => o.value))
      .toEqual(['a5', 'a3', 'a4', 'a1', 'a2']);
  });
});
