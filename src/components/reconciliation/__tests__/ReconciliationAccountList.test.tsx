import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { PreferencesProvider } from '../../../contexts/PreferencesContext';
import ReconciliationAccountList from '../ReconciliationAccountList';
import type { ReconciliationGrouping } from '../reconciliationGrouping';
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

const grouping: ReconciliationGrouping = {
  mode: 'grouped',
  groups: [
    {
      label: 'current',
      title: 'Current Accounts',
      summaries: [
        summary('a1', 'Everyday Account', null, 250),
        summary('a2', 'Second Account', 220, 250),
      ],
    },
  ],
};

const renderGrouping = (
  value: ReconciliationGrouping,
  onSelectAccount = vi.fn()
): ReturnType<typeof vi.fn> => {
  render(
    // The list formats through useCurrencyDecimal, which reads the display
    // currency from preferences.
    <PreferencesProvider>
      <ReconciliationAccountList grouping={value} onSelectAccount={onSelectAccount} />
    </PreferencesProvider>
  );
  return onSelectAccount;
};

const renderList = (onSelectAccount = vi.fn()) => renderGrouping(grouping, onSelectAccount);

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

/**
 * NESTING — the owner's bug, at the rendering end.
 *
 * "I cannot sort the reconciliation page by account type AND Institution, its
 * one or the other, unlike in Accounts where you can set them both to 'ON'."
 * Both on means institution sub-bands inside the type sections, and the thing
 * most easily got wrong is the column label strip: it heads a RUN OF ROWS, so
 * once nested there must be one per sub-band, not one stranded up at section
 * level with every sub-band's columns unlabelled beneath it.
 */
const nested: ReconciliationGrouping = {
  mode: 'grouped',
  groups: [
    {
      label: 'current',
      title: 'Current Accounts',
      summaries: [
        summary('a1', 'Everyday Account', 100, 100),
        summary('a2', 'Second Account', 220, 250),
        summary('a3', 'Third Account', 40, 40),
      ],
      subGroups: [
        {
          label: 'Invented Bank',
          title: 'Invented Bank',
          summaries: [summary('a1', 'Everyday Account', 100, 100), summary('a2', 'Second Account', 220, 250)],
        },
        {
          label: 'Second Invented Bank',
          title: 'Second Invented Bank',
          summaries: [summary('a3', 'Third Account', 40, 40)],
        },
      ],
    },
    {
      label: 'savings',
      title: 'Savings Accounts',
      summaries: [summary('a4', 'Rainy Day Account', 500, 500)],
      subGroups: [
        {
          label: 'Invented Bank',
          title: 'Invented Bank',
          summaries: [summary('a4', 'Rainy Day Account', 500, 500)],
        },
      ],
    },
  ],
};

const strips = (): HTMLElement[] => screen.getAllByTestId('reconciliation-column-labels');

describe('ReconciliationAccountList — both switches on', () => {
  it('nests the institution sub-bands inside the type sections', () => {
    renderGrouping(nested);

    // The type sections are still the outline: h2, as they were.
    const sections = screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent);
    // The count sits in a span with a CSS margin, so textContent runs on.
    expect(sections).toEqual(['Current Accounts(3)', 'Savings Accounts(1)']);

    // The institutions are groups rather than headings, so the page's outline
    // stays section → account name. The same treatment the Accounts page gives
    // its own sub-bands.
    const bands = screen.getAllByRole('group').map(g => g.getAttribute('aria-label'));
    expect(bands).toEqual([
      'Invented Bank, 2 accounts',
      'Second Invented Bank, 1 account',
      'Invented Bank, 1 account',
    ]);
  });

  it('heads every sub-band with the column labels, and heads nothing else', () => {
    renderGrouping(nested);

    // Three sub-bands, three strips. NOT two (one per section, orphaning the
    // rows below the first sub-heading), and not five (a section strip plus a
    // sub-band strip, labelling the columns twice over).
    expect(strips()).toHaveLength(3);

    // And each one is inside the sub-band whose rows it labels, not floating
    // above the whole section.
    screen.getAllByRole('group').forEach(band => {
      expect(within(band).getAllByTestId('reconciliation-column-labels')).toHaveLength(1);
    });
  });

  it('keeps the section count describing the whole band, not the first sub-band', () => {
    renderGrouping(nested);

    // Current Accounts holds three accounts across two institutions. A heading
    // that counted only the rows of its first sub-band would be a section
    // lying about its own size.
    expect(screen.getByRole('heading', { level: 2, name: /Current Accounts/ }).textContent)
      .toContain('(3)');
  });
});

describe('ReconciliationAccountList — one switch, and none', () => {
  it('heads each band once when there are no sub-bands', () => {
    renderGrouping({
      mode: 'grouped',
      groups: [
        { label: 'current', title: 'Current Accounts', summaries: [summary('a1', 'Everyday Account', 100, 100)] },
        { label: 'savings', title: 'Savings Accounts', summaries: [summary('a4', 'Rainy Day Account', 500, 500)] },
      ],
    });

    expect(strips()).toHaveLength(2);
    expect(screen.queryAllByRole('group')).toHaveLength(0);
  });

  it('bands by institution alone with no type sections in sight', () => {
    renderGrouping({
      mode: 'grouped',
      groups: [
        { label: 'Invented Bank', title: 'Invented Bank', summaries: [summary('a1', 'Everyday Account', 100, 100)] },
      ],
    });

    expect(screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)).toEqual([
      'Invented Bank(1)',
    ]);
    expect(strips()).toHaveLength(1);
  });

  it('draws one unheaded list when neither switch is on', () => {
    renderGrouping({
      mode: 'flat',
      summaries: [summary('a1', 'Everyday Account', 100, 100), summary('a4', 'Rainy Day Account', 500, 500)],
    });

    // What the Accounts page does with neither switch on (accountGrouping's
    // `flat` mode): a single list carrying no band chrome at all — no heading,
    // no count, nothing to fold.
    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0);
    expect(screen.queryAllByRole('group')).toHaveLength(0);
    // Still ONE strip: there is one run of rows, and it is still labelled.
    expect(strips()).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Everyday Account/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rainy Day Account/ })).toBeInTheDocument();
  });

  it('says so when the filters have left nothing to reconcile', () => {
    renderGrouping({ mode: 'flat', summaries: [] });

    expect(screen.getByText('No accounts to reconcile')).toBeInTheDocument();
    expect(screen.queryAllByTestId('reconciliation-column-labels')).toHaveLength(0);
  });
});
