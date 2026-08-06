/**
 * The drill-in list is LIVE.
 *
 * A drill target is a snapshot: the rows a figure was made of at the moment it
 * was clicked. Everything below is about the list refusing to be a snapshot —
 * a transaction filed in the editor a row opens (or anywhere else in the app)
 * must show its new category here at once, and, in the uncategorised chore
 * list, must LEAVE, because it is not outstanding any more.
 *
 * Targets are built exactly the way the pages build them (expandSplitTransactions
 * → computeIncomeExpense), so a disagreement between this list and the page
 * that opened it would fail here. The stand-in context notifies its consumers
 * the way the real one does, so "the data changed underneath the open drill"
 * means here what it means in the app.
 *
 * No real payees or amounts ever appear in this repo's fixtures.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import ReportDrillModal, { type ReportDrillTarget } from './ReportDrillModal';
import { computeIncomeExpense } from '../../utils/incomeExpense';
import { expandSplitTransactions } from '../../utils/transactionSplits';
import type { Category, Transaction, TransactionSplit } from '../../types';

interface AppData {
  transactions: Transaction[];
  transactionSplits: TransactionSplit[];
}

/** A subscribable stand-in for the app context: writing to it re-renders consumers. */
const store = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const state = {
    snapshot: { transactions: [], transactionSplits: [] } as AppData,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getSnapshot(): AppData {
      return state.snapshot;
    },
    /** What the real context does on every write: new data, then a re-render. */
    write(next: Partial<AppData>): void {
      state.snapshot = { ...state.snapshot, ...next };
      listeners.forEach(listener => listener());
    },
  };
  return state;
});

const mocks = vi.hoisted(() => ({
  applyCategoryToUncategorized: vi.fn(async (_ids: string[], _category: string) => 0),
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

vi.mock('../../contexts/AppContextSupabase', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useApp: () => ({
      ...useSyncExternalStore(store.subscribe, store.getSnapshot),
      applyCategoryToUncategorized: mocks.applyCategoryToUncategorized,
    }),
  };
});

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(),
    showSuccess: mocks.showSuccess,
    showError: mocks.showError,
    showWarning: vi.fn(),
    showInfo: vi.fn(),
    dismissToast: vi.fn(),
  }),
}));

vi.mock('../../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (n: number) => `£${Math.abs(Number(n)).toFixed(2)}`,
  }),
}));

// The editor's own behaviour is covered by EditTransactionModal's tests; here
// it only has to stand in for "a row was opened", so the list is what is under
// test.
vi.mock('../EditTransactionModal', () => ({
  default: ({ transaction }: { transaction: Transaction | null }) => (
    <div data-testid="edit-transaction-modal">Editing: {transaction?.description}</div>
  ),
}));

// The real picker reads the category tree from context; the inline-filing
// tests only need "the user chose a category on this row".
vi.mock('../CategorySelector', () => ({
  default: ({
    selectedCategory,
    onCategoryChange,
  }: {
    selectedCategory: string;
    onCategoryChange: (categoryId: string) => void;
  }) => (
    <button
      type="button"
      data-testid="inline-picker"
      data-selected={selectedCategory}
      onClick={() => onCategoryChange('cat-groceries')}
    >
      choose a category
    </button>
  ),
}));

const CATEGORIES: Category[] = [
  { id: 'type-income', name: 'Income', type: 'income', level: 'type', isSystem: true },
  { id: 'type-expense', name: 'Expense', type: 'expense', level: 'type', isSystem: true },
  { id: 'cat-salary', name: 'Salary', type: 'income', level: 'detail', parentId: 'type-income' },
  { id: 'cat-refunds', name: 'Refunds', type: 'income', level: 'detail', parentId: 'type-income' },
  { id: 'cat-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'type-expense' },
  { id: 'cat-fuel', name: 'Fuel', type: 'expense', level: 'detail', parentId: 'type-expense' },
  // The MS Money importer's parking bucket: a real id that means "not filed".
  { id: 'cat-unassigned', name: 'Unassigned', type: 'both', level: 'detail', isUnassignedBucket: true },
];

const txn = (over: Partial<Transaction> & { id: string }): Transaction => ({
  date: new Date('2026-07-10'),
  amount: -10,
  description: 'synthetic row',
  category: '',
  accountId: 'acc-1',
  type: 'expense',
  cleared: false,
  ...over,
});

/** Seed the context, as a page load does. */
function given(transactions: Transaction[], transactionSplits: TransactionSplit[] = []): void {
  store.write({ transactions, transactionSplits });
}

/** The uncategorised drill Categorisation opens, built the way that page builds it. */
function uncategorisedTarget(): ReportDrillTarget {
  const { transactions, transactionSplits } = store.getSnapshot();
  const flows = computeIncomeExpense(
    expandSplitTransactions(transactions, transactionSplits), [], CATEGORIES
  );
  return {
    title: 'Uncategorised — synthetic account',
    bucket: 'uncategorized',
    rows: flows.uncategorizedRows,
    total: null,
  };
}

/** The income drill the report's summary card opens. */
function incomeTarget(): ReportDrillTarget {
  const { transactions, transactionSplits } = store.getSnapshot();
  const flows = computeIncomeExpense(
    expandSplitTransactions(transactions, transactionSplits), [], CATEGORIES
  );
  return {
    title: 'Income Breakdown',
    bucket: 'income',
    rows: flows.incomeRows,
    total: flows.income.toNumber(),
  };
}

/** The account drill the balances report opens: the REAL rows, unexpanded. */
function accountTarget(accountId: string): ReportDrillTarget {
  return {
    title: 'synthetic account — This Month',
    bucket: 'neutral',
    rows: store.getSnapshot().transactions.filter(t => t.accountId === accountId),
    total: 0,
  };
}

/** Save a change to a transaction, as the editor does. */
function editInContext(id: string, changes: Partial<Transaction>): void {
  act(() => {
    store.write({
      transactions: store.getSnapshot().transactions.map(t => (t.id === id ? { ...t, ...changes } : t)),
    });
  });
}

/** The table row a description sits on — rows are addressed by what they say. */
function rowFor(description: string): HTMLElement {
  const row = screen.getByText(description).closest('tr');
  if (row === null) throw new Error(`No drill row for "${description}"`);
  return row;
}

function renderDrill(target: ReportDrillTarget): { onClose: ReturnType<typeof vi.fn> } {
  const onClose = vi.fn();
  render(<ReportDrillModal target={target} onClose={onClose} categories={CATEGORIES} />);
  return { onClose };
}

/** Mirrors AppContextSupabase.applyCategoryToUncategorized: fills BLANKS only. */
async function fileBlanksInContext(ids: string[], category: string): Promise<number> {
  const wanted = new Set(ids);
  let updated = 0;
  const transactions = store.getSnapshot().transactions.map(t => {
    if (!wanted.has(t.id) || t.isSplit === true || t.category !== '') return t;
    updated += 1;
    return { ...t, category };
  });
  store.write({ transactions });
  return updated;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.applyCategoryToUncategorized.mockImplementation(async () => 0);
  store.write({ transactions: [], transactionSplits: [] });
});

describe('ReportDrillModal — the uncategorised list is a chore list', () => {
  it('drops a row given a category in the editor, and keeps the rest', () => {
    given([
      txn({ id: 't1', description: 'synthetic unfiled one' }),
      txn({ id: 't2', description: 'synthetic unfiled two', amount: -20 }),
    ]);
    renderDrill(uncategorisedTarget());

    expect(screen.getByText('synthetic unfiled one')).toBeInTheDocument();
    expect(screen.getByText('synthetic unfiled two')).toBeInTheDocument();

    // The owner's exact case: the row was filed through the editor this list
    // opened, so the context has moved on while the target still holds the row
    // as it was.
    editInContext('t1', { category: 'cat-groceries' });

    expect(screen.queryByText('synthetic unfiled one')).not.toBeInTheDocument();
    expect(screen.getByText('synthetic unfiled two')).toBeInTheDocument();
  });

  it('drops a split LINE that has been filed, and keeps its sibling', () => {
    given(
      [txn({ id: 'p1', description: 'synthetic split parent', amount: -100, isSplit: true })],
      [
        { id: 'l1', transactionId: 'p1', category: 'cat-unassigned', amount: -60, sortOrder: 1 },
        { id: 'l2', transactionId: 'p1', category: 'cat-unassigned', amount: -40, sortOrder: 2 },
      ]
    );
    const target = uncategorisedTarget();
    // Both lines are outstanding: the importer's parking bucket is not a filing.
    expect(target.rows.map(row => row.id)).toEqual(['p1::split::l1', 'p1::split::l2']);

    renderDrill(target);
    expect(screen.getAllByText('synthetic split parent')).toHaveLength(2);

    // The writer matches lines by identity, so a filed line keeps its id.
    act(() => {
      store.write({
        transactionSplits: store.getSnapshot().transactionSplits.map(split =>
          split.id === 'l1' ? { ...split, category: 'cat-groceries' } : split
        ),
      });
    });

    expect(screen.getAllByText('synthetic split parent')).toHaveLength(1);
    expect(within(rowFor('synthetic split parent')).getByText('Unassigned')).toBeInTheDocument();
    expect(within(rowFor('synthetic split parent')).getByText('-£40.00')).toBeInTheDocument();
  });

  it('drops a row that has just become a split, as the page does', () => {
    given([
      txn({ id: 't1', description: 'synthetic unfiled one' }),
      txn({ id: 't2', description: 'synthetic unfiled two', amount: -20 }),
    ]);
    renderDrill(uncategorisedTarget());

    // Splitting blanks the parent's category and files the money on its lines,
    // and the page lists the LINES — so the parent stops being an outstanding
    // row rather than lingering as a permanently unfileable one.
    act(() => {
      store.write({
        transactions: store.getSnapshot().transactions.map(t =>
          t.id === 't1' ? { ...t, isSplit: true } : t
        ),
        transactionSplits: [
          { id: 'l1', transactionId: 't1', category: 'cat-groceries', amount: -6, sortOrder: 1 },
          { id: 'l2', transactionId: 't1', category: 'cat-fuel', amount: -4, sortOrder: 2 },
        ],
      });
    });

    expect(screen.queryByText('synthetic unfiled one')).not.toBeInTheDocument();
    expect(screen.getByText('synthetic unfiled two')).toBeInTheDocument();
  });

  it('keeps a row whose write was refused — it is still outstanding', async () => {
    given([
      txn({ id: 't1', description: 'synthetic unfiled one' }),
      txn({ id: 't2', description: 'synthetic unfiled two', amount: -20 }),
    ]);
    // The write fills BLANKS only: a row filed by someone else in the meantime
    // comes back untouched, and must therefore stay on the list.
    mocks.applyCategoryToUncategorized.mockImplementation(async () => 0);
    renderDrill(uncategorisedTarget());

    fireEvent.click(within(rowFor('synthetic unfiled one')).getByTestId('inline-picker'));
    fireEvent.click(screen.getByRole('button', { name: 'Save 1' }));

    await waitFor(() => expect(mocks.applyCategoryToUncategorized).toHaveBeenCalled());
    expect(screen.getByText('synthetic unfiled one')).toBeInTheDocument();
  });
});

describe('ReportDrillModal — inline filing', () => {
  it('removes the rows it files and leaves the others', async () => {
    given([
      txn({ id: 't1', description: 'synthetic unfiled one' }),
      txn({ id: 't2', description: 'synthetic unfiled two', amount: -20 }),
    ]);
    mocks.applyCategoryToUncategorized.mockImplementation(fileBlanksInContext);
    renderDrill(uncategorisedTarget());

    // Pick a category on the first row only.
    fireEvent.click(within(rowFor('synthetic unfiled one')).getByTestId('inline-picker'));
    fireEvent.click(screen.getByRole('button', { name: 'Save 1' }));

    await waitFor(() => {
      expect(screen.queryByText('synthetic unfiled one')).not.toBeInTheDocument();
    });
    expect(mocks.applyCategoryToUncategorized).toHaveBeenCalledWith(['t1'], 'cat-groceries');
    expect(mocks.showSuccess).toHaveBeenCalledWith('1 transaction categorised.', 'Categories applied');
    expect(screen.getByText('synthetic unfiled two')).toBeInTheDocument();
  });

  it('closes once the last outstanding row has been filed', async () => {
    given([txn({ id: 't1', description: 'synthetic unfiled one' })]);
    mocks.applyCategoryToUncategorized.mockImplementation(fileBlanksInContext);
    const { onClose } = renderDrill(uncategorisedTarget());

    fireEvent.click(screen.getByTestId('inline-picker'));
    fireEvent.click(screen.getByRole('button', { name: 'Save 1' }));

    // Exactly once: one mechanism removes rows, so there is one way to close.
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});

describe('ReportDrillModal — closing when the list empties', () => {
  it('closes when the last row is filed in the editor', () => {
    given([txn({ id: 't1', description: 'synthetic unfiled one' })]);
    const { onClose } = renderDrill(uncategorisedTarget());
    expect(onClose).not.toHaveBeenCalled();

    editInContext('t1', { category: 'cat-groceries' });

    expect(onClose).toHaveBeenCalledTimes(1);

    // One mechanism removes rows, so there is one way out: later changes to
    // the data do not ask an already-closed list to close again.
    act(() => {
      store.write({ transactions: [...store.getSnapshot().transactions, txn({ id: 't9' })] });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays open on a drill that was opened empty', () => {
    const { onClose } = renderDrill({
      title: 'Uncategorised — synthetic account',
      bucket: 'uncategorized',
      rows: [],
      total: null,
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('No transactions')).toBeInTheDocument();
  });
});

describe('ReportDrillModal — the other buckets', () => {
  it('keeps a re-categorised row in an income drill and shows its new category', () => {
    given([
      txn({ id: 'i1', description: 'synthetic pay', amount: 2000, type: 'income', category: 'cat-salary' }),
      txn({ id: 'i2', description: 'synthetic pay two', amount: 1000, type: 'income', category: 'cat-salary' }),
    ]);
    renderDrill(incomeTarget());
    expect(within(rowFor('synthetic pay')).getByText('Salary')).toBeInTheDocument();

    // Which rows an income drill covers is the REPORT's selection — a month, a
    // payee, a category — not something this list can re-derive, so a
    // re-categorised row stays, wearing its new category.
    editInContext('i1', { category: 'cat-refunds' });

    expect(within(rowFor('synthetic pay')).getByText('Refunds')).toBeInTheDocument();

    // Even a cross-type re-filing (a credit filed under an expense category)
    // stays: it is still one of the rows the figure was made of.
    editInContext('i1', { category: 'cat-groceries' });

    expect(within(rowFor('synthetic pay')).getByText('Groceries')).toBeInTheDocument();
    expect(screen.getByText('synthetic pay two')).toBeInTheDocument();
  });

  it('drops a deleted row and keeps the rest', () => {
    given([
      txn({ id: 'i1', description: 'synthetic pay', amount: 2000, type: 'income', category: 'cat-salary' }),
      txn({ id: 'i2', description: 'synthetic pay two', amount: 1000, type: 'income', category: 'cat-salary' }),
    ]);
    const { onClose } = renderDrill(incomeTarget());

    act(() => {
      store.write({ transactions: store.getSnapshot().transactions.filter(t => t.id !== 'i1') });
    });

    expect(screen.queryByText('synthetic pay')).not.toBeInTheDocument();
    expect(screen.getByText('synthetic pay two')).toBeInTheDocument();
    // An income drill is the report's selection, not a chore list: it never
    // closes itself.
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps an account drill on the real rows, split parents included', () => {
    given(
      [
        txn({ id: 'a1', description: 'synthetic account row', amount: -30 }),
        txn({ id: 'a2', description: 'synthetic split parent', amount: -100, isSplit: true }),
      ],
      [
        { id: 'l1', transactionId: 'a2', category: 'cat-groceries', amount: -60, sortOrder: 1 },
        { id: 'l2', transactionId: 'a2', category: 'cat-fuel', amount: -40, sortOrder: 2 },
      ]
    );
    renderDrill(accountTarget('acc-1'));

    // The register view: a split parent is one row of its own, not two lines.
    expect(screen.getByText('synthetic split parent')).toBeInTheDocument();
    expect(within(rowFor('synthetic account row')).getByText('-£30.00')).toBeInTheDocument();

    editInContext('a1', { description: 'synthetic account row (edited)', amount: -35 });

    expect(within(rowFor('synthetic account row (edited)')).getByText('-£35.00')).toBeInTheDocument();
    expect(screen.getByText('synthetic split parent')).toBeInTheDocument();
  });
});
