import React, { useMemo, useState } from 'react';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import { useApp } from '../contexts/AppContextSupabase';
import { useToast } from '../contexts/ToastContext';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import {
  groupSubtotals,
  summariseCategorySpend,
  twinOf,
  type SpendWindowKind,
} from '../utils/categorySpendSummary';
import { toDecimal } from '../utils/decimal';
import type { Category } from '../types';

/**
 * SET BUDGETS AGAINST WHAT YOU ACTUALLY SPENT.
 *
 * The owner's spec (29 Aug 2026): pull the last twelve months per category,
 * annual and monthly side by side, ask which rhythm he wants to budget in,
 * and compute the other figure from whichever he types.
 *
 * ── THE FOUR RULINGS THIS IMPLEMENTS ───────────────────────────────────────
 *  1. ONE RHYTHM for the whole screen, not one per row. A page mixing
 *     £500-a-month with £6,000-a-year cannot be totalled or compared, which
 *     is most of what a budget page is for. The toggle chooses what you TYPE;
 *     both figures are always shown.
 *  2. BUDGETS AT THE LEAF, group subtotals for context — transactions file at
 *     the leaf, so only a leaf budget can be measured without ambiguity.
 *  3. THE WINDOW IS THE USER'S CHOICE, defaulting to whole months: a budget
 *     set against a part-finished month is set against a month that has not
 *     happened (utils/categorySpendSummary carries the argument).
 *  4. A BUDGET IS A PROPERTY OF ITS CATEGORY — one row per category, keyed by
 *     category id, so this screen and the category list are two doors into
 *     one room rather than two features that must be kept in step.
 *
 * ── WHAT IT REFUSES TO DO ──────────────────────────────────────────────────
 * It never writes a figure the user did not type. "Use my actual" fills the
 * box — visibly, editably — rather than saving behind them, because a budget
 * nobody chose is a target nobody owns. Rows left empty are left alone: an
 * empty box means "no budget", not "budget of zero", and a category that
 * already has a budget shows it as the starting value.
 */

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/** A leaf and everything the screen needs to say about it. */
interface Row {
  category: Category;
  groupName: string;
  annual: number;
  monthly: number;
  rows: number;
  existing?: { id: string; monthly: number };
}

export default function BudgetSetupModal({ isOpen, onClose }: Props): React.JSX.Element {
  const { transactions, transactionSplits, categories, budgets, addBudget, updateBudget } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const { showSuccess, showError } = useToast();

  const [windowKind, setWindowKind] = useState<SpendWindowKind>('full-months');
  const [rhythm, setRhythm] = useState<'monthly' | 'yearly'>('monthly');
  /** What the user has typed, by category id, in the CURRENT rhythm. */
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showUnspent, setShowUnspent] = useState(false);
  /**
   * WHAT ORDER THE ROWS COME IN (owner, 29 Aug, of both this list and the
   * budget grid: "sortable by category list, or the option by value high/low
   * or reverse"). Biggest spend first is the default because it is the order
   * the decisions matter in — the categories worth budgeting are the ones
   * with money in them — but a list nobody can rearrange is a list you have
   * to read all of to find one row.
   */
  const [order, setOrder] = useState<'highest' | 'lowest' | 'group' | 'az'>('highest');

  const summary = useMemo(
    () => summariseCategorySpend(transactions, transactionSplits, categories, { kind: windowKind }),
    [transactions, transactionSplits, categories, windowKind]
  );
  const groups = useMemo(() => groupSubtotals(summary, categories), [summary, categories]);

  const { spent, unspent } = useMemo(() => {
    const nameOf = new Map(categories.map(c => [c.id, c.name]));
    const leaves = categories.filter(c => c.level === 'detail' && c.type === 'expense');
    const build = (c: Category): Row => {
      const s = summary.byCategory.get(c.id);
      const existing = budgets.find(b => b.categoryId === c.id && b.isActive !== false);
      return {
        category: c,
        groupName: nameOf.get(c.parentId ?? '') ?? '',
        annual: s ? s.annual.toNumber() : 0,
        monthly: s ? s.monthly.toNumber() : 0,
        rows: s?.rows ?? 0,
        existing: existing
          ? {
              id: existing.id,
              monthly: existing.period === 'yearly'
                ? toDecimal(existing.amount).dividedBy(12).toNumber()
                : existing.amount,
            }
          : undefined,
      };
    };
    const all = leaves.map(build);
    const byName = (a: Row, b: Row): number =>
      a.category.name.localeCompare(b.category.name, undefined, { sensitivity: 'base' });
    const sortRows = (rows: Row[]): Row[] => {
      switch (order) {
        case 'lowest': return rows.sort((a, b) => a.annual - b.annual || byName(a, b));
        case 'az': return rows.sort(byName);
        case 'group':
          // Group A–Z then leaf A–Z, the same arrangement the budget grid
          // and the category tree use; a leaf with no group sorts last.
          return rows.sort((a, b) =>
            (a.groupName || '\uffff').localeCompare(b.groupName || '\uffff',
              undefined, { sensitivity: 'base' }) || byName(a, b));
        default: return rows.sort((a, b) => b.annual - a.annual || byName(a, b));
      }
    };
    return {
      spent: sortRows(all.filter(r => r.annual > 0 || r.existing)),
      unspent: sortRows(all.filter(r => r.annual === 0 && !r.existing)),
    };
  }, [categories, summary, budgets, order]);

  /** The figure in the box for a row, as a string in the current rhythm. */
  const valueFor = (row: Row): string => {
    const t = typed[row.category.id];
    if (t !== undefined) return t;
    if (!row.existing) return '';
    const monthly = row.existing.monthly;
    return String(Math.round((rhythm === 'monthly' ? monthly : monthly * 12) * 100) / 100);
  };

  const setValue = (id: string, value: string): void =>
    setTyped(prev => ({ ...prev, [id]: value }));

  const fillFromActual = (row: Row): void =>
    setValue(row.category.id, String(Math.round(rhythm === 'monthly' ? row.monthly : row.annual)));

  const fillAll = (): void => {
    const next: Record<string, string> = {};
    for (const row of spent) {
      if (row.annual <= 0) continue;
      next[row.category.id] = String(Math.round(rhythm === 'monthly' ? row.monthly : row.annual));
    }
    setTyped(prev => ({ ...next, ...prev }));
  };

  /** Every row with a usable figure, as the monthly/yearly pair to store. */
  const pending = useMemo(() => {
    const out: Array<{ row: Row; amount: number }> = [];
    for (const row of spent) {
      const raw = typed[row.category.id];
      if (raw === undefined || raw.trim() === '') continue;
      const amount = Number(raw);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      // Unchanged from what is already stored is not a write.
      if (row.existing) {
        const currentInRhythm = rhythm === 'monthly'
          ? row.existing.monthly
          : row.existing.monthly * 12;
        if (Math.abs(currentInRhythm - amount) < 0.005) continue;
      }
      out.push({ row, amount });
    }
    return out;
  }, [spent, typed, rhythm]);

  const save = async (): Promise<void> => {
    if (pending.length === 0) return;
    setSaving(true);
    try {
      for (const { row, amount } of pending) {
        if (row.existing) {
          await updateBudget(row.existing.id, { amount, period: rhythm });
        } else {
          await addBudget({
            categoryId: row.category.id,
            name: row.category.name,
            amount,
            period: rhythm,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }
      showSuccess(
        `${pending.length} budget${pending.length === 1 ? '' : 's'} set from your own spending.`,
        'Budgets saved'
      );
      setTyped({});
      onClose();
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const windowLabel = summary.window.kind === 'full-months'
    ? 'the last 12 full months'
    : 'the 12 months to yesterday';

  const renderRow = (row: Row): React.JSX.Element => {
    const value = valueFor(row);
    const amount = Number(value);
    const twin = value.trim() !== '' && Number.isFinite(amount) && amount > 0
      ? twinOf(amount, rhythm).toNumber()
      : null;
    return (
      <tr key={row.category.id} className="border-t border-line dark:border-gray-700">
        <td className="py-2 pr-3">
          <span className="text-sm text-gray-900 dark:text-white">{row.category.name}</span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">{row.groupName}</span>
        </td>
        <td className="py-2 px-2 text-right tabular-nums text-sm text-gray-700 dark:text-gray-300">
          {row.annual > 0 ? formatCurrency(row.annual) : '—'}
        </td>
        <td className="py-2 px-2 text-right tabular-nums text-sm text-gray-700 dark:text-gray-300">
          {row.annual > 0 ? formatCurrency(row.monthly) : '—'}
        </td>
        <td className="py-2 pl-2">
          <div className="flex items-center justify-end gap-2">
            {row.annual > 0 && (
              <button
                type="button"
                onClick={() => fillFromActual(row)}
                className="text-xs text-gray-500 dark:text-gray-400 hover:underline rounded whitespace-nowrap"
              >
                use my actual
              </button>
            )}
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              aria-label={`${rhythm === 'monthly' ? 'Monthly' : 'Yearly'} budget for ${row.category.name}`}
              value={value}
              onChange={e => setValue(row.category.id, e.target.value)}
              className="w-28 px-2 py-1 text-sm text-right rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="text-right text-xs text-gray-400 dark:text-gray-500 mt-0.5 tabular-nums">
            {twin === null
              ? ' '
              : rhythm === 'monthly'
                ? `${formatCurrency(twin)} a year`
                : `${formatCurrency(twin)} a month`}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Set budgets from your spending" size="2xl">
      <ModalBody>
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div>
            <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">I budget</span>
            <div className="inline-flex rounded-lg border border-line dark:border-gray-600 overflow-hidden">
              {(['monthly', 'yearly'] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRhythm(r)}
                  aria-pressed={rhythm === r}
                  className={`px-3 py-1.5 text-sm ${
                    rhythm === r
                      ? 'bg-primary-action text-on-primary-action'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {r === 'monthly' ? 'Monthly' : 'Annually'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Measured over</span>
            <select
              value={windowKind}
              onChange={e => setWindowKind(e.target.value as SpendWindowKind)}
              aria-label="Which twelve months to measure"
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="full-months">The last 12 full months</option>
              <option value="to-yesterday">The 12 months to yesterday</option>
            </select>
          </div>
          <div>
            <label htmlFor="budget-setup-order" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Order
            </label>
            <select
              id="budget-setup-order"
              value={order}
              onChange={e => setOrder(e.target.value as typeof order)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="highest">Most spent first</option>
              <option value="lowest">Least spent first</option>
              <option value="group">By category group</option>
              <option value="az">A–Z</option>
            </select>
          </div>
          <button
            type="button"
            onClick={fillAll}
            className="self-end px-3 py-1.5 text-sm font-medium border border-line dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Fill every box from my spending
          </button>
        </div>

        {/* The consequence, named: unfiled money makes every figure below
            short, and the reader can only judge these numbers knowing it. */}
        {summary.unfiledRows > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {formatCurrency(summary.unfiled.toNumber())} of spending over{' '}
            {summary.unfiledRows} row{summary.unfiledRows === 1 ? '' : 's'} has no category, so it
            is in none of the figures below — categorise those and these totals will rise.
          </p>
        )}

        <div className="max-h-[52vh] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-white dark:bg-gray-800">
              <tr className="text-xs text-gray-500 dark:text-gray-400">
                <th className="text-left font-medium py-2 pr-3">Category</th>
                <th className="text-right font-medium py-2 px-2">A year<span className="block font-normal">{windowLabel}</span></th>
                <th className="text-right font-medium py-2 px-2">A month<span className="block font-normal">on average</span></th>
                <th className="text-right font-medium py-2 pl-2">
                  Your budget<span className="block font-normal">{rhythm === 'monthly' ? 'per month' : 'per year'}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {spent.map(renderRow)}
            </tbody>
          </table>

          {unspent.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowUnspent(v => !v)}
                className="text-sm text-gray-600 dark:text-gray-300 hover:underline rounded"
              >
                {showUnspent ? 'Hide' : 'Show'} {unspent.length} categor
                {unspent.length === 1 ? 'y' : 'ies'} you have not spent in
              </button>
              {showUnspent && (
                <table className="w-full mt-2">
                  <tbody>{unspent.map(renderRow)}</tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* Group subtotals, for context only — a leaf figure means more read
            against the group it belongs to (ruling 2). */}
        {groups.size > 0 && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Group totals over {windowLabel}:{' '}
            {categories
              .filter(c => c.level === 'sub' && groups.has(c.id))
              .sort((a, b) => (groups.get(b.id)?.toNumber() ?? 0) - (groups.get(a.id)?.toNumber() ?? 0))
              .slice(0, 6)
              .map(c => `${c.name} ${formatCurrency(groups.get(c.id)?.toNumber() ?? 0)}`)
              .join(' · ')}
          </p>
        )}
      </ModalBody>
      <ModalFooter>
        <div className="flex items-center gap-3 ml-auto">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium border border-line dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || pending.length === 0}
            className="px-4 py-2 text-sm font-medium bg-primary-action text-on-primary-action rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving
              ? 'Saving…'
              : pending.length === 0
                ? 'Nothing to save yet'
                : `Set ${pending.length} budget${pending.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </ModalFooter>
    </Modal>
  );
}
