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

/**
 * THE ROWS ARE ROWS (DESIGN_PASS §3.3, ruled for Accounts and applied here).
 *
 * Twenty-nine bordered, shadowed cards; a link-blue badge on the state that is
 * the absence of work; a link-blue £0.00. Everything below is the same claim
 * from different angles: on this page colour and lift belong to the rows that
 * need attention, and to nothing else.
 */
describe('ReconciliationAccountList — rows, not cards', () => {
  const rowClasses = (name: string): string => rowFor(name).className;

  it('separates rows with a hairline instead of boxing each one', () => {
    renderList();
    const classes = rowClasses('Second Account');

    expect(classes).toContain('border-b-line');
    // The card and its lift are gone: no rounded box, no shadow on hover.
    expect(classes).not.toMatch(/rounded-(xl|2xl|lg)/);
    expect(classes).not.toContain('shadow');
    expect(classes).not.toContain('border-2');
  });

  it('marks the row that needs attention down its leading edge, in amber', () => {
    renderList();
    // 'Second Account' states £220.00 against a £250.00 balance — they disagree.
    expect(rowClasses('Second Account')).toContain('border-l-amber-400');
    // …and the row with no closing balance entered has nothing to disagree
    // with, so it carries no mark.
    expect(rowClasses('Everyday Account')).not.toContain('amber');
    expect(rowClasses('Everyday Account')).toContain('border-l-transparent');
  });

  it('holds the mark\'s width open on every row so nothing shifts sideways', () => {
    renderList();
    // The 3px is geometry, present whatever the state; only the colour moves.
    // Without this the marked rows would indent their own contents relative to
    // their neighbours, and the column strip would label thin air.
    expect(rowClasses('Everyday Account')).toContain('border-l-[3px]');
    expect(rowClasses('Second Account')).toContain('border-l-[3px]');
  });

  it('keeps the label strip on the row\'s own horizontal metrics', () => {
    renderList();
    const strip = screen.getByTestId('reconciliation-column-labels');

    // Shared constant, not two literals that happen to agree: a strip padded
    // differently from its rows labels the wrong columns.
    ['border-l-[3px]', 'px-3', 'sm:px-4'].forEach(utility => {
      expect(strip.className).toContain(utility);
      expect(rowClasses('Everyday Account')).toContain(utility);
    });
  });

  it('spends no colour on the resting state', () => {
    const reconciled: ReconciliationGrouping = {
      mode: 'flat',
      summaries: [{ ...summary('a5', 'Settled Account', 100, 100), unreconciledCount: 0 }],
    };
    renderGrouping(reconciled);
    const badge = screen.getByText('All reconciled');

    // It was `bg-blue-100 text-blue-700` — the app's LINK blue, on a thing that
    // is not a link, on every unremarkable row at once.
    expect(badge.className).not.toMatch(/blue|amber|green|red/);
    // And no pill: the filled shape stays with the state that carries a figure.
    expect(badge.className).not.toContain('rounded-full');
    expect(badge.className).not.toMatch(/\bbg-/);
  });

  it('keeps the pill, and the count, where there IS work', () => {
    renderList();
    const badge = within(rowFor('Everyday Account')).getByText('3 unreconciled');

    // Neutral since the de-amber pass, and still a chip — it holds a figure.
    expect(badge.className).toContain('rounded-full');
    expect(badge.className).not.toMatch(/amber|blue/);
  });

  it('stops printing a difference of zero in link blue', () => {
    const settled: ReconciliationGrouping = {
      mode: 'flat',
      summaries: [summary('a6', 'Balanced Account', 100, 100)],
    };
    renderGrouping(settled);
    const difference = within(rowFor('Balanced Account')).getByText('£0.00');

    expect(difference.className).not.toContain('blue');
  });

  it('still colours the difference that disagrees', () => {
    renderList();
    // The one figure on the page that means something is wrong keeps its red,
    // and its weight: colour is reserved for the rows that need attention.
    const difference = within(rowFor('Second Account')).getByText('-£30.00');
    expect(difference.className).toContain('text-red-600');
    expect(difference.className).toContain('font-bold');
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
    expect(sections).toEqual(['Current Accounts(3 accounts)', 'Savings Accounts(1 account)']);

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
      .toContain('(3 accounts)');
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
      'Invented Bank(1 account)',
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

  it('says so when there is genuinely nothing to reconcile', () => {
    renderGrouping({ mode: 'flat', summaries: [] });

    expect(screen.getByText('No accounts to reconcile')).toBeInTheDocument();
    expect(screen.queryAllByTestId('reconciliation-column-labels')).toHaveLength(0);
  });
});

/**
 * FILTERED-EMPTY IS NOT EMPTY — the gate condition on batch 7 pass 2, said back
 * in assertions: "for every surface wired, confirm the *filtered*-empty path is
 * distinguishable from the empty path — conflating them is the failure mode,
 * and a shared component makes it easy to wire only one."
 *
 * So these tests do not merely check that each path renders. They check the two
 * paths render DIFFERENT things, from the same empty list, with the filter as
 * the only difference between them.
 */
describe('ReconciliationAccountList — an empty list has two meanings', () => {
  const filter = {
    label: 'Needs attention only',
    hiddenCount: 29,
    onClear: vi.fn(),
  };

  it('names the filter, the accounts it is hiding, and the way out', () => {
    render(
      <PreferencesProvider>
        <ReconciliationAccountList
          grouping={{ mode: 'flat', summaries: [] }}
          onSelectAccount={vi.fn()}
          filter={filter}
        />
      </PreferencesProvider>
    );

    expect(screen.getByText('Nothing needs attention right now')).toBeInTheDocument();
    // The two facts that turn "my accounts are gone" back into "my accounts are
    // hidden": how many, and what by.
    expect(document.body.textContent).toContain('29 accounts are hidden by');
    expect(screen.getByText('Needs attention only')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show all accounts' })).toBeInTheDocument();
  });

  it('gives the remedy back to the caller', () => {
    const onClear = vi.fn();
    render(
      <PreferencesProvider>
        <ReconciliationAccountList
          grouping={{ mode: 'flat', summaries: [] }}
          onSelectAccount={vi.fn()}
          filter={{ ...filter, onClear }}
        />
      </PreferencesProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show all accounts' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('is not the same screen as the empty one — same empty list, different state', () => {
    const { unmount } = render(
      <PreferencesProvider>
        <ReconciliationAccountList
          grouping={{ mode: 'flat', summaries: [] }}
          onSelectAccount={vi.fn()}
          filter={filter}
        />
      </PreferencesProvider>
    );
    const filtered = document.body.textContent ?? '';
    unmount();

    renderGrouping({ mode: 'flat', summaries: [] });
    const empty = document.body.textContent ?? '';

    // Distinguishable without reading carefully: different headline, and only
    // one of them claims there is nothing here.
    expect(filtered).not.toBe(empty);
    expect(filtered).toContain('Nothing needs attention right now');
    expect(filtered).not.toContain('No accounts to reconcile');
    expect(empty).toContain('No accounts to reconcile');
    expect(empty).not.toContain('hidden by');
  });

  it('calls an empty list empty when the filter is hiding nothing', () => {
    // A filter that is on over no accounts at all has not hidden anything, and
    // blaming it would send the user to press "Show all accounts" and find the
    // same blank list.
    render(
      <PreferencesProvider>
        <ReconciliationAccountList
          grouping={{ mode: 'flat', summaries: [] }}
          onSelectAccount={vi.fn()}
          filter={{ ...filter, hiddenCount: 0 }}
        />
      </PreferencesProvider>
    );

    expect(screen.getByText('No accounts to reconcile')).toBeInTheDocument();
    expect(screen.queryByText('Nothing needs attention right now')).not.toBeInTheDocument();
  });

  it('is left-aligned in both states, never centred', () => {
    // DESIGN_PASS §4: a centred block with a picture is a greeting; this is a
    // consequence and a remedy, and it reads down the left edge like the rest
    // of the page.
    const { unmount } = render(
      <PreferencesProvider>
        <ReconciliationAccountList
          grouping={{ mode: 'flat', summaries: [] }}
          onSelectAccount={vi.fn()}
          filter={filter}
        />
      </PreferencesProvider>
    );
    expect(document.querySelector('.text-center')).toBeNull();
    unmount();

    renderGrouping({ mode: 'flat', summaries: [] });
    expect(document.querySelector('.text-center')).toBeNull();
  });
});
