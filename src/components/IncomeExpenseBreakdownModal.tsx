import React, { useEffect, useMemo, useRef, useState } from 'react';
import CategorySelector from './CategorySelector';
import { XIcon } from './icons';
import { Modal, ModalBody } from './common/Modal';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { bucketContribution, buildCategoryKindLookup, classifyFlow } from '../utils/incomeExpense';
import { buildCategoryNameLookup } from '../utils/categoryNames';
import { toDecimal } from '../utils/decimal';
import type { Category } from '../types';
import type { SplitExpandedTransaction } from '../utils/transactionSplits';
import { getDateLocale } from '../utils/dateFormatter';

/**
 * The income/expense breakdown pop-up, shared by the Dashboard and Reports —
 * one implementation so the two can never drift.
 *
 * Steve's spec: show the CATEGORY alongside the description and amount,
 * grouped in category sections (with subtotals), and let the user re-sort by
 * clicking any column heading. Rows open the Edit Transaction modal; credits
 * display negative so the list visibly sums to its total.
 */

/**
 * 'neutral' is the account view: rows keep their own signed amount (money in
 * positive, money out negative) and the total is the net movement — used when
 * the drill-in is "this account, this period" rather than one side of the
 * income/expense report.
 */
export type BreakdownBucket = 'income' | 'expense' | 'uncategorized' | 'neutral';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  bucket: BreakdownBucket;
  rows: SplitExpandedTransaction[];
  /** The header figure the rows sum to (null for the uncategorised view). */
  total: number | null;
  categories: Category[];
  onEditTransaction: (transactionId: string) => void;
  /**
   * Present only on the uncategorised drill: turns the Category column into
   * an inline picker so rows can be filed WITHOUT opening each one. Choices
   * accumulate; Save appears in the header once any exist; a row leaves the
   * list as soon as the save has given it a category. Receives categoryId →
   * transaction ids, returns rows updated. Split lines are excluded — their
   * category lives on the split line, not the parent this callback fills.
   */
  onApplyCategories?: (assignments: Map<string, string[]>) => Promise<number>;
}

type SortKey = 'category' | 'date' | 'description' | 'amount';

const CAP = 500;

export default function IncomeExpenseBreakdownModal({
  isOpen,
  onClose,
  title,
  bucket,
  rows,
  total,
  categories,
  onEditTransaction,
  onApplyCategories,
}: Props): React.JSX.Element {
  const { formatCurrency } = useCurrencyDecimal();
  const inlineFiling = bucket === 'uncategorized' && onApplyCategories !== undefined;

  // Row id → chosen category ('' = choice cleared).
  const [pendingChoices, setPendingChoices] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  /**
   * Where this list is in its life: 'empty' until it has had a row on it,
   * 'working' while it has, 'closed' once its emptying has been reported. See
   * the auto-close below — it must happen once, and never to a list that was
   * opened with nothing on it.
   */
  const phase = useRef<'empty' | 'working' | 'closed'>('empty');

  // A fresh drill is a fresh slate.
  useEffect(() => {
    if (isOpen) {
      setPendingChoices({});
      phase.current = 'empty';
    }
  }, [isOpen]);

  /**
   * The uncategorised list is a CHORE list: a row that now has a real category
   * has been done and leaves, however it was filed — by the picker below, in
   * the editor a row opens, or anywhere else in the app. It is judged by the
   * shared classifier (utils/incomeExpense), never a local test, so this list
   * can never disagree with the page that opened it.
   *
   * Every other bucket is the HOST's own selection — one payee, one month, one
   * account — and only the host can say what belongs in it, so those rows are
   * shown exactly as given (re-categorised or not; it is still spending).
   */
  const visibleRows = useMemo(() => {
    if (bucket !== 'uncategorized') return rows;
    const kinds = buildCategoryKindLookup(categories);
    return rows.filter(row => classifyFlow(row, kinds) === 'uncategorized');
  }, [rows, bucket, categories]);

  // Latest-callback ref, for the reason common/Modal keeps one: hosts pass an
  // inline onClose whose identity changes on every render, and the auto-close
  // below must fire when the LIST empties — once — not whenever a parent
  // re-renders.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Filing the last outstanding row finishes the job this list was opened to
  // do, so it closes rather than sitting on "No transactions". A list that was
  // opened empty stays put to say so.
  useEffect(() => {
    if (!isOpen || bucket !== 'uncategorized') return;
    if (visibleRows.length > 0) {
      phase.current = 'working';
    } else if (phase.current === 'working') {
      phase.current = 'closed';
      onCloseRef.current();
    }
  }, [isOpen, bucket, visibleRows]);

  // Only what is still on the list can be filed — a row categorised elsewhere
  // while the drill was open takes its pending choice with it.
  const pendingIds = useMemo(
    () => visibleRows.filter(row => (pendingChoices[row.id] ?? '') !== '').map(row => row.id),
    [visibleRows, pendingChoices]
  );

  const handleSave = async (): Promise<void> => {
    if (!onApplyCategories || saving) return;
    const assignments = new Map<string, string[]>();
    for (const rowId of pendingIds) {
      const categoryId = pendingChoices[rowId];
      const list = assignments.get(categoryId);
      if (list) list.push(rowId);
      else assignments.set(categoryId, [rowId]);
    }
    if (assignments.size === 0) return;
    setSaving(true);
    try {
      await onApplyCategories(assignments);
      // Saved rows leave the list as the context catches up: they have real
      // categories now, so the classifier above stops counting them as
      // outstanding. A row the write REFUSED (it was filed by someone else in
      // the meantime) stays, honestly, instead of being hidden locally.
      setPendingChoices({});
    } finally {
      // On failure the choices stay put — nothing the user picked is lost.
      setSaving(false);
    }
  };
  // Category sections by default — the Money-style view.
  const [sortKey, setSortKey] = useState<SortKey>('category');
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  // One shared definition of a category's display name (utils/categoryNames).
  const categoryName = useMemo(() => buildCategoryNameLookup(categories), [categories]);

  const valueOf = (t: SplitExpandedTransaction): number =>
    bucket === 'income' || bucket === 'expense' ? bucketContribution(t, bucket) : t.amount;

  const handleSort = (key: SortKey): void => {
    if (key === sortKey) setSortDir(d => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      // Sensible first direction per column: newest dates and biggest
      // amounts first; names A→Z.
      setSortDir(key === 'date' || key === 'amount' ? -1 : 1);
    }
  };

  // Either a flat sorted list, or category sections (each with subtotal),
  // capped so an All-time window can't render tens of thousands of rows.
  const view = useMemo(() => {
    const sorted = [...visibleRows];
    if (sortKey === 'date') {
      sorted.sort((a, b) => sortDir * (new Date(a.date).getTime() - new Date(b.date).getTime()));
    } else if (sortKey === 'description') {
      sorted.sort((a, b) => sortDir * a.description.localeCompare(b.description, undefined, { sensitivity: 'base' }));
    } else if (sortKey === 'amount') {
      sorted.sort((a, b) => sortDir * (valueOf(a) - valueOf(b)));
    }

    if (sortKey !== 'category') {
      return { sections: [{ name: null as string | null, subtotal: 0, rows: sorted.slice(0, CAP) }], truncated: Math.max(0, sorted.length - CAP) };
    }

    // Category sections: subtotal per section (Decimal), sections ordered by
    // |subtotal| descending (dir flips it), rows newest-first inside.
    const byCategory = new Map<string, SplitExpandedTransaction[]>();
    for (const t of sorted) {
      const name = categoryName(t.category);
      const list = byCategory.get(name);
      if (list) list.push(t);
      else byCategory.set(name, [t]);
    }
    const sections = [...byCategory.entries()].map(([name, sectionRows]) => ({
      name: name as string | null,
      subtotal: sectionRows.reduce((s, t) => s.plus(toDecimal(valueOf(t))), toDecimal(0)).toNumber(),
      rows: sectionRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    }));
    sections.sort((a, b) => sortDir * (Math.abs(b.subtotal) - Math.abs(a.subtotal)));

    // Apply the cap across sections in order.
    let budget = CAP;
    let truncated = 0;
    const capped = [];
    for (const s of sections) {
      if (budget <= 0) { truncated += s.rows.length; continue; }
      const take = s.rows.slice(0, budget);
      truncated += s.rows.length - take.length;
      budget -= take.length;
      capped.push({ ...s, rows: take });
    }
    return { sections: capped, truncated };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRows, sortKey, sortDir, categoryName, bucket]);

  const colourClass = bucket === 'income'
    ? 'text-green-600 dark:text-green-400'
    : bucket === 'expense'
      ? 'text-red-600 dark:text-red-400'
      : '';

  // Money in reads green, money out reads red — used for rows, section subtotals
  // and the footer total, so a section can never disagree with the rows inside it.
  const signedColour = (amount: number): string =>
    amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

  const arrow = (key: SortKey): string => (sortKey === key ? (sortDir === 1 ? ' ↑' : ' ↓') : '');

  // Headings sit CENTRED over their columns — the app-wide convention.
  const headerButton = (key: SortKey, label: string, _align: 'left' | 'right' = 'left') => (
    <th className="pb-2 font-medium text-center">
      <button
        type="button"
        onClick={() => handleSort(key)}
        className="hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        title={`Sort by ${label.toLowerCase()}`}
      >
        {label}{arrow(key)}
      </button>
    </th>
  );

  const renderRow = (t: SplitExpandedTransaction) => {
    const value = valueOf(t);
    const rowColour = colourClass || signedColour(value);
    return (
      <tr
        key={t.id}
        onClick={() => onEditTransaction(t.splitParentId ?? t.id)}
        className="grid grid-cols-[auto_1fr_auto] gap-x-3 py-1 sm:py-0 sm:table-row border-b border-gray-50 dark:border-gray-700/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
        title={bucket === 'uncategorized' ? 'Click to give this transaction a category' : 'Click to view or edit this transaction'}
      >
        <td className="block sm:table-cell py-2 pr-0 sm:pr-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {new Date(t.date).toLocaleDateString(getDateLocale(), { day: '2-digit', month: 'short', year: '2-digit' })}
        </td>
        <td className="block sm:table-cell min-w-0 py-2 pr-0 sm:pr-3 text-sm text-gray-900 dark:text-white">
          {t.description}
          {(bucket === 'income' || bucket === 'expense') && value < 0 && (
            <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">(credit)</span>
          )}
        </td>
        {inlineFiling && !t.isSplitLine ? (
          // Picking is not opening: the cell swallows the click so the row's
          // click-to-edit stays available everywhere else on the row.
          <td className="block sm:table-cell col-span-3 pb-2 sm:py-1.5 pr-0 sm:pr-3" onClick={(e) => e.stopPropagation()}>
            <span className="flex items-center gap-1.5">
              <CategorySelector
                selectedCategory={pendingChoices[t.id] ?? ''}
                onCategoryChange={(categoryId) => setPendingChoices(prev => ({ ...prev, [t.id]: categoryId }))}
                transactionType={t.amount < 0 ? 'expense' : 'income'}
                includeAllTypes
                showHelperText={false}
                usePortal
                placeholder="Choose a category…"
                // One fixed width for every row from sm up — a fluid picker
                // sized itself to each row's leftover space and the column
                // read ragged. Phones get the full row width instead.
                className="w-full sm:w-96 lg:w-[30rem]"
              />
              {/* Same pattern as Categorise by payee: an accidental pick must
                  be reversible, and the slot is RESERVED so every picker in
                  the column stays one width. */}
              <span className="w-8 shrink-0 flex justify-center">
                {(pendingChoices[t.id] ?? '') !== '' && (
                  <button
                    type="button"
                    onClick={() => setPendingChoices(prev => ({ ...prev, [t.id]: '' }))}
                    disabled={saving}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                    title="Clear — back to Choose a category"
                    aria-label="Clear chosen category"
                  >
                    <XIcon size={14} />
                  </button>
                )}
              </span>
            </span>
          </td>
        ) : (
          <td className="block sm:table-cell col-span-3 sm:col-auto py-0 sm:py-2 pr-0 sm:pr-3 text-sm text-gray-500 dark:text-gray-400">
            {categoryName(t.category)}
          </td>
        )}
        <td className={`block sm:table-cell py-2 text-sm font-medium text-right whitespace-nowrap tabular-nums ${rowColour}`}>
          {value < 0 ? `-${formatCurrency(Math.abs(value))}` : formatCurrency(value)}
        </td>
      </tr>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      // 2xl when filing inline: the picker is the working column, and at xl
      // it was the squeezed one.
      size={inlineFiling ? '2xl' : 'lg'}
      headerActions={
        inlineFiling && pendingIds.length > 0 ? (
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="px-4 py-1.5 text-sm font-medium rounded-lg bg-[#1a2332] dark:bg-blue-600 text-white hover:bg-[#2d3a4d] dark:hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-wait"
          >
            {saving ? 'Saving…' : `Save ${pendingIds.length}`}
          </button>
        ) : undefined
      }
    >
      <ModalBody>
        {/* Below sm the table reflows: each row is a small grid — date,
            description and amount on one line, the category (or its picker)
            full-width beneath — because four fixed columns cannot share a
            phone. From sm up, the table is a table. */}
        {visibleRows.length === 0 ? (
          <p className="text-center py-8 text-gray-400">No transactions</p>
        ) : (
          <table className="block sm:table w-full">
            <thead className="hidden sm:table-header-group">
              <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                {headerButton('date', 'Date')}
                {headerButton('description', 'Description')}
                {headerButton('category', 'Category')}
                {headerButton('amount', 'Amount', 'right')}
              </tr>
            </thead>
            <tbody className="block sm:table-row-group">
              {view.sections.map((section, i) => (
                <React.Fragment key={section.name ?? `flat-${i}`}>
                  {section.name !== null && (
                    <tr className="flex items-center justify-between sm:table-row bg-gray-100 dark:bg-gray-700/70 border-y border-gray-300 dark:border-gray-500">
                      <td colSpan={3} className="block sm:table-cell py-2 pr-3 text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-200">
                        {section.name}
                        <span className="ml-2 font-normal normal-case text-gray-400 dark:text-gray-500">
                          ({section.rows.length})
                        </span>
                      </td>
                      <td className={`block sm:table-cell py-1.5 text-xs font-semibold text-right tabular-nums ${colourClass || signedColour(section.subtotal)}`}>
                        {section.subtotal < 0
                          ? `-${formatCurrency(Math.abs(section.subtotal))}`
                          : formatCurrency(section.subtotal)}
                      </td>
                    </tr>
                  )}
                  {section.rows.map(renderRow)}
                </React.Fragment>
              ))}
              {view.truncated > 0 && (
                <tr className="block sm:table-row">
                  <td colSpan={4} className="block sm:table-cell py-3 text-center text-xs text-gray-400 dark:text-gray-500">
                    Showing {CAP.toLocaleString()} of {visibleRows.length.toLocaleString()} rows — the total below covers them all.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="block sm:table-footer-group">
              {bucket === 'uncategorized' ? (
                <tr className="block sm:table-row border-t-2 border-gray-200 dark:border-gray-600">
                  <td colSpan={4} className="block sm:table-cell pt-3 text-xs text-gray-500 dark:text-gray-400">
                    These transactions count toward NO total until they are given a category.
                    Set up a category like &ldquo;Income : Miscellaneous&rdquo; if you need a catch-all.
                  </td>
                </tr>
              ) : (
                <tr className="flex items-center justify-between sm:table-row border-t-2 border-gray-200 dark:border-gray-600">
                  <td colSpan={3} className="block sm:table-cell pt-3 text-sm font-semibold text-gray-900 dark:text-white">Total</td>
                  <td className={`block sm:table-cell pt-3 text-sm font-bold text-right tabular-nums ${colourClass || (total !== null ? signedColour(total) : '')}`}>
                    {total !== null ? formatCurrency(total) : ''}
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        )}
      </ModalBody>
    </Modal>
  );
}
