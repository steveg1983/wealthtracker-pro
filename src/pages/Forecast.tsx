import React, { useEffect, useMemo, useState } from 'react';
import PageWrapper from '../components/PageWrapper';
import { useApp } from '../contexts/AppContextSupabase';
import { useToast } from '../contexts/ToastContext';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal } from '../utils/decimal';
import { getDateLocale } from '../utils/dateFormatter';
import { buildCategoryKindLookup, classifyFlow } from '../utils/incomeExpense';
import { createCategoryLabeller } from '../utils/categoryLabel';
import { dismissedKeys } from '../utils/suggestionDismissals';
import { dataPort } from '@data';
import MoneyInput from '../components/common/MoneyInput';
import { parseMoneyInput } from '../utils/decimal';
import type { ForecastAdjustment, Transaction } from '../types';

/**
 * THE FORECAST'S BASE — the last twelve months, category by category.
 *
 * Build order step 4 of docs/forecast-direction.md, shipped BEFORE any
 * projection exists because the ruling demands an inspectable foundation:
 * the forecast is a SCENARIO TOOL (owner, 17 Aug), it never writes to
 * Budget on its own, and a scenario that stands on unreviewed actuals
 * cannot be interrogated. This page is that review — useful alone as a
 * twelve-month category P&L.
 *
 * ── THE BASE IS HONEST OR IT IS NOTHING ────────────────────────────────────
 *
 * - TWELVE COMPLETE MONTHS, stated on screen. The current month is not in
 *   the base: a half-month would understate every category it touches.
 * - ONE-OFFS ARE EXCLUDABLE, AND THE EXCLUSIONS ARE STATED (§7.1: "with
 *   the exclusions stated"). The roof, the payout, the car — excluding
 *   them is what makes the monthly average a typical month; hiding that
 *   they were excluded would make the average a fiction. The excluded rows
 *   sit in their own restorable band, counted in the headline.
 * - An exclusion is a VERDICT, stored beside the app's other suggestion
 *   answers ('forecast-excluded', migration 20260819130000), keyed by the
 *   row's own id: it survives reloads and restores, and dies with its row.
 *   The register is untouched — only this base stops counting the row.
 * - WHOLE TRANSACTIONS, deliberately. The figures here are grouped from
 *   the same real rows the expansion lists, so a category's total is
 *   exactly the sum of the rows shown under it — never a quietly different
 *   number computed some other way. Transfers and revaluations are not
 *   income or spending and are left out BY NAME, with their counts.
 * - The unfiled remainder is a NAMED line per side, excludable like any
 *   category's rows — a one-off that was never categorised is still a
 *   one-off.
 *
 * ── THE SCENARIO IS STATED ADJUSTMENTS OVER THE VISIBLE BASE ───────────────
 *
 * Design's interrogability rule, and the owner's ruling, made literal: each
 * category row shows its base average AND its scenario figure side by side.
 * A category follows the base until the user states otherwise; a stated
 * figure shows its deviation against the base it deviates from, and one
 * click returns it. The adjustments persist through the seam
 * ('forecast_adjustments', both engines — a signed-out browser refuses the
 * write out loud rather than keeping it somewhere no backup carries). An
 * adjustment whose category has no recent activity is still SHOWN, in its
 * own band: a stored deviation that influenced no visible row would be a
 * scenario nobody can interrogate.
 */

const UNFILED_LABEL = 'Uncategorised — not yet filed';

/** Which side of the P&L a category's flow kind lands on. */
const categoryKindOfSide = (kind: string | null): 'in' | 'out' | null =>
  kind === 'income' ? 'in' : kind === 'expense' ? 'out' : null;

interface BaseGroup {
  /** null for the unfiled remainder — the one line with nothing to adjust. */
  categoryId: string | null;
  label: string;
  total: number;
  rows: Transaction[];
}

export default function Forecast(): React.JSX.Element {
  const {
    accounts, categories, transactions,
    suggestionDismissals, suggestionDismissalsStatus, refreshSuggestionDismissals,
    dismissSuggestion, restoreSuggestion,
  } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const { showError } = useToast();

  // The verdicts are lazy-loaded; a reader must ask (the #353 lesson — a
  // surface that gates on 'ready' without requesting the load is invisible).
  useEffect(() => {
    if (suggestionDismissalsStatus === 'idle') void refreshSuggestionDismissals();
  }, [suggestionDismissalsStatus, refreshSuggestionDismissals]);

  const answersReady = suggestionDismissalsStatus === 'ready';

  const excludedIds = useMemo(
    () => dismissedKeys(suggestionDismissals, 'forecast-excluded'),
    [suggestionDismissals]
  );

  /** Twelve COMPLETE months: first of (this month − 12) … last day of last month. */
  const window = useMemo(() => {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth() - 12, 1),
      to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
    };
  }, []);

  const labeller = useMemo(() => createCategoryLabeller(categories, accounts), [categories, accounts]);
  const categoryKinds = useMemo(() => buildCategoryKindLookup(categories), [categories]);

  const base = useMemo(() => {
    const income = new Map<string, BaseGroup>();
    const expense = new Map<string, BaseGroup>();
    let transfers = 0;
    let revaluations = 0;
    const excluded: Transaction[] = [];

    // Keyed by CATEGORY ID, not label — the scenario attaches to the id, and
    // two categories that happened to share a wording must not share a figure.
    const add = (
      side: Map<string, BaseGroup>,
      categoryId: string | null,
      label: string,
      row: Transaction
    ): void => {
      const key = categoryId ?? UNFILED_LABEL;
      const group = side.get(key) ?? { categoryId, label, total: 0, rows: [] };
      group.total = toDecimal(group.total).plus(toDecimal(row.amount).abs()).toNumber();
      group.rows.push(row);
      side.set(key, group);
    };

    for (const row of transactions) {
      const time = new Date(row.date).getTime();
      if (time < window.from.getTime() || time > window.to.getTime()) continue;
      if (excludedIds.has(row.id)) { excluded.push(row); continue; }
      const kind = classifyFlow(row, categoryKinds);
      if (kind === 'transfer') { transfers++; continue; }
      if (kind === 'revaluation') { revaluations++; continue; }
      if (kind === 'uncategorized') {
        add(row.amount >= 0 ? income : expense, null, UNFILED_LABEL, row);
        continue;
      }
      add(kind === 'income' ? income : expense, row.category, labeller(row) || UNFILED_LABEL, row);
    }

    const finish = (side: Map<string, BaseGroup>): BaseGroup[] =>
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

    const sum = (groups: BaseGroup[]): number =>
      groups.reduce((total, group) => toDecimal(total).plus(toDecimal(group.total)).toNumber(), 0);

    const incomeGroups = finish(income);
    const expenseGroups = finish(expense);
    return {
      income: incomeGroups,
      expense: expenseGroups,
      incomeTotal: sum(incomeGroups),
      expenseTotal: sum(expenseGroups),
      transfers,
      revaluations,
      excluded: excluded.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)),
    };
  }, [transactions, window, excludedIds, categoryKinds, labeller]);

  /** Which category's rows are open, as `${side}:${label}`. */
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  /**
   * THE SCENARIO's stored deviations, keyed by category. Loaded through the
   * seam rather than the app context: the context does not carry them, and
   * the one page that reads them is this one — the asymmetry the port's own
   * docs argue against putting them in the boot.
   */
  const [adjustments, setAdjustments] = useState<Map<string, ForecastAdjustment>>(new Map());
  const [adjustmentsStatus, setAdjustmentsStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const rows = await dataPort.listForecastAdjustments();
        if (!live) return;
        setAdjustments(new Map(rows.map(row => [row.categoryId, row])));
        setAdjustmentsStatus('ready');
      } catch {
        if (!live) return;
        // A failed read is a scenario that FOLLOWS THE BASE, said on screen —
        // never invented deviations from another store.
        setAdjustmentsStatus('error');
      }
    })();
    return () => { live = false; };
  }, []);

  /** The category currently being adjusted, and the draft in its box. */
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [draftMonthly, setDraftMonthly] = useState('');
  const [savingAdjustment, setSavingAdjustment] = useState(false);

  const stateAdjustment = async (categoryId: string): Promise<void> => {
    const pounds = parseMoneyInput(draftMonthly);
    if (pounds === null || pounds < 0) {
      showError(new Error('Enter the monthly figure for the scenario — zero or more'));
      return;
    }
    setSavingAdjustment(true);
    try {
      const stated = await dataPort.setForecastAdjustment(
        categoryId,
        toDecimal(pounds).times(100).toNumber()
      );
      setAdjustments(previous => new Map(previous).set(categoryId, stated));
      setEditingCategory(null);
      setDraftMonthly('');
    } catch (error) {
      showError(error);
    } finally {
      setSavingAdjustment(false);
    }
  };

  const followBase = async (categoryId: string): Promise<void> => {
    setSavingAdjustment(true);
    try {
      await dataPort.clearForecastAdjustment(categoryId);
      setAdjustments(previous => {
        const next = new Map(previous);
        next.delete(categoryId);
        return next;
      });
      setEditingCategory(null);
    } catch (error) {
      showError(error);
    } finally {
      setSavingAdjustment(false);
    }
  };

  const exclude = async (row: Transaction): Promise<void> => {
    setSavingId(row.id);
    try {
      await dismissSuggestion('forecast-excluded', row.id, [row.id]);
    } catch (error) {
      showError(error);
    } finally {
      setSavingId(null);
    }
  };

  const restore = async (id: string): Promise<void> => {
    setSavingId(id);
    try {
      await restoreSuggestion('forecast-excluded', id);
    } catch (error) {
      showError(error);
    } finally {
      setSavingId(null);
    }
  };

  /** A group's SCENARIO monthly figure, in pounds: stated, or the base's. */
  const scenarioMonthly = (group: BaseGroup): number => {
    if (group.categoryId !== null) {
      const stated = adjustments.get(group.categoryId);
      if (stated) return toDecimal(stated.monthlyMinor).dividedBy(100).toNumber();
    }
    return average(group.total);
  };

  /**
   * Adjustments on categories the base does not show — no activity in the
   * window, or category gone from the ledger's list. STILL SHOWN, in their
   * own band, and still counted in the scenario's totals: a stored deviation
   * that influenced no visible figure would be a scenario nobody can
   * interrogate.
   */
  const orphanAdjustments = useMemo(() => {
    const inBase = new Set(
      [...base.income, ...base.expense]
        .map(group => group.categoryId)
        .filter((id): id is string => id !== null)
    );
    const named = new Map(categories.map(category => [category.id, category]));
    return [...adjustments.values()]
      .filter(adjustment => !inBase.has(adjustment.categoryId))
      .map(adjustment => {
        const category = named.get(adjustment.categoryId);
        return {
          adjustment,
          label: category
            ? (labeller({ category: adjustment.categoryId }) || category.name)
            : 'A category no longer in your list',
          side: (category && categoryKindOfSide(categoryKinds.get(adjustment.categoryId) ?? null)) ?? 'out',
        };
      });
  }, [adjustments, base.income, base.expense, categories, labeller, categoryKinds]);

  /** One side's scenario monthly total: its groups' effective figures plus its orphans. */
  const scenarioSideTotal = (groups: BaseGroup[], side: 'in' | 'out'): number => {
    const fromGroups = groups.reduce(
      (total, group) => toDecimal(total).plus(toDecimal(scenarioMonthly(group))).toNumber(),
      0
    );
    return orphanAdjustments
      .filter(orphan => orphan.side === side)
      .reduce(
        (total, orphan) =>
          toDecimal(total).plus(toDecimal(orphan.adjustment.monthlyMinor).dividedBy(100)).toNumber(),
        fromGroups
      );
  };

  const monthRange = `${window.from.toLocaleDateString(getDateLocale(), { month: 'long', year: 'numeric' })} to ${window.to.toLocaleDateString(getDateLocale(), { month: 'long', year: 'numeric' })}`;

  const average = (total: number): number => toDecimal(total).dividedBy(12).toNumber();

  const accountNameById = useMemo(
    () => new Map(accounts.map(a => [a.id, a.name])),
    [accounts]
  );

  /** One side of the P&L — Income or Expenditure — as a card of groups. */
  const SideCard = ({ side, title, groups, total }: {
    side: 'in' | 'out'; title: string; groups: BaseGroup[]; total: number;
  }): React.JSX.Element => (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <h2 className="text-card font-semibold text-theme-heading dark:text-white">{title}</h2>
        <span className="text-right">
          <span className={`block text-body font-semibold tabular-nums ${
            side === 'in' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {side === 'in' ? `+${formatCurrency(total)}` : formatCurrency(-total)}
          </span>
          <span className="block text-dense tabular-nums text-gray-500 dark:text-gray-400">
            {formatCurrency(average(total))} a month
          </span>
          {/* The side's SCENARIO month, only when it differs — a scenario
              that follows the base has nothing to announce. */}
          {adjustmentsStatus === 'ready' &&
            toDecimal(scenarioSideTotal(groups, side)).minus(toDecimal(average(total))).abs().greaterThan(0.004) && (
            <span className="block text-dense tabular-nums text-gray-700 dark:text-gray-300">
              scenario: {formatCurrency(scenarioSideTotal(groups, side))} a month
            </span>
          )}
        </span>
      </div>
      {groups.length === 0 ? (
        <p className="text-body text-gray-500 dark:text-gray-400">
          Nothing on this side of the ledger in these twelve months.
        </p>
      ) : (
        <ul>
          {groups.map(group => {
            const key = `${side}:${group.label}`;
            const open = openGroup === key;
            return (
              <li key={group.label} className="border-t border-gray-50 dark:border-gray-700/50 first:border-0">
                <button
                  type="button"
                  onClick={() => setOpenGroup(open ? null : key)}
                  aria-expanded={open}
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
                      {side === 'in' ? `+${formatCurrency(group.total)}` : formatCurrency(-group.total)}
                    </span>
                    <span className="block text-xs tabular-nums text-gray-500 dark:text-gray-400">
                      {formatCurrency(average(group.total))} a month
                    </span>
                  </span>
                </button>
                {/* THE SCENARIO'S FIGURE for this category — stated, or the
                    base's. Outside the expansion button: adjusting is not
                    the same act as inspecting the rows. The unfiled line has
                    nothing to attach an adjustment to; the honest advice is
                    to FILE the rows, and the base note already carries it. */}
                {group.categoryId !== null && adjustmentsStatus === 'ready' && (
                  <div className="pb-2 pl-2 flex flex-wrap items-baseline justify-end gap-x-3 gap-y-1">
                    {editingCategory === group.categoryId ? (
                      <>
                        <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          Scenario, a month
                          <MoneyInput
                            value={draftMonthly}
                            onChange={setDraftMonthly}
                            className="w-28 px-2 py-1 text-sm text-right tabular-nums border border-line dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            aria-label={`Scenario monthly figure for ${group.label}`}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => void stateAdjustment(group.categoryId as string)}
                          disabled={savingAdjustment}
                          className="text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:underline disabled:opacity-50"
                        >
                          State it
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditingCategory(null); setDraftMonthly(''); }}
                          className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                        >
                          Cancel
                        </button>
                      </>
                    ) : adjustments.has(group.categoryId) ? (
                      <>
                        {/* A DEVIATION, stated against the base it deviates
                            from — the whole of the interrogability rule. */}
                        <span className="text-xs tabular-nums text-gray-700 dark:text-gray-300">
                          scenario {formatCurrency(scenarioMonthly(group))} a month
                          <span className="text-gray-400 dark:text-gray-500"> · base {formatCurrency(average(group.total))}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategory(group.categoryId);
                            setDraftMonthly(toDecimal(scenarioMonthly(group)).toFixed(2));
                          }}
                          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:underline"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={() => void followBase(group.categoryId as string)}
                          disabled={savingAdjustment}
                          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:underline disabled:opacity-50"
                        >
                          Back to base
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategory(group.categoryId);
                          setDraftMonthly(toDecimal(average(group.total)).toFixed(2));
                        }}
                        className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:underline"
                        title="State a different monthly figure for the scenario — the base stays exactly as it is"
                        aria-label={`Adjust ${group.label} for the scenario`}
                      >
                        Adjust for the scenario
                      </button>
                    )}
                  </div>
                )}
                {open && (
                  <ul className="pb-2 pl-2">
                    {group.rows.map(row => (
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
                        <span className="flex items-baseline gap-3 shrink-0">
                          <span className={`text-sm tabular-nums ${
                            row.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                          }`}>
                            {row.amount >= 0 ? `+${formatCurrency(row.amount)}` : formatCurrency(row.amount)}
                          </span>
                          {/* The one-off strike. Quiet: there are hundreds of
                              rows on this page and amber's monopoly holds. */}
                          {answersReady && (
                            <button
                              type="button"
                              onClick={() => void exclude(row)}
                              disabled={savingId === row.id}
                              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:underline disabled:opacity-50"
                              title="A one-off, not part of a typical month — the base stops counting it; the register is untouched, and it is listed below where it can be restored"
                            >
                              Exclude
                            </button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  return (
    <PageWrapper title="Forecast">
      <div className="max-w-[1400px] mx-auto space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-line dark:border-gray-700">
          <h2 className="text-label uppercase tracking-wider font-medium text-gray-500 dark:text-gray-400">
            The base — your last twelve months
          </h2>
          <p className="text-dense text-gray-500 dark:text-gray-400 mt-1">
            {monthRange}, complete months only — category by category, exactly
            as the register holds them. This is the ground a scenario stands
            on: review it, strike out the one-offs that are not part of a
            typical month, and the averages become honest.{' '}
            <span className="text-gray-700 dark:text-gray-300">
              Nothing here writes to your Budget
            </span>
            {' '}— a scenario only ever becomes budgets by your explicit,
            per-category say-so, in a later step.
          </p>
          <p className="text-dense text-gray-500 dark:text-gray-400 mt-2">
            Transfers between your accounts are not income or spending and are
            left out{base.transfers > 0 && <> ({base.transfers} in this stretch)</>}
            {base.revaluations > 0 && <>; {base.revaluations} revaluations — ledger arithmetic — likewise</>}.
            {base.excluded.length > 0 && (
              <> {base.excluded.length === 1 ? '1 one-off is' : `${base.excluded.length} one-offs are`} excluded
              from the base — listed at the foot of the page, restorable any time.</>
            )}
          </p>
          {adjustmentsStatus === 'ready' && adjustments.size > 0 && (
            <p className="text-dense text-gray-700 dark:text-gray-300 mt-2">
              The scenario adjusts {adjustments.size === 1 ? '1 category' : `${adjustments.size} categories`} —
              every deviation is shown on its row, against the base it deviates
              from, and one click returns it. Scenario month:{' '}
              <span className="tabular-nums">+{formatCurrency(scenarioSideTotal(base.income, 'in'))}</span> in,{' '}
              <span className="tabular-nums">{formatCurrency(-scenarioSideTotal(base.expense, 'out'))}</span> out.
            </p>
          )}
          {adjustmentsStatus === 'error' && (
            /* A failed read is a scenario that FOLLOWS THE BASE — said, not
               guessed at. Deviations invented from a stale copy would be the
               one dishonesty this page exists to prevent. */
            <p className="text-dense text-gray-500 dark:text-gray-400 mt-2">
              Your scenario adjustments could not be loaded just now, so the
              figures below show the base alone. Reload to try again.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SideCard side="in" title="Income" groups={base.income} total={base.incomeTotal} />
          <SideCard side="out" title="Expenditure" groups={base.expense} total={base.expenseTotal} />
        </div>

        {orphanAdjustments.length > 0 && (
          /* Stored deviations whose categories show no recent activity — still
             visible, still counted in the scenario totals, still returnable:
             a deviation influencing figures from off-screen would make the
             scenario uninterrogatable. */
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-4 sm:p-6">
            <h2 className="text-card font-semibold text-theme-heading dark:text-white mb-1">
              Adjustments on quiet categories
              <span className="ml-2 text-dense font-normal text-gray-400 dark:text-gray-500">
                {orphanAdjustments.length}
              </span>
            </h2>
            <p className="text-dense text-gray-500 dark:text-gray-400 mb-2">
              Stated for categories with nothing in these twelve months — still
              counted in the scenario's totals above.
            </p>
            <ul>
              {orphanAdjustments.map(({ adjustment, label }) => (
                <li key={adjustment.categoryId} className="py-1.5 flex items-baseline justify-between gap-4 border-t border-gray-50 dark:border-gray-700/50 first:border-0">
                  <span className="text-sm text-gray-900 dark:text-white truncate">{label}</span>
                  <span className="flex items-baseline gap-3 shrink-0">
                    <span className="text-sm tabular-nums text-gray-700 dark:text-gray-300">
                      {formatCurrency(toDecimal(adjustment.monthlyMinor).dividedBy(100).toNumber())} a month
                    </span>
                    <button
                      type="button"
                      onClick={() => void followBase(adjustment.categoryId)}
                      disabled={savingAdjustment}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:underline disabled:opacity-50"
                    >
                      Back to base
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {base.excluded.length > 0 && (
          /* STATED, never silent (§7.1) — and restorable, because a judgment
             the user cannot revisit is a deletion wearing a nicer name. */
          <details className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700">
            <summary className="cursor-pointer select-none p-6 text-card font-semibold text-theme-heading dark:text-white">
              Excluded from the base
              <span className="ml-2 text-dense font-normal text-gray-400 dark:text-gray-500">
                {base.excluded.length}
              </span>
              <span className="ml-3 text-dense font-normal text-gray-500 dark:text-gray-400">
                One-offs you said are not part of a typical month
              </span>
            </summary>
            <ul className="px-6 pb-6">
              {base.excluded.map(row => (
                <li key={row.id} className="py-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-t border-gray-50 dark:border-gray-700/50 first:border-0">
                  <span className="min-w-0 flex items-baseline gap-2">
                    <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400 w-16 shrink-0">
                      {new Date(row.date).toLocaleDateString(getDateLocale(), { day: 'numeric', month: 'short', year: '2-digit' })}
                    </span>
                    <span className="text-sm text-gray-900 dark:text-white truncate">{row.description}</span>
                  </span>
                  <span className="flex items-baseline gap-3 shrink-0">
                    <span className={`text-sm tabular-nums ${
                      row.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {row.amount >= 0 ? `+${formatCurrency(row.amount)}` : formatCurrency(row.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void restore(row.id)}
                      disabled={savingId === row.id}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:underline disabled:opacity-50"
                    >
                      Restore
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </PageWrapper>
  );
}
