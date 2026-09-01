import React, { useMemo, useState } from 'react';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import { useApp } from '../contexts/AppContextSupabase';
import { useToast } from '../contexts/ToastContext';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { useAccountNames } from '../hooks/useAccountNames';
import { getDateLocale } from '../utils/dateFormatter';
import { AlertTriangleIcon, PlusIcon, XIcon } from './icons';
import type { Category, Transaction } from '../types';

/**
 * Re-categorise past transactions — the housekeeping end of categories.
 *
 * ── WHY IT IS HERE AND NOT IN THE REVIEW BAND (owner, 1 Sep 2026) ───────────
 *
 * Accounts → Categorisation is where a transaction gets its FIRST category:
 * the bank review, the import backlog, the rows nobody has looked at. This is
 * the other job entirely — changing what has already been filed. The case that
 * asked for it is the commonest one in a real ledger: a category was created
 * this month, and three years of rows that belong in it are sitting in
 * "Personal spending" because that is where everything went before it existed.
 *
 * So the population here is the exact opposite of the review band's:
 * transactions that HAVE a category. Uncategorised rows are out of scope by
 * design — offering them here would be a second, competing way to do the one
 * job Categorisation already does, and the two would disagree about what had
 * been dealt with. Split parents carry a blank category and fall out of the
 * population on their own; a split LINE is filed inside its parent and is
 * edited there.
 *
 * ── THE FILTERS STACK, AND NOTHING IS SEARCHED UNTIL ONE IS SET ─────────────
 *
 * Rows AND together, because the driving question is a compound one: "the
 * Tesco rows I dumped in Personal spending", not "everything in Personal
 * spending" and not "everything that says Tesco". Nothing is listed until at
 * least one filter carries a value — a ledger of fifty thousand rows rendered
 * because a panel was opened is not an answer to any question.
 *
 * ── MIXED DIRECTIONS ARE ALLOWED (owner's ruling) ───────────────────────────
 *
 * Both pickers offer every income and expense leaf whatever the row's own
 * direction: a refund belongs under the expense category it refunds, and a
 * charge reversed into an income category is a filing somebody meant. What
 * keeps a mixed selection legible is the register's own colour and sign on
 * every amount — money out red and signed −, money in green and signed + — so
 * nobody bulk-files a receipt as a cost without seeing that they have.
 *
 * A category a row is ALREADY filed under is always shown, even when it is not
 * one of the leaves offered (a revaluation category, an account's To/From).
 * Otherwise the picker would quietly draw a row as something it is not.
 *
 * ── WHAT A CHANGE WRITES, AND WHAT IT NEVER DOES ────────────────────────────
 *
 * Exactly the three fields of a filing: the category, and the two flags that
 * say a human filed it (1 Sep ruling — filing ends review). Nothing here
 * deletes: a re-filing is not a removal, and the tool that can lose you a row
 * is Find duplicates, which asks about one pair at a time for that reason.
 *
 * The bulk change asks before it runs and can be taken back afterwards — one
 * shot, held for the sitting, because the undo exists for the press that was
 * wrong the moment it landed. It is not history; the next search clears it.
 */

/** Above this many matches the list stops drawing and says so. */
const DISPLAY_CAP = 200;

type FilterKind = 'text' | 'category' | 'account' | 'date' | 'amount' | 'tag';

/**
 * One filter row.
 *
 * Every kind's value lives on the same shape rather than in a union, so
 * switching a row's kind and switching back costs the user nothing they typed
 * — the same reason the payee sweep's transfer toggle keeps the category
 * underneath it. Only the fields the current kind reads are ever consulted.
 */
interface Filter {
  id: string;
  kind: FilterKind;
  text: string;
  categoryId: string;
  accountId: string;
  /** Inclusive, as `yyyy-mm-dd` — what a native date input hands over. */
  from: string;
  to: string;
  /** Amount bounds, matched against the SIZE of the row (see rowMatches). */
  min: string;
  max: string;
  tag: string;
}

const FILTER_KIND_LABELS: Record<FilterKind, string> = {
  text: 'Words in the description or notes',
  category: 'Current category',
  account: 'Account',
  date: 'Date range',
  amount: 'Amount',
  tag: 'Tag',
};

/** Distinct keys for filter rows, which have no natural identity of their own. */
let filterSeq = 0;

const newFilter = (kind: FilterKind = 'text'): Filter => ({
  id: `filter-${++filterSeq}`,
  kind,
  text: '',
  categoryId: '',
  accountId: '',
  from: '',
  to: '',
  min: '',
  max: '',
  tag: '',
});

/**
 * The calendar day a row falls on, as `yyyy-mm-dd` in the reader's own zone.
 *
 * Built from the local parts rather than from `toISOString`, which would move
 * a late-evening row to the next day for anyone east of Greenwich and to the
 * previous one for anyone west — and compared as text, which sorts the same
 * way the date is written, so a range check needs no arithmetic at all.
 */
const dayKey = (date: Date | string): string => {
  const value = new Date(date);
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
};

/**
 * An amount bound as the user typed it, or null when there is no bound.
 *
 * Always a magnitude: people think "£12.99", not "−12.99", and a bound that
 * behaved differently for money in and money out would be a trap on a screen
 * that deliberately shows both.
 */
const boundOf = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? Math.abs(value) : null;
};

/** Is this row an instruction yet, or an empty box? */
const filterHasValue = (filter: Filter): boolean => {
  switch (filter.kind) {
    case 'text':
      return filter.text.trim() !== '';
    case 'category':
      return filter.categoryId !== '';
    case 'account':
      return filter.accountId !== '';
    case 'date':
      return filter.from !== '' || filter.to !== '';
    case 'amount':
      return boundOf(filter.min) !== null || boundOf(filter.max) !== null;
    case 'tag':
      return filter.tag !== '';
  }
};

/**
 * One row against one filter. Applied to transfers as well as to the
 * population, so the exclusion below can be counted and said out loud rather
 * than being a silent shortfall in the results.
 */
const rowMatches = (transaction: Transaction, filter: Filter): boolean => {
  switch (filter.kind) {
    case 'text': {
      // Description OR notes — asked separately rather than of the two joined,
      // because a search that spanned the join would match across a boundary
      // no reader can see.
      const needle = filter.text.trim().toLowerCase();
      return (transaction.description ?? '').toLowerCase().includes(needle)
        || (transaction.notes ?? '').toLowerCase().includes(needle);
    }
    case 'category':
      return transaction.category === filter.categoryId;
    case 'account':
      return transaction.accountId === filter.accountId;
    case 'date': {
      const day = dayKey(transaction.date);
      return (filter.from === '' || day >= filter.from)
        && (filter.to === '' || day <= filter.to);
    }
    case 'amount': {
      const size = Math.abs(transaction.amount);
      const min = boundOf(filter.min);
      const max = boundOf(filter.max);
      return (min === null || size >= min) && (max === null || size <= max);
    }
    case 'tag':
      return (transaction.tags ?? []).includes(filter.tag);
  }
};

/** A category offered in a picker: the id, and how it reads. */
interface CategoryOption {
  id: string;
  label: string;
}

/** The filing a row carried before a bulk change, so it can be given back. */
interface PreviousFiling {
  id: string;
  category: string;
  categoryConfirmed?: boolean;
  needsReview?: boolean;
}

/** A run in flight — the same shape for a change and for undoing one. */
interface Progress {
  done: number;
  total: number;
}

const shortDate = (date: Date | string): string =>
  new Date(date).toLocaleDateString(getDateLocale(), {
    day: '2-digit', month: 'short', year: '2-digit',
  });

export default function RecategoriseSection(): React.JSX.Element {
  const { transactions, categories, updateTransaction } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const { showSuccess, showError } = useToast();
  // Closed accounts included: most of a long history's re-filing is in
  // accounts that were shut years ago, and every one of them has a name.
  const accountName = useAccountNames();

  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<Filter[]>(() => [newFilter()]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  /** Per-row picks, keyed by transaction id, until each is saved. */
  const [rowChoices, setRowChoices] = useState<Record<string, string>>({});
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [bulkCategory, setBulkCategory] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [changing, setChanging] = useState<Progress | null>(null);
  const [undoing, setUndoing] = useState<Progress | null>(null);
  /** What the last bulk change did, until the next search or press. */
  const [summary, setSummary] = useState<{ changed: number; failed: number; categoryId: string } | null>(null);
  /** The one shot back. Emptied by the next search, and by using it. */
  const [undoable, setUndoable] = useState<PreviousFiling[]>([]);
  const [undoneCount, setUndoneCount] = useState<number | null>(null);

  const running = changing !== null || undoing !== null;

  const categoriesById = useMemo(
    () => new Map(categories.map(category => [category.id, category])),
    [categories]
  );

  /**
   * "Food : Groceries" where the group adds something, the bare name where it
   * does not — the payee sweep's convention, so a category reads the same
   * wherever it is offered. A filing pointing at nothing says so: it is a real
   * state of real data, and the row it is on is exactly the one to re-file.
   */
  const categoryLabel = useMemo(() => (id: string): string => {
    const category = categoriesById.get(id);
    if (!category) return 'a category that no longer exists';
    const parent = category.parentId ? categoriesById.get(category.parentId) : undefined;
    return parent && parent.level !== 'type' ? `${parent.name} : ${category.name}` : category.name;
  }, [categoriesById]);

  /**
   * Every leaf a transaction may be filed under, banded by direction.
   *
   * A leaf is a category with no active children of its own, so both tree
   * shapes are covered: the usual type → group → category, and the flatter
   * type → category some ledgers carry. Inactive categories (a closed
   * account's) and the account To/From categories are never offered — a whole
   * transaction becomes a transfer through the register's own toggle, which
   * writes both sides, and offering the category here would be a second and
   * contradictory way to say the same thing.
   */
  const { incomeOptions, expenseOptions, offerableIds } = useMemo(() => {
    const childrenOf = new Map<string, Category[]>();
    for (const category of categories) {
      if (!category.parentId) continue;
      const siblings = childrenOf.get(category.parentId);
      if (siblings) siblings.push(category);
      else childrenOf.set(category.parentId, [category]);
    }
    const fileable = (category: Category): boolean =>
      category.isActive !== false && category.isTransferCategory !== true;
    const activeChildren = (id: string): Category[] =>
      (childrenOf.get(id) ?? []).filter(fileable);

    const leavesUnder = (rootId: string): CategoryOption[] => {
      const leaves: CategoryOption[] = [];
      for (const child of activeChildren(rootId)) {
        const grandchildren = activeChildren(child.id);
        const found = grandchildren.length > 0 ? grandchildren : [child];
        for (const leaf of found) leaves.push({ id: leaf.id, label: categoryLabel(leaf.id) });
      }
      return leaves.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
    };

    const rootsOf = (type: 'income' | 'expense'): Category[] =>
      categories.filter(category => category.level === 'type' && category.type === type);
    const income = rootsOf('income').flatMap(root => leavesUnder(root.id));
    const expense = rootsOf('expense').flatMap(root => leavesUnder(root.id));
    return {
      incomeOptions: income,
      expenseOptions: expense,
      offerableIds: new Set([...income, ...expense].map(option => option.id)),
    };
  }, [categories, categoryLabel]);

  /**
   * THE POPULATION: rows that already carry a category, transfers excluded.
   *
   * Blank-categoried rows are Categorisation's work, and a transfer takes no
   * category at all — it is money moving between the user's own accounts, and
   * both sides of it are already accounted for.
   */
  const population = useMemo(
    () => transactions.filter(
      transaction => transaction.type !== 'transfer' && (transaction.category ?? '').trim() !== ''
    ),
    [transactions]
  );

  const activeFilters = useMemo(() => filters.filter(filterHasValue), [filters]);

  const matched = useMemo(() => {
    if (activeFilters.length === 0) return [];
    return population
      .filter(transaction => activeFilters.every(filter => rowMatches(transaction, filter)))
      // Newest first, the register's own order: the rows somebody is looking
      // for are far likelier to be recent than to be at the start of a decade.
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [population, activeFilters]);

  /**
   * Transfers the same filters caught. Counted, never listed — and said out
   * loud, because a shortfall between "everything called Tesco" and what is on
   * screen is exactly the kind of gap that reads as lost money.
   */
  const transferMatches = useMemo(() => {
    if (activeFilters.length === 0) return 0;
    return transactions.filter(
      transaction => transaction.type === 'transfer'
        && activeFilters.every(filter => rowMatches(transaction, filter))
    ).length;
  }, [transactions, activeFilters]);

  /**
   * The categories the population actually uses — the headline filter's list.
   *
   * Plus whichever one a filter is currently SET to, even when nothing is
   * filed under it any more. That is not an edge case here, it is the tool
   * working: filing the last of "Personal spending" into a new category empties
   * it, and a control that stopped displaying the filter it is still applying
   * would be lying about what is on screen.
   */
  const categoriesInUse = useMemo(() => {
    const ids = new Set(population.map(transaction => transaction.category));
    for (const filter of filters) {
      if (filter.categoryId !== '') ids.add(filter.categoryId);
    }
    return [...ids]
      .map(id => ({ id, label: categoryLabel(id) }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [population, filters, categoryLabel]);

  /** The accounts the population sits in, closed ones named as such. */
  const accountsInUse = useMemo(() => {
    const ids = new Set(population.map(transaction => transaction.accountId));
    return [...ids]
      .map(id => ({ id, label: accountName(id) }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [population, accountName]);

  /** Every tag on the population, so the picker can only offer real ones. */
  const tagsInUse = useMemo(() => {
    const tags = new Set<string>();
    for (const transaction of population) {
      for (const tag of transaction.tags ?? []) tags.add(tag);
    }
    return [...tags].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [population]);

  const visible = matched.slice(0, DISPLAY_CAP);
  // Memoised because a bulk run re-renders this component once per write, and
  // the match it walks is not the drawn two hundred — it is every row the
  // filters caught, which on a long history is thousands.
  const selectedRows = useMemo(
    () => matched.filter(transaction => selectedIds.has(transaction.id)),
    [matched, selectedIds]
  );
  const allSelected = matched.length > 0 && selectedRows.length === matched.length;

  /**
   * A new question, so everything answering the old one goes: the ticks, the
   * unsaved picks, the account of the last press — and the one shot back,
   * which is about rows that may not even be in the new results.
   */
  const changeFilters = (next: Filter[]): void => {
    setFilters(next);
    setSelectedIds(new Set());
    setRowChoices({});
    setSummary(null);
    setUndoable([]);
    setUndoneCount(null);
  };

  const updateFilter = (id: string, changes: Partial<Filter>): void => {
    changeFilters(filters.map(filter => (filter.id === id ? { ...filter, ...changes } : filter)));
  };

  /**
   * Take a filter row away — or, when it is the last one, empty it. The panel
   * always offers somewhere to start; a section with no boxes in it looks
   * broken rather than finished.
   */
  const removeFilter = (id: string): void => {
    changeFilters(filters.length === 1 ? [newFilter()] : filters.filter(filter => filter.id !== id));
  };

  const toggleSelected = (id: string): void => {
    setSelectedIds(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /**
   * All means ALL — every row the filters matched, not the two hundred drawn.
   * That is the whole point of it: the press exists for the search too long to
   * work through by hand.
   */
  const toggleSelectAll = (): void => {
    setSelectedIds(allSelected ? new Set() : new Set(matched.map(transaction => transaction.id)));
  };

  /** The three fields a filing is, and the only three any press here writes. */
  const filedUnder = (categoryId: string): Partial<Transaction> => ({
    category: categoryId,
    categoryConfirmed: true,
    needsReview: false,
  });

  const chosenFor = (transaction: Transaction): string =>
    rowChoices[transaction.id] ?? transaction.category;

  const saveRow = async (transaction: Transaction): Promise<void> => {
    const categoryId = chosenFor(transaction);
    if (categoryId === '' || categoryId === transaction.category) return;
    setSavingRowId(transaction.id);
    try {
      await updateTransaction(transaction.id, filedUnder(categoryId));
      setRowChoices(previous => {
        const next = { ...previous };
        delete next[transaction.id];
        return next;
      });
      showSuccess(`Filed under ${categoryLabel(categoryId)}.`, 'Category changed');
    } catch (error) {
      showError(error);
    } finally {
      setSavingRowId(null);
    }
  };

  /**
   * The bulk press, one write at a time with the count on screen.
   *
   * Sequential rather than fanned out: these are hundreds of writes against
   * one ledger, the progress has to be true while it runs, and a failure has
   * to be attributable to a row rather than to a batch.
   *
   * Each row's previous filing is read off the snapshot the press was made
   * against, and recorded only once that row's write has landed — so the undo
   * can never offer to put back something that never moved.
   */
  const runBulkChange = async (): Promise<void> => {
    const rows = selectedRows;
    const categoryId = bulkCategory;
    setConfirming(false);
    if (rows.length === 0 || categoryId === '') return;
    setSummary(null);
    setUndoneCount(null);
    setChanging({ done: 0, total: rows.length });
    const previous: PreviousFiling[] = [];
    let failed = 0;
    for (const [index, transaction] of rows.entries()) {
      try {
        await updateTransaction(transaction.id, filedUnder(categoryId));
        previous.push({
          id: transaction.id,
          category: transaction.category,
          categoryConfirmed: transaction.categoryConfirmed,
          needsReview: transaction.needsReview,
        });
      } catch {
        failed += 1;
      }
      setChanging({ done: index + 1, total: rows.length });
    }
    setChanging(null);
    setSelectedIds(new Set());
    setUndoable(previous);
    setSummary({ changed: previous.length, failed, categoryId });
  };

  /**
   * Put the changed rows back exactly as they were — the category and both
   * flags, including the flags' absence, which is itself a state a row can be
   * in. One shot: once used, or once the search changes, it is gone.
   */
  const runUndo = async (): Promise<void> => {
    const rows = undoable;
    if (rows.length === 0) return;
    setUndoing({ done: 0, total: rows.length });
    let restored = 0;
    let failed = 0;
    for (const [index, filing] of rows.entries()) {
      try {
        await updateTransaction(filing.id, {
          category: filing.category,
          categoryConfirmed: filing.categoryConfirmed,
          needsReview: filing.needsReview,
        });
        restored += 1;
      } catch {
        failed += 1;
      }
      setUndoing({ done: index + 1, total: rows.length });
    }
    setUndoing(null);
    setUndoable([]);
    setSummary(null);
    setUndoneCount(restored);
    if (failed > 0) {
      showError(new Error(
        `${failed.toLocaleString()} of those could not be put back and keep the category this press gave them.`
      ));
    }
  };

  /**
   * A category picker as a native select: an optgroup per direction, and the
   * row's own filing pinned on top when it is not among the leaves offered.
   * Two hundred of these are drawn at once, so this is deliberately the plain
   * control rather than the app's searching combobox.
   */
  const categoryPicker = (
    value: string,
    onChange: (id: string) => void,
    ariaLabel: string,
    placeholder?: string
  ): React.JSX.Element => (
    <select
      value={value}
      onChange={event => onChange(event.target.value)}
      aria-label={ariaLabel}
      disabled={running}
      className="w-full min-h-[44px] sm:min-h-0 px-2 py-2 sm:py-1 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {value !== '' && !offerableIds.has(value) && (
        <option value={value}>{categoryLabel(value)}</option>
      )}
      {incomeOptions.length > 0 && (
        <optgroup label="Income">
          {incomeOptions.map(option => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </optgroup>
      )}
      {expenseOptions.length > 0 && (
        <optgroup label="Expense">
          {expenseOptions.map(option => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </optgroup>
      )}
    </select>
  );

  const fieldClass =
    'min-h-[44px] sm:min-h-0 px-2 py-2 sm:py-1 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50';

  const renderFilterInputs = (filter: Filter, position: number): React.JSX.Element => {
    switch (filter.kind) {
      case 'text':
        return (
          <input
            type="text"
            value={filter.text}
            onChange={event => updateFilter(filter.id, { text: event.target.value })}
            placeholder="Any words in the description or notes"
            aria-label={`Words to look for, filter ${position}`}
            disabled={running}
            className={`${fieldClass} flex-1 min-w-[12rem]`}
          />
        );
      case 'category':
        return (
          <select
            value={filter.categoryId}
            onChange={event => updateFilter(filter.id, { categoryId: event.target.value })}
            aria-label={`Current category, filter ${position}`}
            disabled={running}
            className={`${fieldClass} flex-1 min-w-[12rem]`}
          >
            <option value="">Choose a category…</option>
            {categoriesInUse.map(option => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        );
      case 'account':
        return (
          <select
            value={filter.accountId}
            onChange={event => updateFilter(filter.id, { accountId: event.target.value })}
            aria-label={`Account, filter ${position}`}
            disabled={running}
            className={`${fieldClass} flex-1 min-w-[12rem]`}
          >
            <option value="">Choose an account…</option>
            {accountsInUse.map(option => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        );
      case 'date':
        return (
          <>
            <input
              type="date"
              value={filter.from}
              onChange={event => updateFilter(filter.id, { from: event.target.value })}
              aria-label={`From date, filter ${position}`}
              disabled={running}
              className={fieldClass}
            />
            <input
              type="date"
              value={filter.to}
              onChange={event => updateFilter(filter.id, { to: event.target.value })}
              aria-label={`To date, filter ${position}`}
              disabled={running}
              className={fieldClass}
            />
          </>
        );
      case 'amount':
        return (
          <>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={filter.min}
              onChange={event => updateFilter(filter.id, { min: event.target.value })}
              placeholder="Smallest"
              aria-label={`Smallest amount, ignoring whether it went in or out, filter ${position}`}
              disabled={running}
              className={`${fieldClass} w-28`}
            />
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={filter.max}
              onChange={event => updateFilter(filter.id, { max: event.target.value })}
              placeholder="Largest"
              aria-label={`Largest amount, ignoring whether it went in or out, filter ${position}`}
              disabled={running}
              className={`${fieldClass} w-28`}
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              size only — 12.99 finds money in and money out alike
            </span>
          </>
        );
      case 'tag':
        return (
          <select
            value={filter.tag}
            onChange={event => updateFilter(filter.id, { tag: event.target.value })}
            aria-label={`Tag, filter ${position}`}
            disabled={running}
            className={`${fieldClass} flex-1 min-w-[12rem]`}
          >
            <option value="">Choose a tag…</option>
            {tagsInUse.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        );
    }
  };

  return (
    <section
      className="mt-6 bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-4 sm:p-6"
      aria-labelledby="recategorise-heading"
    >
      <div className="flex items-center gap-2">
        <h3 id="recategorise-heading" className="text-sm font-semibold text-gray-900 dark:text-white">
          Re-categorise past transactions
        </h3>
        <button
          type="button"
          onClick={() => setOpen(showing => !showing)}
          aria-expanded={open}
          className="ml-auto px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Change what is already filed — move an old category&rsquo;s rows into one you have just
        made, or correct a run of them. Transactions with no category yet belong in
        Accounts&nbsp;→&nbsp;Categorisation, and are not searched here.
      </p>

      {open && (
        <>
          <div className="mt-4 space-y-2">
            {filters.map((filter, index) => (
              <div key={filter.id} className="flex flex-wrap items-center gap-2">
                <select
                  value={filter.kind}
                  onChange={event => {
                    const kind = event.target.value;
                    if (kind === 'text' || kind === 'category' || kind === 'account'
                      || kind === 'date' || kind === 'amount' || kind === 'tag') {
                      updateFilter(filter.id, { kind });
                    }
                  }}
                  aria-label={`What to filter by, filter ${index + 1}`}
                  disabled={running}
                  className={fieldClass}
                >
                  {(Object.keys(FILTER_KIND_LABELS) as FilterKind[]).map(kind => (
                    <option key={kind} value={kind}>{FILTER_KIND_LABELS[kind]}</option>
                  ))}
                </select>
                {renderFilterInputs(filter, index + 1)}
                <button
                  type="button"
                  onClick={() => removeFilter(filter.id)}
                  disabled={running}
                  aria-label={`Remove filter ${index + 1}`}
                  title="Remove this filter"
                  className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:p-1.5 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  <XIcon size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => changeFilters([...filters, newFilter()])}
              disabled={running}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] sm:min-h-0 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <PlusIcon size={14} />
              Add a filter
            </button>
          </div>

          {/* ─ WHAT THE PRESS IS DOING, AND WHAT IT DID ────────────────────
              Outside the results below, and that placement is the whole
              point of it: a press that files two hundred rows under a new
              category takes every one of them OUT of the search that found
              them, so the list empties as the run lands. Inside the results
              this account of the run — and the Undo with it — would vanish
              at the exact moment it became the only thing on screen worth
              reading. */}
          {changing !== null && (
            <p role="status" className="mt-3 text-sm text-gray-500 dark:text-gray-400 tabular-nums">
              Changing {changing.done.toLocaleString()} of {changing.total.toLocaleString()}…
            </p>
          )}
          {undoing !== null && (
            <p role="status" className="mt-3 text-sm text-gray-500 dark:text-gray-400 tabular-nums">
              Putting back {undoing.done.toLocaleString()} of {undoing.total.toLocaleString()}…
            </p>
          )}
          {summary !== null && (
            <p role="status" className="mt-3 text-sm text-gray-700 dark:text-gray-200">
              {summary.changed > 0 && (
                <>
                  <strong>{summary.changed.toLocaleString()}</strong> transaction
                  {summary.changed === 1 ? ' is' : 's are'} now filed under{' '}
                  {categoryLabel(summary.categoryId)}.{' '}
                </>
              )}
              {summary.failed > 0 && (
                <span className="text-amber-700 dark:text-amber-400">
                  {summary.failed.toLocaleString()} could not be changed and keep their current
                  categories.{' '}
                </span>
              )}
              {undoable.length > 0 && (
                <button
                  type="button"
                  onClick={() => void runUndo()}
                  disabled={running}
                  className="underline underline-offset-2 font-medium text-gray-900 dark:text-white disabled:opacity-50"
                >
                  Undo
                </button>
              )}
            </p>
          )}
          {undoneCount !== null && (
            <p role="status" className="mt-3 text-sm text-gray-700 dark:text-gray-200">
              <strong>{undoneCount.toLocaleString()}</strong> transaction
              {undoneCount === 1 ? ' is' : 's are'} back under the categor
              {undoneCount === 1 ? 'y it' : 'ies they'} had before.
            </p>
          )}

          {activeFilters.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Fill in a filter and the transactions it matches are listed here. Nothing is
              searched until you ask something.
            </p>
          ) : matched.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              {activeFilters.length === 1
                ? 'No categorised transaction matches that filter.'
                : `No categorised transaction matches all ${activeFilters.length} of those filters at once.`}
              {' '}Rows with no category yet are never searched here, and neither are transfers.
            </p>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 min-h-[44px] sm:min-h-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    disabled={running}
                    aria-label={allSelected
                      ? 'Unselect all matched transactions'
                      : `Select all ${matched.length.toLocaleString()} matched transactions`}
                  />
                  {allSelected ? 'Unselect all' : `Select all ${matched.length.toLocaleString()}`}
                </label>
                {selectedRows.length > 0 && (
                  <>
                    <span className="text-sm text-gray-600 dark:text-gray-400 tabular-nums">
                      {selectedRows.length.toLocaleString()} selected
                    </span>
                    <span className="w-full sm:w-64">
                      {categoryPicker(
                        bulkCategory,
                        setBulkCategory,
                        'Category to file the selected transactions under',
                        'Choose a category…'
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirming(true)}
                      disabled={running || bulkCategory === ''}
                      className="px-4 py-2 min-h-[44px] sm:min-h-0 text-sm font-medium rounded-lg bg-primary-action text-on-primary-action hover:bg-primary-action-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Change {selectedRows.length.toLocaleString()} transaction{selectedRows.length === 1 ? '' : 's'}
                    </button>
                  </>
                )}
              </div>

              <div className="mt-3 overflow-x-auto">
                {/* A table on a desktop, a card per row on a phone — the house
                    reflow (see DuplicateSweepModal). Source order IS the
                    desktop column order, so below `sm` each cell is placed by
                    explicit grid coordinates instead. */}
                <table className="block sm:table w-full">
                  <thead className="hidden sm:table-header-group">
                    <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                      <th className="pb-2 w-8" aria-label="Select" />
                      <th className="text-left pb-2 font-medium">Date</th>
                      <th className="text-left pb-2 font-medium">Description</th>
                      <th className="text-left pb-2 font-medium">Account</th>
                      <th className="text-right pb-2 font-medium">Amount</th>
                      <th className="text-left pb-2 font-medium w-56">Category</th>
                      <th className="pb-2 w-20" />
                    </tr>
                  </thead>
                  <tbody className="block sm:table-row-group">
                    {visible.map(transaction => {
                      const chosen = chosenFor(transaction);
                      const changed = chosen !== transaction.category && chosen !== '';
                      const when = shortDate(transaction.date);
                      return (
                        <tr
                          key={transaction.id}
                          className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 py-2 sm:py-0 sm:table-row border-b border-gray-50 dark:border-gray-700/50 align-top"
                        >
                          <td className="block sm:table-cell col-start-1 row-start-1 sm:py-2 sm:pr-1 sm:align-top">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(transaction.id)}
                              onChange={() => toggleSelected(transaction.id)}
                              disabled={running}
                              aria-label={`Select ${transaction.description} on ${when}`}
                              className="mt-0.5"
                            />
                          </td>
                          <td className="block sm:table-cell col-start-2 row-start-2 sm:py-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {when}
                          </td>
                          <td className="block sm:table-cell col-start-2 row-start-1 min-w-0 sm:py-2 text-sm text-gray-900 dark:text-white">
                            <span className="block truncate sm:max-w-[18rem]">
                              {transaction.description}
                            </span>
                          </td>
                          <td className="block sm:table-cell col-start-3 row-start-2 min-w-0 sm:py-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                            <span className="block truncate sm:max-w-[10rem] text-right sm:text-left">
                              {accountName(transaction.accountId)}
                            </span>
                          </td>
                          {/* Sign as well as hue — the house amount idiom. A
                              mixed selection has to be legible to eyes that
                              cannot tell the two colours apart, and to a
                              screen reader saying the row aloud. */}
                          <td className={`block sm:table-cell col-start-3 row-start-1 sm:py-2 text-sm font-medium text-right tabular-nums whitespace-nowrap ${
                            transaction.amount < 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-green-600 dark:text-green-400'
                          }`}>
                            {transaction.amount < 0 ? '−' : '+'}
                            {formatCurrency(Math.abs(transaction.amount))}
                          </td>
                          <td className="block sm:table-cell col-span-2 col-start-2 row-start-3 mt-1 sm:mt-0 sm:py-2 sm:pr-2">
                            {categoryPicker(
                              chosen,
                              value => setRowChoices(previous => ({ ...previous, [transaction.id]: value })),
                              `Category for ${transaction.description} on ${when}`
                            )}
                          </td>
                          <td className="block sm:table-cell col-span-3 col-start-1 row-start-4 mt-1 sm:mt-0 sm:py-2 text-right">
                            <button
                              type="button"
                              onClick={() => void saveRow(transaction)}
                              disabled={!changed || running || savingRowId === transaction.id}
                              aria-label={`Save the category for ${transaction.description} on ${when}`}
                              className="px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {savingRowId === transaction.id ? 'Saving…' : 'Save'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {matched.length > DISPLAY_CAP && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Showing the first {DISPLAY_CAP.toLocaleString()} of {matched.length.toLocaleString()} matched —
                  narrow the search, or use the bulk change (it covers all{' '}
                  {matched.length.toLocaleString()} matched when everything is ticked).
                </p>
              )}

              {/* A zero renders nothing (house rule); a shortfall the user can
                  count for themselves does not. */}
              {transferMatches > 0 && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {transferMatches.toLocaleString()} transfer{transferMatches === 1 ? '' : 's'} matched
                  and {transferMatches === 1 ? 'is' : 'are'} not shown — transfers move money between
                  your accounts and don&rsquo;t take a category.
                </p>
              )}
            </>
          )}

          <p className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
            Changing history doesn&rsquo;t change future guesses — suggestions keep learning from
            everything you file, and bank-feed rules are unaffected.
          </p>
        </>
      )}

      {/* The consequence before the press, in its own numbers. "Replacing
          whatever category each currently has" is the part a count alone
          cannot say: these rows are not blank, and a bulk re-filing overwrites
          work somebody already did. */}
      {confirming && (
        <Modal
          isOpen
          onClose={() => setConfirming(false)}
          title={`Change ${selectedRows.length.toLocaleString()} transaction${selectedRows.length === 1 ? '' : 's'}?`}
          size="md"
        >
          <ModalBody>
            <p className="text-sm text-gray-700 dark:text-gray-200">
              This files {selectedRows.length.toLocaleString()} transaction
              {selectedRows.length === 1 ? '' : 's'} under{' '}
              <strong>{categoryLabel(bulkCategory)}</strong>, replacing whatever category each
              currently has.
            </p>
            <p className="mt-2 flex items-start gap-1.5 text-sm text-gray-600 dark:text-gray-300">
              <AlertTriangleIcon size={14} className="mt-0.5 flex-shrink-0" />
              <span>
                Nothing is deleted and no balance moves. You can put them all back straight
                afterwards, until the next search.
              </span>
            </p>
          </ModalBody>
          <ModalFooter>
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="px-4 py-2 min-h-[44px] text-sm font-medium border border-line dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void runBulkChange()}
                className="px-4 py-2 min-h-[44px] text-sm font-medium rounded-lg bg-primary-action text-on-primary-action hover:bg-primary-action-hover transition-colors"
              >
                Change them
              </button>
            </div>
          </ModalFooter>
        </Modal>
      )}
    </section>
  );
}
