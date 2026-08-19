import React, { useEffect, useMemo, useState } from 'react';
import PageWrapper from '../components/PageWrapper';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal } from '../utils/decimal';
import { getDateLocale } from '../utils/dateFormatter';
import { buildCategoryKindLookup, classifyFlow } from '../utils/incomeExpense';
import { createCategoryLabeller } from '../utils/categoryLabel';
import { dismissedKeys } from '../utils/suggestionDismissals';
import { buildPlWindow, bucketIndexOf, dayOf } from '../utils/plWindow';
import type { PlWindowKind } from '../utils/plWindow';
import { ChevronDownIcon, ChevronRightIcon } from '../components/icons';
import { dataPort } from '@data';
import type { ForecastAdjustment, Transaction } from '../types';

/**
 * CURRENT AND FORECAST — a P&L of what happened, and the room the scenario
 * tool will move into.
 *
 * Reshaped to the owner's 19 Aug direction, replacing the side-by-side
 * base cards: "more like a 'P&L', with income above, and expenses below
 * and then a 'net income' or a 'net expenditure' figure at the bottom" —
 * with collapsible sections, a months toggle ("the twelve months going
 * across to the right just like looking at a full 12 month P&L", hidden
 * by default), and a choice of windows. "Lets get the basic look of the
 * current 'P&L' right first… Forecast can be blank for the minute until
 * I decide how I would like it built."
 *
 * ── THE CURRENT TAB IS ACTUALS, WHOLE ──────────────────────────────────────
 *
 * - Every figure is grouped from the same real rows a category expands to,
 *   so a total is exactly the sum of the rows shown under it. Transfers
 *   and revaluations are not income or spending and are left out BY NAME,
 *   with their counts. The unfiled remainder is a NAMED line per side.
 * - Every window holds only COMPLETE periods — the current part month
 *   would understate every category it touches. The windows themselves
 *   (last twelve months, calendar year, tax year in 6th-to-5th tax months,
 *   custom) live in utils/plWindow, where their boundaries are pinned.
 * - Forecast-exclusion verdicts do NOT thin this tab: a P&L of what
 *   happened shows what happened. The verdicts are kept — they belong to
 *   the forecast's base, and resurface with the redesigned Forecast tab.
 *
 * ── THE FORECAST TAB IS DELIBERATELY EMPTY ─────────────────────────────────
 *
 * The scenario tool (stated deviations over a reviewed base — see
 * docs/forecast-direction.md and the 'forecast_adjustments' seam, which
 * both engines still keep) is being redesigned to the owner's brief. The
 * tab says so, and names what is already stored for it rather than
 * letting stated judgments look lost. Nothing here writes to Budget —
 * that ruling is unchanged.
 */

const UNFILED_LABEL = 'Uncategorised — not yet filed';

interface StatementGroup {
  categoryId: string | null;
  label: string;
  total: number;
  perBucket: number[];
  rows: Transaction[];
}

export default function Forecast(): React.JSX.Element {
  const {
    accounts, categories, transactions,
    suggestionDismissals, suggestionDismissalsStatus, refreshSuggestionDismissals,
  } = useApp();
  const { formatCurrency } = useCurrencyDecimal();

  const [tab, setTab] = useState<'current' | 'forecast'>('current');

  /** Which "twelve months" the P&L reads over. */
  const [windowKind, setWindowKind] = useState<PlWindowKind>('last-12');
  const defaultCustom = useMemo(() => {
    const lastTwelve = buildPlWindow('last-12', new Date());
    return {
      from: lastTwelve.buckets[0].key,
      to: lastTwelve.buckets[lastTwelve.buckets.length - 1].key,
    };
  }, []);
  const [customFrom, setCustomFrom] = useState(defaultCustom.from);
  const [customTo, setCustomTo] = useState(defaultCustom.to);

  const plWindow = useMemo(
    () => buildPlWindow(windowKind, new Date(), { fromMonth: customFrom, toMonth: customTo }),
    [windowKind, customFrom, customTo]
  );

  const [sectionOpen, setSectionOpen] = useState<{ in: boolean; out: boolean }>({ in: true, out: true });
  const [showMonths, setShowMonths] = useState(false);
  /** Which category's rows are open, as `${side}:${label}`. */
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  // The exclusion verdicts are lazy-loaded and this page ASKS (the #353
  // lesson) — the Forecast tab names how many are kept for the redesign.
  useEffect(() => {
    if (suggestionDismissalsStatus === 'idle') void refreshSuggestionDismissals();
  }, [suggestionDismissalsStatus, refreshSuggestionDismissals]);

  const excludedCount = useMemo(
    () => dismissedKeys(suggestionDismissals, 'forecast-excluded').size,
    [suggestionDismissals]
  );

  /**
   * The scenario's stored deviations — read only to COUNT them on the
   * Forecast tab while the tool is being redesigned. A failed read is said,
   * never guessed at.
   */
  const [adjustments, setAdjustments] = useState<ForecastAdjustment[]>([]);
  const [adjustmentsStatus, setAdjustmentsStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const rows = await dataPort.listForecastAdjustments();
        if (!live) return;
        setAdjustments(rows);
        setAdjustmentsStatus('ready');
      } catch {
        if (!live) return;
        setAdjustmentsStatus('error');
      }
    })();
    return () => { live = false; };
  }, []);

  const labeller = useMemo(() => createCategoryLabeller(categories, accounts), [categories, accounts]);
  const categoryKinds = useMemo(() => buildCategoryKindLookup(categories), [categories]);

  const statement = useMemo(() => {
    const bucketCount = plWindow.buckets.length;
    const income = new Map<string, StatementGroup>();
    const expense = new Map<string, StatementGroup>();
    let transfers = 0;
    let revaluations = 0;

    // Keyed by CATEGORY ID, not label — two categories that happened to
    // share a wording must not share a figure.
    const add = (
      side: Map<string, StatementGroup>,
      categoryId: string | null,
      label: string,
      row: Transaction,
      bucket: number
    ): void => {
      const key = categoryId ?? UNFILED_LABEL;
      const group = side.get(key)
        ?? { categoryId, label, total: 0, perBucket: Array.from({ length: bucketCount }, () => 0), rows: [] };
      const magnitude = toDecimal(row.amount).abs();
      group.total = toDecimal(group.total).plus(magnitude).toNumber();
      group.perBucket[bucket] = toDecimal(group.perBucket[bucket]).plus(magnitude).toNumber();
      group.rows.push(row);
      side.set(key, group);
    };

    for (const row of transactions) {
      const bucket = bucketIndexOf(dayOf(row.date), plWindow.buckets);
      if (bucket === -1) continue;
      const kind = classifyFlow(row, categoryKinds);
      if (kind === 'transfer') { transfers++; continue; }
      if (kind === 'revaluation') { revaluations++; continue; }
      if (kind === 'uncategorized') {
        add(row.amount >= 0 ? income : expense, null, UNFILED_LABEL, row, bucket);
        continue;
      }
      add(kind === 'income' ? income : expense, row.category, labeller(row) || UNFILED_LABEL, row, bucket);
    }

    const finish = (side: Map<string, StatementGroup>): StatementGroup[] =>
      [...side.values()]
        .map(group => ({
          ...group,
          rows: [...group.rows].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)),
        }))
        .sort((a, b) => {
          // The unfiled line last, whatever its size — it is a remainder,
          // not a category.
          if (a.label === UNFILED_LABEL) return 1;
          if (b.label === UNFILED_LABEL) return -1;
          return b.total - a.total;
        });

    const sumBuckets = (groups: StatementGroup[]): number[] =>
      Array.from({ length: bucketCount }, (_, i) =>
        groups.reduce((total, group) => toDecimal(total).plus(toDecimal(group.perBucket[i])).toNumber(), 0)
      );

    const incomeGroups = finish(income);
    const expenseGroups = finish(expense);
    const incomePerBucket = sumBuckets(incomeGroups);
    const expensePerBucket = sumBuckets(expenseGroups);
    const incomeTotal = incomePerBucket.reduce((a, b) => toDecimal(a).plus(toDecimal(b)).toNumber(), 0);
    const expenseTotal = expensePerBucket.reduce((a, b) => toDecimal(a).plus(toDecimal(b)).toNumber(), 0);

    return {
      income: incomeGroups,
      expense: expenseGroups,
      incomeTotal,
      expenseTotal,
      incomePerBucket,
      expensePerBucket,
      net: toDecimal(incomeTotal).minus(toDecimal(expenseTotal)).toNumber(),
      netPerBucket: incomePerBucket.map((v, i) =>
        toDecimal(v).minus(toDecimal(expensePerBucket[i])).toNumber()
      ),
      transfers,
      revaluations,
    };
  }, [transactions, plWindow, categoryKinds, labeller]);

  const average = (total: number): number =>
    toDecimal(total).dividedBy(plWindow.buckets.length).toNumber();

  const accountNameById = useMemo(
    () => new Map(accounts.map(a => [a.id, a.name])),
    [accounts]
  );

  /** A flow figure worn the app's way: income +£X, expenditure (£X) — and a
   * zero wears neither sign nor colour, because it needs no attention. */
  const flowText = (side: 'in' | 'out', value: number): string =>
    value === 0 ? formatCurrency(0)
      : side === 'in' ? `+${formatCurrency(value)}` : formatCurrency(-value);

  const sideColour = (side: 'in' | 'out', value: number): string =>
    value === 0 ? 'text-gray-900 dark:text-white'
      : side === 'in' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

  /** A month cell — a quiet dash where nothing happened, never £0.00 noise. */
  const cellText = (side: 'in' | 'out', value: number): string =>
    value === 0 ? '—' : flowText(side, value);

  const netText = (value: number): string =>
    value === 0 ? formatCurrency(0)
      : value > 0 ? `+${formatCurrency(value)}` : formatCurrency(value);

  const netLabel = statement.net >= 0 ? 'Net income' : 'Net expenditure';
  const netColour = statement.net === 0 ? 'text-gray-900 dark:text-white'
    : statement.net > 0
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400';

  const windowSentence: Record<PlWindowKind, string> = {
    'last-12': 'the last twelve complete months — the current part month is left out, it would understate every category it touches',
    'calendar-year': 'the last full calendar year',
    'tax-year': 'the last complete tax year; months run 6th to 5th, as tax months do',
    'custom': 'whole months, chosen by you',
  };

  const toggleSection = (side: 'in' | 'out'): void =>
    setSectionOpen(previous => ({ ...previous, [side]: !previous[side] }));

  /** The rows a category's figure is the sum of — shared by both layouts. */
  const TransactionRows = ({ rows }: { rows: Transaction[] }): React.JSX.Element => (
    <ul className="pb-2 pl-2">
      {rows.map(row => (
        <li key={row.id} className="py-1.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-t border-gray-50 dark:border-gray-700/50 first:border-0">
          <span className="min-w-0 flex items-baseline gap-2">
            <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400 w-16 shrink-0">
              {new Date(row.date).toLocaleDateString(getDateLocale(), { day: 'numeric', month: 'short', year: '2-digit' })}
            </span>
            <span className="text-sm text-gray-900 dark:text-white truncate">{row.description}</span>
            {accountNameById.get(row.accountId) && (
              <span className="text-xs text-gray-400 dark:text-gray-500 truncate">
                {accountNameById.get(row.accountId)}
              </span>
            )}
          </span>
          <span className={`text-sm tabular-nums shrink-0 ${
            row.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {row.amount >= 0 ? `+${formatCurrency(row.amount)}` : formatCurrency(row.amount)}
          </span>
        </li>
      ))}
    </ul>
  );

  /** One P&L section in the list layout — heading collapsible, rows drillable. */
  const SectionList = ({ side, title, groups, total }: {
    side: 'in' | 'out'; title: string; groups: StatementGroup[]; total: number;
  }): React.JSX.Element => {
    const open = sectionOpen[side];
    return (
      <div className="border-t border-gray-100 dark:border-gray-700/60 first:border-0">
        <div className="flex items-baseline justify-between gap-4 py-2">
          <button
            type="button"
            onClick={() => toggleSection(side)}
            aria-expanded={open}
            className="flex items-center gap-1.5 text-card font-semibold text-theme-heading dark:text-white"
          >
            {open
              ? <ChevronDownIcon size={16} className="text-gray-400 shrink-0" />
              : <ChevronRightIcon size={16} className="text-gray-400 shrink-0" />}
            {title}
          </button>
          <span className="text-right shrink-0">
            <span className={`block text-body font-semibold tabular-nums ${sideColour(side, total)}`}>
              {flowText(side, total)}
            </span>
            <span className="block text-dense tabular-nums text-gray-500 dark:text-gray-400">
              {formatCurrency(average(total))} a month
            </span>
          </span>
        </div>
        {open && (
          groups.length === 0 ? (
            <p className="pb-2 pl-6 text-body text-gray-500 dark:text-gray-400">
              Nothing on this side of the ledger in this window.
            </p>
          ) : (
            <ul className="pb-1 pl-4">
              {groups.map(group => {
                const key = `${side}:${group.label}`;
                const rowsOpen = openGroup === key;
                return (
                  <li key={group.label} className="border-t border-gray-50 dark:border-gray-700/50 first:border-0">
                    <button
                      type="button"
                      onClick={() => setOpenGroup(rowsOpen ? null : key)}
                      aria-expanded={rowsOpen}
                      className="w-full py-2 flex items-baseline justify-between gap-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 rounded"
                    >
                      <span className={`text-sm truncate ${
                        group.label === UNFILED_LABEL
                          ? 'text-gray-500 dark:text-gray-400'
                          : 'text-gray-900 dark:text-white'
                      }`}>
                        {group.label}
                        <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">{group.rows.length}</span>
                      </span>
                      <span className="text-right shrink-0">
                        <span className="block text-sm tabular-nums text-gray-900 dark:text-white">
                          {flowText(side, group.total)}
                        </span>
                        <span className="block text-xs tabular-nums text-gray-500 dark:text-gray-400">
                          {formatCurrency(average(group.total))} a month
                        </span>
                      </span>
                    </button>
                    {rowsOpen && <TransactionRows rows={group.rows} />}
                  </li>
                );
              })}
            </ul>
          )
        )}
      </div>
    );
  };

  const columnCount = plWindow.buckets.length + 3;

  /** One P&L section in the months-across table layout. */
  const sectionTableRows = (
    side: 'in' | 'out',
    title: string,
    groups: StatementGroup[],
    total: number,
    perBucket: number[]
  ): React.JSX.Element => {
    const open = sectionOpen[side];
    return (
      <>
        <tr className="border-t border-gray-100 dark:border-gray-700/60">
          <td className="sticky left-0 bg-white dark:bg-gray-800 py-2 pr-4">
            <button
              type="button"
              onClick={() => toggleSection(side)}
              aria-expanded={open}
              className="flex items-center gap-1.5 text-card font-semibold text-theme-heading dark:text-white"
            >
              {open
                ? <ChevronDownIcon size={16} className="text-gray-400 shrink-0" />
                : <ChevronRightIcon size={16} className="text-gray-400 shrink-0" />}
              {title}
            </button>
          </td>
          {perBucket.map((value, i) => (
            <td key={plWindow.buckets[i].key} className="py-2 px-2 text-right text-sm tabular-nums font-medium text-gray-900 dark:text-white whitespace-nowrap">
              {cellText(side, value)}
            </td>
          ))}
          <td className={`py-2 pl-3 text-right text-sm tabular-nums font-semibold whitespace-nowrap ${sideColour(side, total)}`}>
            {flowText(side, total)}
          </td>
          <td className="py-2 pl-3 text-right text-sm tabular-nums text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {formatCurrency(average(total))}
          </td>
        </tr>
        {open && groups.map(group => {
          const key = `${side}:${group.label}`;
          const rowsOpen = openGroup === key;
          return (
            <React.Fragment key={group.label}>
              <tr className="border-t border-gray-50 dark:border-gray-700/50">
                <td className="sticky left-0 bg-white dark:bg-gray-800 py-1.5 pl-4 pr-4">
                  <button
                    type="button"
                    onClick={() => setOpenGroup(rowsOpen ? null : key)}
                    aria-expanded={rowsOpen}
                    className={`text-left text-sm truncate max-w-[16rem] ${
                      group.label === UNFILED_LABEL
                        ? 'text-gray-500 dark:text-gray-400'
                        : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {group.label}
                    <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">{group.rows.length}</span>
                  </button>
                </td>
                {group.perBucket.map((value, i) => (
                  <td key={plWindow.buckets[i].key} className="py-1.5 px-2 text-right text-sm tabular-nums text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {cellText(side, value)}
                  </td>
                ))}
                <td className="py-1.5 pl-3 text-right text-sm tabular-nums text-gray-900 dark:text-white whitespace-nowrap">
                  {flowText(side, group.total)}
                </td>
                <td className="py-1.5 pl-3 text-right text-sm tabular-nums text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {formatCurrency(average(group.total))}
                </td>
              </tr>
              {rowsOpen && (
                <tr>
                  <td colSpan={columnCount} className="pl-4">
                    <TransactionRows rows={group.rows} />
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </>
    );
  };

  /** What is already stored for the redesigned Forecast tab, in words. */
  const keptParts = [
    adjustmentsStatus === 'ready' && adjustments.length > 0
      ? (adjustments.length === 1 ? '1 adjusted category' : `${adjustments.length} adjusted categories`)
      : null,
    suggestionDismissalsStatus === 'ready' && excludedCount > 0
      ? (excludedCount === 1 ? '1 excluded one-off' : `${excludedCount} excluded one-offs`)
      : null,
  ].filter((part): part is string => part !== null);

  return (
    <PageWrapper title="Forecast">
      <div className="max-w-[1400px] mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* The tab, chosen the way the calendar chooses its view — a
              segmented control (owner, 19 Aug: "Lets have two tabs for now.
              Current and forecast"). */}
          <div className="flex items-center rounded-lg bg-gray-100 dark:bg-gray-700 p-0.5" role="group" aria-label="Forecast view">
            {(['current', 'forecast'] as const).map(option => (
              <button
                key={option}
                type="button"
                onClick={() => setTab(option)}
                aria-pressed={tab === option}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  tab === option
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                {option === 'current' ? 'Current' : 'Forecast'}
              </button>
            ))}
          </div>

          {tab === 'current' && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-lg bg-gray-100 dark:bg-gray-700 p-0.5" role="group" aria-label="Which months the figures read over">
                {([
                  ['last-12', 'Last 12 months'],
                  ['calendar-year', 'Calendar year'],
                  ['tax-year', 'Tax year'],
                  ['custom', 'Custom'],
                ] as const).map(([kind, name]) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setWindowKind(kind)}
                    aria-pressed={windowKind === kind}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                      windowKind === kind
                        ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
              {windowKind === 'custom' && (
                <span className="flex items-center gap-2 text-dense text-gray-500 dark:text-gray-400">
                  <label className="flex items-center gap-1.5">
                    From
                    <input
                      type="month"
                      value={customFrom}
                      onChange={event => setCustomFrom(event.target.value)}
                      className="px-2 py-1 text-sm border border-line dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </label>
                  <label className="flex items-center gap-1.5">
                    To
                    <input
                      type="month"
                      value={customTo}
                      onChange={event => setCustomTo(event.target.value)}
                      className="px-2 py-1 text-sm border border-line dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </label>
                </span>
              )}
            </div>
          )}
        </div>

        {tab === 'current' ? (
          <>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-line dark:border-gray-700">
              <h2 className="text-label uppercase tracking-wider font-medium text-gray-500 dark:text-gray-400">
                Your profit and loss
              </h2>
              <p className="text-dense text-gray-500 dark:text-gray-400 mt-1">
                {plWindow.label} — {windowSentence[windowKind]}. Category by
                category, exactly as the register holds them.{' '}
                <span className="text-gray-700 dark:text-gray-300">
                  Nothing here writes to your Budget
                </span>
                {' '}— a scenario only ever becomes budgets by your explicit,
                per-category say-so.
              </p>
              <p className="text-dense text-gray-500 dark:text-gray-400 mt-2">
                Transfers between your accounts are not income or spending and are
                left out{statement.transfers > 0 && <> ({statement.transfers} in this stretch)</>}
                {statement.revaluations > 0 && <>; {statement.revaluations} revaluations — ledger arithmetic — likewise</>}.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-4 sm:p-6">
              <div className="flex justify-end mb-1">
                <button
                  type="button"
                  onClick={() => setShowMonths(previous => !previous)}
                  aria-pressed={showMonths}
                  className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:underline"
                >
                  {showMonths
                    ? <ChevronDownIcon size={14} className="shrink-0" />
                    : <ChevronRightIcon size={14} className="shrink-0" />}
                  {showMonths ? 'Hide the months' : 'Show the months'}
                </button>
              </div>

              {showMonths ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-gray-500 dark:text-gray-400">
                        <th scope="col" className="sticky left-0 bg-white dark:bg-gray-800 py-1 pr-4 text-left font-normal" aria-label="Category" />
                        {plWindow.buckets.map(bucket => (
                          <th key={bucket.key} scope="col" className="py-1 px-2 text-right font-normal whitespace-nowrap">
                            {bucket.label}
                          </th>
                        ))}
                        <th scope="col" className="py-1 pl-3 text-right font-medium whitespace-nowrap">Total</th>
                        <th scope="col" className="py-1 pl-3 text-right font-normal whitespace-nowrap">A month</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectionTableRows('in', 'Income', statement.income, statement.incomeTotal, statement.incomePerBucket)}
                      {sectionTableRows('out', 'Expenditure', statement.expense, statement.expenseTotal, statement.expensePerBucket)}
                      <tr className="border-t-2 border-gray-200 dark:border-gray-600">
                        <td className="sticky left-0 bg-white dark:bg-gray-800 py-2 pr-4 text-card font-semibold text-theme-heading dark:text-white whitespace-nowrap">
                          {netLabel}
                        </td>
                        {statement.netPerBucket.map((value, i) => (
                          <td key={plWindow.buckets[i].key} className="py-2 px-2 text-right text-sm tabular-nums font-medium text-gray-900 dark:text-white whitespace-nowrap">
                            {value === 0 ? '—' : netText(value)}
                          </td>
                        ))}
                        <td className={`py-2 pl-3 text-right text-sm tabular-nums font-semibold whitespace-nowrap ${netColour}`}>
                          {netText(statement.net)}
                        </td>
                        <td className="py-2 pl-3 text-right text-sm tabular-nums text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {formatCurrency(average(statement.net))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div>
                  <SectionList side="in" title="Income" groups={statement.income} total={statement.incomeTotal} />
                  <SectionList side="out" title="Expenditure" groups={statement.expense} total={statement.expenseTotal} />
                  <div className="mt-1 pt-3 border-t-2 border-gray-200 dark:border-gray-600 flex items-baseline justify-between gap-4">
                    <span className="text-card font-semibold text-theme-heading dark:text-white">{netLabel}</span>
                    <span className="text-right shrink-0">
                      <span className={`block text-body font-semibold tabular-nums ${netColour}`}>
                        {netText(statement.net)}
                      </span>
                      <span className="block text-dense tabular-nums text-gray-500 dark:text-gray-400">
                        {formatCurrency(average(statement.net))} a month
                      </span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-6">
            <h2 className="text-card font-semibold text-theme-heading dark:text-white">The forecast</h2>
            <p className="text-body text-gray-500 dark:text-gray-400 mt-1">
              The scenario tool will live here — it is being designed.
            </p>
            {keptParts.length > 0 && (
              <p className="text-dense text-gray-700 dark:text-gray-300 mt-2">
                Kept for it: {keptParts.join(' and ')} — they will reappear when it lands.
              </p>
            )}
            {adjustmentsStatus === 'error' && (
              <p className="text-dense text-gray-500 dark:text-gray-400 mt-2">
                Your stated adjustments could not be read just now; they are kept
                in your ledger regardless.
              </p>
            )}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
