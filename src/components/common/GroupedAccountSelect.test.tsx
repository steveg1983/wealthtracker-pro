import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GroupedAccountSelect, { GroupedAccountOptions } from './GroupedAccountSelect';

/**
 * The one account dropdown, pinned: sections in the Accounts page's order,
 * alphabetical inside each, empty sections absent — and every call site's own
 * wording (labels, placeholder) still its own.
 */

interface TestAccount {
  id: string;
  name: string;
  type: string;
  balance: number;
}

const account = (id: string, name: string, type: string, balance = 0): TestAccount =>
  ({ id, name, type, balance });

const select = (): HTMLSelectElement => screen.getByLabelText<HTMLSelectElement>('Account');

const sectionLabels = (): string[] =>
  Array.from(select().querySelectorAll('optgroup')).map(group => group.label);

/** Option text in render order, placeholder included. */
const optionTexts = (): string[] =>
  Array.from(select().querySelectorAll('option')).map(option => option.textContent ?? '');

/** Option text under one section heading. */
const optionsInSection = (label: string): string[] => {
  const group = Array.from(select().querySelectorAll('optgroup')).find(g => g.label === label);
  return group ? Array.from(group.querySelectorAll('option')).map(o => o.textContent ?? '') : [];
};

const mixedAccounts: TestAccount[] = [
  account('a1', 'Zebra Savings', 'savings'),
  account('a2', 'Barclaycard', 'credit'),
  account('a3', 'Halifax Current', 'current'),
  account('a4', 'Alpha Savings', 'savings'),
  account('a5', 'Abbey Current', 'checking'),
];

describe('GroupedAccountSelect', () => {
  it('bands options into the Accounts page sections, in page order', () => {
    render(
      <GroupedAccountSelect
        aria-label="Account"
        accounts={mixedAccounts}
        value=""
        onChange={vi.fn()}
      />
    );

    expect(sectionLabels()).toEqual(['Current Accounts', 'Savings Accounts', 'Credit Cards']);
  });

  it('sorts alphabetically inside a section, case-insensitively', () => {
    render(
      <GroupedAccountSelect
        aria-label="Account"
        accounts={[
          account('a1', 'zebra current', 'current'),
          account('a2', 'Alpha Current', 'current'),
          account('a3', 'beta current', 'current'),
        ]}
        value=""
        onChange={vi.fn()}
      />
    );

    expect(optionsInSection('Current Accounts')).toEqual([
      'Alpha Current', 'beta current', 'zebra current',
    ]);
  });

  it('omits sections nothing files under rather than printing bare headings', () => {
    render(
      <GroupedAccountSelect
        aria-label="Account"
        accounts={[account('a1', 'Solo Investment', 'investment')]}
        value=""
        onChange={vi.fn()}
      />
    );

    expect(sectionLabels()).toEqual(['Investments']);
  });

  it('files a type with no section of its own under the catch-all, last', () => {
    render(
      <GroupedAccountSelect
        aria-label="Account"
        accounts={[
          account('a1', 'Hoverboard Fund', 'hoverboard'),
          account('a2', 'Halifax Current', 'current'),
        ]}
        value=""
        onChange={vi.fn()}
      />
    );

    expect(sectionLabels()).toEqual(['Current Accounts', 'Other Accounts']);
  });

  it('prints the caller’s own option wording when it passes a formatter', () => {
    render(
      <GroupedAccountSelect
        aria-label="Account"
        accounts={[account('a1', 'Halifax Current', 'current', 1234.5)]}
        value=""
        onChange={vi.fn()}
        formatLabel={(acc) => `${acc.name} (£${acc.balance.toFixed(2)})`}
      />
    );

    expect(optionsInSection('Current Accounts')).toEqual(['Halifax Current (£1234.50)']);
  });

  it('names the account when no formatter is given', () => {
    render(
      <GroupedAccountSelect
        aria-label="Account"
        accounts={[account('a1', 'Halifax Current', 'current', 1234.5)]}
        value=""
        onChange={vi.fn()}
      />
    );

    expect(optionsInSection('Current Accounts')).toEqual(['Halifax Current']);
  });

  it('leads with the placeholder when one is given, and with nothing when not', () => {
    const { unmount } = render(
      <GroupedAccountSelect
        aria-label="Account"
        accounts={[account('a1', 'Halifax Current', 'current')]}
        value=""
        onChange={vi.fn()}
        placeholder="Select account"
      />
    );
    expect(optionTexts()).toEqual(['Select account', 'Halifax Current']);
    unmount();

    render(
      <GroupedAccountSelect
        aria-label="Account"
        accounts={[account('a1', 'Halifax Current', 'current')]}
        value=""
        onChange={vi.fn()}
      />
    );
    expect(optionTexts()).toEqual(['Halifax Current']);
  });

  it('reports the chosen account id, not the event', () => {
    const onChange = vi.fn();
    render(
      <GroupedAccountSelect
        aria-label="Account"
        accounts={mixedAccounts}
        value=""
        onChange={onChange}
        placeholder="Select account"
      />
    );

    fireEvent.change(select(), { target: { value: 'a2' } });

    expect(onChange).toHaveBeenCalledWith('a2');
  });

  it('shows the selected account, however the sections reorder it', () => {
    render(
      <GroupedAccountSelect
        aria-label="Account"
        accounts={mixedAccounts}
        value="a1"
        onChange={vi.fn()}
        placeholder="Select account"
      />
    );

    expect(select().value).toBe('a1');
  });

  it('passes the call site’s own select attributes straight through', () => {
    render(
      <GroupedAccountSelect
        id="account-select"
        aria-label="Account"
        aria-describedby="account-error"
        className="house-styling"
        required
        disabled
        accounts={[account('a1', 'Halifax Current', 'current')]}
        value=""
        onChange={vi.fn()}
      />
    );

    const field = select();
    expect(field.id).toBe('account-select');
    expect(field).toBeRequired();
    expect(field).toBeDisabled();
    expect(field).toHaveClass('house-styling');
    expect(field).toHaveAttribute('aria-describedby', 'account-error');
  });
});

describe('GroupedAccountOptions', () => {
  it('groups the options of a select it does not own (the multi-select filter)', () => {
    render(
      <select aria-label="Account" multiple size={3} defaultValue={[]}>
        <GroupedAccountOptions accounts={mixedAccounts} />
      </select>
    );

    expect(sectionLabels()).toEqual(['Current Accounts', 'Savings Accounts', 'Credit Cards']);
    expect(optionsInSection('Savings Accounts')).toEqual(['Alpha Savings', 'Zebra Savings']);
  });
});
