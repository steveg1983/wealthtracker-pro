import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { PreferencesProvider } from '../../../contexts/PreferencesContext';
import ReconciliationAccountList, { type ReconciliationGroup } from '../ReconciliationAccountList';
import type { ReconciliationSummary } from '../../../hooks/useReconciliation';
import type { Account } from '../../../types';

/**
 * The reconciliation account list — DESIGN_PASS_2026-08 §3.2.
 *
 * Three changes are pinned here: the missing figure reads as absent and offers
 * its remedy (P6), the three metric labels are printed once per group rather
 * than once per row (P1), and the labels survive for screen readers and for the
 * narrow layout where the columns wrap.
 *
 * Every figure here is invented; this repo is public.
 */

const account = (id: string, name: string): Account => ({
  id,
  name,
  type: 'current',
  balance: 0,
  currency: 'GBP',
  institution: 'Test Bank',
  lastUpdated: new Date('2026-08-01'),
});

const summary = (
  id: string,
  name: string,
  bankBalance: number | null,
  accountBalance: number
): ReconciliationSummary => ({
  account: account(id, name),
  unreconciledCount: 3,
  bankBalance,
  accountBalance,
  clearedBalance: accountBalance,
  difference: bankBalance == null ? null : bankBalance - accountBalance,
  lastReconciledDate: null,
  lastReconciledBalance: null,
});

const groups: ReconciliationGroup[] = [
  {
    title: 'Current Accounts',
    summaries: [
      summary('a1', 'Everyday Account', null, 250),
      summary('a2', 'Second Account', 220, 250),
    ],
  },
];

const renderList = (onSelectAccount = vi.fn()) => {
  render(
    // The list formats through useCurrencyDecimal, which reads the display
    // currency from preferences.
    <PreferencesProvider>
      <ReconciliationAccountList groups={groups} onSelectAccount={onSelectAccount} />
    </PreferencesProvider>
  );
  return onSelectAccount;
};

const rowFor = (name: string): HTMLElement =>
  screen.getByRole('button', { name: new RegExp(name) });

describe('ReconciliationAccountList — a missing figure names its remedy', () => {
  it('prints an em-dash rather than N/A where no closing balance was entered', () => {
    renderList();
    const row = rowFor('Everyday Account');

    // "N/A" reads as "the app could not work it out". It can: nobody has
    // entered a statement balance yet.
    expect(within(row).queryByText('N/A')).not.toBeInTheDocument();
    // Twice: the bank balance itself, and the difference that cannot exist
    // without it.
    expect(within(row).getAllByText('—')).toHaveLength(2);
  });

  it('offers the remedy on the row, once', () => {
    renderList();
    const row = rowFor('Everyday Account');

    expect(within(row).getByText('Enter closing balance')).toBeInTheDocument();
    // Not repeated beside the difference — the row has already said it.
    expect(within(row).getAllByText('Enter closing balance')).toHaveLength(1);
  });

  it('says nothing about entering a balance on a row that has one', () => {
    renderList();
    const row = rowFor('Second Account');

    expect(within(row).queryByText('Enter closing balance')).not.toBeInTheDocument();
    expect(within(row).getByText('£220.00')).toBeInTheDocument();
  });

  it('keeps amber off the remedy — the thread owns amber on this page', () => {
    renderList();
    const remedy = within(rowFor('Everyday Account')).getByText('Enter closing balance');

    // P3: one amber in the building, and on this page it belongs to the
    // travelling next action, never to a link that is merely available.
    expect(remedy.className).not.toMatch(/amber|yellow|accent/);
  });

  it('reaches the reconciliation view by pressing the row it sits on', () => {
    const onSelectAccount = renderList();
    fireEvent.click(rowFor('Everyday Account'));

    // The remedy is text inside the row, not a control of its own: the row
    // already opens the place the balance is typed, so a second tab stop would
    // lead to the identical destination.
    expect(onSelectAccount).toHaveBeenCalledWith('a1');
  });
});

describe('ReconciliationAccountList — one label strip per group', () => {
  it('heads the group once instead of every row', () => {
    renderList();

    // One visual strip for the group…
    const strip = document.querySelector('[aria-hidden="true"]');
    expect(strip).not.toBeNull();
    expect(strip?.textContent).toBe('Bank BalanceAccount BalanceDifference');
  });

  it('keeps a label on every row for screen readers and the wrapped layout', () => {
    renderList();
    const row = rowFor('Everyday Account');

    // Still in the DOM, still announced — visually silent only from `md` up,
    // where the strip above has taken the job. Below `md` the row's columns
    // wrap under the account name and these are the only labels there are.
    const label = within(row).getByText('Account Balance');
    expect(label).toBeInTheDocument();
    expect(label.className).toContain('md:sr-only');
  });

  it('does not announce the strip twice over', () => {
    renderList();

    // The strip is a second voice for labels the rows still carry, so it is
    // hidden from assistive technology rather than duplicated into it.
    expect(document.querySelector('[aria-hidden="true"]')).toHaveAttribute('aria-hidden', 'true');
  });
});
