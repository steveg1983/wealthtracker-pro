import React, { useMemo, useState } from 'react';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import { useApp } from '../contexts/AppContextSupabase';
import { useToast } from '../contexts/ToastContext';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { ChevronDownIcon, ChevronRightIcon } from './icons';
import {
  amountInMode,
  budgetHistoryWindow,
  buildWizardRows,
  groupWizardRows,
  planBudgetWrites,
  summariseForWizard,
  twinFigure,
  type BudgetMode,
  type WizardGroup,
  type WizardRow,
  type WizardWindowKind,
} from '../utils/budgetWizardPlan';
import { parseMoneyInput, toDecimal, type DecimalInstance } from '../utils/decimal';

/**
 * THE BUDGET WIZARD — three questions, one apply.
 *
 * The owner's ruling (31 Aug 2026): a budget is a PROPERTY of a category, not
 * a separate object that shares its name. There is one object and two lenses
 * onto it — Manage → Categories says WHAT IS SET, the Budget page says HOW IT
 * IS GOING — and this is the door that writes them in bulk.
 *
 * Storage is unchanged: the `budgets` table, keyed by category_id, the same
 * rows the Budget page has always read. The unification is in the UI, which is
 * why there is no migration attached to any of this.
 *
 * ── WHY THREE STEPS AND NOT ONE SCREEN ─────────────────────────────────────
 * This replaces a single-screen version of the same job. The steps exist
 * because the three questions are of genuinely different kinds and mixing them
 * is what made the one screen hard to finish:
 *
 *   1. HOW DO YOU THINK? Months or years. Asked once, for the whole screen,
 *      because a page mixing £500-a-month rows with £6,000-a-year rows cannot
 *      be totalled or compared — and totalling is most of what step 3 is for.
 *      It chooses only which column takes TYPING; both figures are always
 *      shown on every row.
 *   2. THE GRID. Evidence beside every box: what that category really cost
 *      over twelve complete months, as a year and as a month.
 *   3. WHAT WILL HAPPEN. The totals, the shortfall or headroom in words, and
 *      every removal named — before a single row is written.
 *
 * ── EMPTY IS NOT ZERO, AND THAT SURVIVES TO THE WRITE ──────────────────────
 * Boxes start EMPTY with the historical figure greyed beside them. An empty
 * box means UNBUDGETED; a typed 0 means "I intend to spend nothing here",
 * which is a real budget somebody can be over. Clearing a box that arrived
 * pre-filled REMOVES that budget, and step 3 says which ones by name — the
 * arithmetic for all of it is in `utils/budgetWizardPlan`, tested away from
 * any screen, because a rule this load-bearing should not live in a component
 * that also has to lay out a grid.
 *
 * ── WHAT IT WILL NOT DO ────────────────────────────────────────────────────
 * It never saves a figure nobody typed: "use last 12 months" fills the box,
 * visibly and editably, rather than writing behind you. It never invents a
 * budget on a parent group (that would double-count against its children), it
 * never re-expresses a weekly or quarterly budget as a monthly one (that
 * conversion is a guess), and it never touches alert thresholds — new budgets
 * take the app-wide default, edited ones keep whatever they had, because this
 * screen does not ask about them and must not answer for you.
 */

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'rhythm' | 'grid' | 'confirm';

/** A figure for a box: two places, plain, no symbol — it is going into an input. */
const boxValue = (amount: DecimalInstance): string => amount.toDecimalPlaces(2).toString();

export default function BudgetWizard({ isOpen, onClose }: Props): React.JSX.Element {
  const {
    transactions, transactionSplits, categories, budgets,
    addBudget, updateBudget, deleteBudget,
  } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const { showSuccess, showError, showWarning } = useToast();

  const [step, setStep] = useState<Step>('rhythm');
  const [mode, setMode] = useState<BudgetMode>('monthly');
  /**
   * What is in each box, by category id. ABSENT means untouched — which is a
   * different instruction from '' (emptied), and the difference is the whole
   * empty-versus-zero ruling. See utils/budgetWizardPlan.
   */
  const [entries, setEntries] = useState<Record<string, string | undefined>>({});
  const [showQuiet, setShowQuiet] = useState(false);
  const [applying, setApplying] = useState(false);

  // One evaluation instant for the whole wizard: the window named in the
  // header and the figures under it describe the same "now".
  const now = useMemo(() => new Date(), []);
  /**
   * Which twelve months the evidence covers (owner, 1 Sep 2026: "Some people
   * may want to work on calendar years"). Changing it changes the EVIDENCE —
   * the history columns, the references, the copy-in buttons — and touches
   * nothing anybody has typed: a figure in a box is the user's intent, not a
   * measurement, and it survives a change of measuring stick.
   */
  const [windowKind, setWindowKind] = useState<WizardWindowKind>('full-months');
  const historyWindow = useMemo(() => budgetHistoryWindow(now, windowKind), [now, windowKind]);

  const summary = useMemo(
    () => summariseForWizard(transactions, transactionSplits, categories, now, windowKind),
    [transactions, transactionSplits, categories, now, windowKind]
  );
  const rows = useMemo(
    () => buildWizardRows(summary, categories, budgets),
    [summary, categories, budgets]
  );

  /**
   * Rows with nothing in the window and no budget on them fold away — but the
   * count is always named (house rule: never hide without saying how much).
   * A category that already carries a budget is never folded: it is part of
   * the world being edited, and a removal you cannot see is not an offer.
   */
  const { active, quiet } = useMemo(() => {
    const isQuiet = (row: WizardRow): boolean => row.annual.isZero() && row.existing === null;
    return {
      active: rows.filter(row => !isQuiet(row)),
      quiet: rows.filter(isQuiet),
    };
  }, [rows]);

  const groups = useMemo(() => groupWizardRows(active), [active]);
  const plan = useMemo(() => planBudgetWrites(rows, entries, mode), [rows, entries, mode]);

  /** The string a box shows: what was typed, else what is stored, else empty. */
  const valueFor = (row: WizardRow): string => {
    const typed = entries[row.category.id];
    if (typed !== undefined) return typed;
    if (row.existing === null || row.existing.period === null) return '';
    return boxValue(amountInMode(row.existing.amount, row.existing.period, mode));
  };

  const setValue = (categoryId: string, value: string): void =>
    setEntries(previous => ({ ...previous, [categoryId]: value }));

  /**
   * THE RUNNING SCOREBOARD — total spent and total budgeted so far, alive as
   * the boxes fill (owner, 1 Sep 2026: "I want to be able to see the totals
   * as I go along", not only on the review page). Locked rows (a stored
   * period the wizard cannot express) are left out of the budgeted side for
   * the same reason their boxes are read-only: a week does not divide into a
   * month without a guess. Sums are annual and quantised to monthly through
   * `twinFigure`, the same arithmetic as every row — so the strip always
   * agrees with the review step.
   */
  const totals = useMemo(() => {
    const spent = rows.reduce((sum, row) => sum.plus(row.annual), toDecimal(0));
    let budgeted = toDecimal(0);
    let boxes = 0;
    for (const row of rows) {
      if (row.existing !== null && row.existing.period === null) continue;
      const typed = entries[row.category.id];
      const value =
        typed !== undefined
          ? typed
          : row.existing === null
            ? ''
            : boxValue(amountInMode(row.existing.amount, row.existing.period ?? 'monthly', mode));
      if (value.trim() === '') continue;
      const parsed = parseMoneyInput(value);
      if (parsed === null || parsed < 0) continue;
      budgeted = budgeted.plus(mode === 'monthly' ? toDecimal(parsed).times(12) : toDecimal(parsed));
      boxes += 1;
    }
    return { spent, budgeted, boxes };
  }, [rows, entries, mode]);

  /** The historical figure for this row in the mode being typed. */
  const historyIn = (row: WizardRow): DecimalInstance => (mode === 'monthly' ? row.monthly : row.annual);

  const fillFromHistory = (row: WizardRow): void => setValue(row.category.id, boxValue(historyIn(row)));

  /** Fill every box that has evidence behind it. A row with no spending is left alone. */
  const startFromHistory = (): void =>
    setEntries(previous => {
      const next = { ...previous };
      for (const row of rows) {
        if (row.annual.isZero()) continue;
        if (row.existing !== null && row.existing.period === null) continue;
        next[row.category.id] = boxValue(historyIn(row));
      }
      return next;
    });

  /**
   * Back to as-they-were — NOT every box emptied.
   *
   * Emptying is how a budget is REMOVED, so a "clear" that emptied every box
   * would queue the deletion of every budget the user already has behind one
   * tap. This undoes the typing; a budget is still taken off one box at a time.
   */
  const clearAll = (): void => setEntries({});

  const close = (): void => {
    setStep('rhythm');
    setEntries({});
    setShowQuiet(false);
    onClose();
  };

  const chooseMode = (chosen: BudgetMode): void => {
    setMode(chosen);
    setStep('grid');
  };

  /**
   * ONE APPLY PASS, and every write is caught on its own.
   *
   * A batch that stops at its first failure strands the user in a half-written
   * state they cannot see; one that swallows failures reports a success that
   * did not happen. So each row is attempted, the failures are collected BY
   * NAME, and the toast says exactly how many landed and which did not.
   */
  const apply = async (): Promise<void> => {
    setApplying(true);
    const failed: string[] = [];
    let written = 0;

    for (const upsert of plan.upserts) {
      try {
        if (upsert.budgetId !== undefined) {
          await updateBudget(upsert.budgetId, {
            amount: upsert.amount.toNumber(),
            period: upsert.period,
          });
        } else {
          await addBudget({
            categoryId: upsert.categoryId,
            name: upsert.categoryName,
            amount: upsert.amount.toNumber(),
            period: upsert.period,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
        written += 1;
      } catch {
        failed.push(upsert.categoryName);
      }
    }

    for (const removal of plan.removals) {
      try {
        await deleteBudget(removal.budgetId);
        written += 1;
      } catch {
        failed.push(removal.categoryName);
      }
    }

    setApplying(false);

    if (failed.length > 0) {
      showError(
        `${written} of ${written + failed.length} saved. These were not: ${failed.join(', ')}. Your other budgets are unchanged — try again.`
      );
      return;
    }
    showSuccess(
      `${written} budget${written === 1 ? '' : 's'} saved.`,
      'Budgets updated'
    );
    close();
  };

  const confirm = (): void => {
    if (plan.rejections.length > 0) {
      showWarning(
        `${plan.rejections.length} figure${plan.rejections.length === 1 ? '' : 's'} could not be read as an amount and will be left as ${plan.rejections.length === 1 ? 'it is' : 'they are'}: ${plan.rejections.map(r => r.categoryName).join(', ')}.`
      );
    }
    setStep('confirm');
  };

  const modeNoun = mode === 'monthly' ? 'a month' : 'a year';
  const columnHeading = mode === 'monthly' ? 'Your budget, per month' : 'Your budget, per year';

  // ── Step 2, one row ───────────────────────────────────────────────────────
  const renderRow = (row: WizardRow): React.JSX.Element => {
    const value = valueFor(row);
    const locked = row.existing !== null && row.existing.period === null;
    // Decimal all the way down: the twin is money, so the typed string is read
    // by the app's money parser and never by parseFloat.
    const twin = (() => {
      if (locked || value.trim() === '') return null;
      const parsed = parseMoneyInput(value);
      if (parsed === null || parsed < 0) return null;
      return twinFigure(parsed, mode);
    })();

    return (
      // Four columns on a desktop; below `sm` the same four cells reflow into
      // a two-by-two card — name beside its history, then the box beside the
      // figure it implies. The house responsive-table idiom (see
      // BulkCategorizeModal), so a phone never scrolls sideways to reach the
      // field it is meant to be filling in.
      <tr
        key={row.category.id}
        className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 py-2 sm:py-0 sm:table-row border-t border-line dark:border-gray-700"
      >
        <td className="block sm:table-cell min-w-0 py-1 sm:py-2 sm:pr-3 sm:align-top">
          <span className="text-sm text-gray-900 dark:text-white">{row.category.name}</span>
          {row.rows > 0 && (
            <span className="block text-xs text-gray-400 dark:text-gray-500">
              {row.rows} row{row.rows === 1 ? '' : 's'}
            </span>
          )}
        </td>
        {/* THE EVIDENCE — both figures, on every row, whichever one is being
            typed. Greyed and beside the box, never inside it: it is what the
            category cost, not a value anybody has agreed to. */}
        <td className="block sm:table-cell py-1 sm:py-2 sm:px-2 text-right sm:align-top tabular-nums">
          {row.annual.isZero() ? (
            <span className="text-xs text-gray-400 dark:text-gray-500">Nothing in this window</span>
          ) : (
            <>
              <span className="block text-sm text-gray-700 dark:text-gray-300">
                {formatCurrency(row.annual)} a year
              </span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">
                {formatCurrency(row.monthly)} a month
              </span>
            </>
          )}
        </td>
        <td className="block sm:table-cell py-1 sm:py-2 sm:px-2 sm:align-top">
          {locked ? (
            <span className="block text-xs text-gray-500 dark:text-gray-400 text-right max-w-[14rem]">
              {formatCurrency(row.existing?.amount ?? 0)} {row.existing?.storedPeriod} — left as it is.
              Change it on the Budget page.
            </span>
          ) : (
            <div className="flex items-center justify-end gap-2">
              {!row.annual.isZero() && (
                <button
                  type="button"
                  onClick={() => fillFromHistory(row)}
                  aria-label={`Use what ${row.category.name} actually cost`}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:underline rounded whitespace-nowrap min-h-[44px] sm:min-h-0 px-1"
                >
                  use my actual
                </button>
              )}
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                aria-label={`${mode === 'monthly' ? 'Monthly' : 'Yearly'} budget for ${row.category.name}`}
                value={value}
                onChange={event => setValue(row.category.id, event.target.value)}
                placeholder="—"
                className="w-28 px-2 py-2 text-sm text-right tabular-nums rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          )}
        </td>
        {/* The twin, live: type the month and the year answers, and back. */}
        <td className="block sm:table-cell py-1 sm:py-2 sm:pl-2 text-right sm:align-top tabular-nums">
          <span className="block text-xs text-gray-400 dark:text-gray-500 min-h-[1rem]">
            {twin !== null &&
              (mode === 'monthly'
                ? `${formatCurrency(twin)} a year`
                : `${formatCurrency(twin)} a month`)}
          </span>
        </td>
      </tr>
    );
  };

  /**
   * A group heading row: the parent, and its children's roll-up.
   *
   * DISPLAY ONLY, and structurally so — there is no input in it. A budget on a
   * group AND on its children would double-count, and which of the two the
   * Budget page should measure would be a question with two answers.
   */
  const renderGroupHeading = (group: WizardGroup): React.JSX.Element => (
    <tr className="block sm:table-row">
      <th scope="colgroup" colSpan={4} className="block sm:table-cell text-left pt-4 pb-1">
        {/* SHADED, so the eye can find the seams in a long list (owner,
            1 Sep 2026: "category group headings … shaded a different colour
            to show sections"). The shade sits on an inner div rather than
            the cell so the breathing room above each section stays the
            modal's own ground in both the table and the stacked-card
            layouts, and the group's roll-up lives IN its bar — the group
            totals have no other home, and a footer sentence of them is
            what this replaced. */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-lg bg-gray-200/80 dark:bg-gray-700/60 px-3 py-2">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {group.name || 'Ungrouped'}
          </span>
          <span className="text-sm font-normal text-gray-600 dark:text-gray-300 tabular-nums">
            {formatCurrency(group.annual)} a year · {formatCurrency(group.monthly)} a month
          </span>
        </div>
      </th>
    </tr>
  );

  // ── Step 1 ────────────────────────────────────────────────────────────────
  const renderRhythm = (): React.JSX.Element => (
    <div>
      <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">
        Do you think in months or years?
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">
        This only chooses which figure you type. Both are shown on every row, and you can change
        your mind on the next screen.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {([
          ['monthly', 'Budget monthly', 'Type what you plan to spend each month.'],
          ['yearly', 'Budget annually', 'Type the year, and see what it is a month.'],
        ] as const).map(([value, title, blurb]) => (
          <button
            key={value}
            type="button"
            onClick={() => chooseMode(value)}
            /* `flex flex-col items-start` is load-bearing, not decoration:
               the stylesheet gives every button `display: inline-flex`, so
               these two block children would lay out SIDE BY SIDE without it
               (src/test/a11y/buttonsStackTheirOwnRows.test.ts guards it). */
            className="flex flex-col items-start text-left p-4 min-h-[44px] rounded-lg border border-line dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <span className="block text-sm font-medium text-gray-900 dark:text-white">{title}</span>
            <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">{blurb}</span>
          </button>
        ))}
      </div>
    </div>
  );

  // ── Step 2 ────────────────────────────────────────────────────────────────
  const windowExplainer =
    windowKind === 'full-months'
      ? 'Twelve complete months — this month is still running, so it is not counted.'
      : windowKind === 'calendar-year'
        ? 'The last complete calendar year.'
        : 'The last complete tax year — 6 April to 5 April.';

  const renderGrid = (): React.JSX.Element => (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-sm text-gray-700 dark:text-gray-200">
            What you spent, {historyWindow.label}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {windowExplainer} An empty box means no budget; a nought means a budget of nothing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* The measuring stick is a choice (owner, 1 Sep 2026): a
              calendar-year budgeter sets this year's numbers against
              Jan–Dec of last year, part-way through and unbothered. */}
          <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            Measured over
            <select
              value={windowKind}
              onChange={event => {
                const chosen = event.target.value;
                if (chosen === 'full-months' || chosen === 'calendar-year' || chosen === 'tax-year') {
                  setWindowKind(chosen);
                }
              }}
              className="px-2 py-2 min-h-[44px] text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="full-months">The last 12 full months</option>
              <option value="calendar-year">Last calendar year</option>
              <option value="tax-year">Last tax year</option>
            </select>
          </label>
          <button
            type="button"
            onClick={startFromHistory}
            className="px-3 py-2 min-h-[44px] text-sm font-medium border border-line dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Start from history
          </button>
          <button
            type="button"
            onClick={clearAll}
            title="Puts every box back to what is stored"
            className="px-3 py-2 min-h-[44px] text-sm font-medium border border-line dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Clear all
          </button>
        </div>
      </div>

      {/* THE RUNNING SCOREBOARD, pinned above the scroller so it holds still
          while the list moves (owner, 1 Sep 2026: "I want to be able to see
          the totals as I go along"). The chosen rhythm's figure leads; its
          twin follows, exactly as on every row. */}
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded-lg border border-line dark:border-gray-700 px-3 py-2 mb-3 text-sm tabular-nums">
        <span className="text-gray-600 dark:text-gray-300">
          Spent{' '}
          <span className="font-medium text-gray-900 dark:text-white">
            {formatCurrency(mode === 'monthly' ? twinFigure(totals.spent, 'yearly') : totals.spent)}
          </span>{' '}
          {modeNoun}
          <span className="text-gray-500 dark:text-gray-400">
            {' '}· {formatCurrency(mode === 'monthly' ? totals.spent : twinFigure(totals.spent, 'yearly'))}{' '}
            {mode === 'monthly' ? 'a year' : 'a month'}
          </span>
        </span>
        <span className="text-gray-600 dark:text-gray-300">
          Budgeted so far{' '}
          <span className="font-medium text-gray-900 dark:text-white">
            {formatCurrency(mode === 'monthly' ? twinFigure(totals.budgeted, 'yearly') : totals.budgeted)}
          </span>{' '}
          {modeNoun}
          <span className="text-gray-500 dark:text-gray-400">
            {' '}· {formatCurrency(mode === 'monthly' ? totals.budgeted : twinFigure(totals.budgeted, 'yearly'))}{' '}
            {mode === 'monthly' ? 'a year' : 'a month'} · {totals.boxes} of {rows.length} boxes filled
          </span>
        </span>
      </div>

      {/* The consequence of unfiled money, named: it is in none of the figures
          below, so every one of them is that much short. */}
      {summary.unfiledRows > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          {formatCurrency(summary.unfiled)} of spending over {summary.unfiledRows} row
          {summary.unfiledRows === 1 ? '' : 's'} has no category, so it is in none of the figures
          below — categorise those and these totals will rise.
        </p>
      )}

      <div className="max-h-[50vh] overflow-y-auto">
        <table className="block sm:table w-full">
          {/* Sticky on the CELLS, not the row — WebKit ignores position:sticky
              on table rows. The ground is restated so list rows slide under,
              not through. */}
          <thead className="hidden sm:table-header-group">
            <tr className="text-xs text-gray-500 dark:text-gray-400">
              <th className="sticky top-0 z-10 bg-white dark:bg-gray-900 text-left font-medium py-2 pr-3">
                Category
              </th>
              <th className="sticky top-0 z-10 bg-white dark:bg-gray-900 text-right font-medium py-2 px-2">
                What it cost<span className="block font-normal">{historyWindow.label}</span>
              </th>
              <th className="sticky top-0 z-10 bg-white dark:bg-gray-900 text-right font-medium py-2 px-2">
                {columnHeading}
              </th>
              <th className="sticky top-0 z-10 bg-white dark:bg-gray-900 text-right font-medium py-2 pl-2">
                Which is<span className="block font-normal">{mode === 'monthly' ? 'a year' : 'a month'}</span>
              </th>
            </tr>
          </thead>
          {groups.map(group => (
            <tbody key={group.id || 'ungrouped'} className="block sm:table-row-group">
              {renderGroupHeading(group)}
              {group.rows.map(renderRow)}
            </tbody>
          ))}

          {/* THE FOLD. Categories with nothing in the window are collapsed —
              but the COUNT is always on screen, because hiding rows without
              saying how many is how a screen quietly stops being the whole
              list (house data-health rule: name what is hidden). */}
          {quiet.length > 0 && (
            <tbody className="block sm:table-row-group">
              <tr className="block sm:table-row">
                <td colSpan={4} className="block sm:table-cell pt-4">
                  <button
                    type="button"
                    onClick={() => setShowQuiet(open => !open)}
                    aria-expanded={showQuiet}
                    className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 hover:underline rounded min-h-[44px]"
                  >
                    {showQuiet ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
                    {quiet.length} categor{quiet.length === 1 ? 'y' : 'ies'} with nothing in this
                    window
                  </button>
                </td>
              </tr>
              {showQuiet && quiet.map(renderRow)}
            </tbody>
          )}
        </table>
      </div>
    </div>
  );

  // ── Step 3 ────────────────────────────────────────────────────────────────
  const renderConfirm = (): React.JSX.Element => {
    const short = plan.difference.isNegative();
    const level = plan.difference.isZero()
      ? 'text-gray-700 dark:text-gray-200'
      : short
        ? 'text-red-600 dark:text-red-400'
        : 'text-green-600 dark:text-green-400';

    return (
      <div>
        <h3 className="text-base font-medium text-gray-900 dark:text-white mb-2">
          {plan.budgetedCount === 0
            ? 'No categories will be budgeted'
            : `You're budgeting ${plan.budgetedCount} categor${plan.budgetedCount === 1 ? 'y' : 'ies'}`}
        </h3>
        <p className="text-sm text-gray-700 dark:text-gray-200 tabular-nums">
          {formatCurrency(plan.monthlyTotal)} a month ({formatCurrency(plan.annualTotal)} a year),
          against {formatCurrency(plan.spentTotal)} actually spent in those categories over{' '}
          {historyWindow.label}.
        </p>
        {plan.budgetedCount > 0 && (
          <p className={`mt-2 text-sm font-medium tabular-nums ${level}`}>
            {plan.difference.isZero()
              ? 'That is exactly what those categories cost.'
              : short
                ? `That is ${formatCurrency(plan.difference.abs())} a year LESS than they really cost — you would have to spend less than last year to stay inside it.`
                : `That is ${formatCurrency(plan.difference)} a year MORE than they really cost, so there is room in it.`}
          </p>
        )}

        <dl className="mt-4 grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-gray-600 dark:text-gray-300">Budgets to set or change</dt>
            <dd className="text-gray-900 dark:text-white tabular-nums">{plan.upserts.length}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-600 dark:text-gray-300">Budgets to remove</dt>
            <dd className="text-gray-900 dark:text-white tabular-nums">{plan.removals.length}</dd>
          </div>
        </dl>

        {/* Removals are named, never counted only: taking a budget off is the
            one thing here nobody can undo by retyping a number. */}
        {plan.removals.length > 0 && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            {plan.removals.length} budget{plan.removals.length === 1 ? '' : 's'} will be removed:{' '}
            {plan.removals.map(removal => removal.categoryName).join(', ')}.
          </p>
        )}

        {plan.rejections.length > 0 && (
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
            {plan.rejections.length} figure{plan.rejections.length === 1 ? '' : 's'} could not be
            read as an amount and will be left as {plan.rejections.length === 1 ? 'it is' : 'they are'}:{' '}
            {plan.rejections.map(rejection => rejection.categoryName).join(', ')}.
          </p>
        )}

        {plan.upserts.length === 0 && plan.removals.length === 0 && (
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
            Nothing has changed, so there is nothing to save.
          </p>
        )}
      </div>
    );
  };

  const title =
    step === 'rhythm' ? 'Set up budgets' : step === 'grid' ? `Set up budgets — ${modeNoun}` : 'Before you save';

  return (
    <Modal isOpen={isOpen} onClose={close} title={title} size="2xl">
      <ModalBody>
        {step === 'rhythm' && renderRhythm()}
        {step === 'grid' && renderGrid()}
        {step === 'confirm' && renderConfirm()}
      </ModalBody>
      <ModalFooter>
        <div className="flex items-center gap-3 ml-auto">
          {step !== 'rhythm' && (
            <button
              type="button"
              onClick={() => setStep(step === 'confirm' ? 'grid' : 'rhythm')}
              disabled={applying}
              className="px-4 py-2 min-h-[44px] text-sm font-medium border border-line dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={close}
            disabled={applying}
            className="px-4 py-2 min-h-[44px] text-sm font-medium border border-line dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          {step === 'grid' && (
            <button
              type="button"
              onClick={confirm}
              className="px-4 py-2 min-h-[44px] text-sm font-medium bg-primary-action text-on-primary-action rounded-lg transition-colors"
            >
              Review
            </button>
          )}
          {step === 'confirm' && (
            <button
              type="button"
              onClick={() => void apply()}
              disabled={applying || (plan.upserts.length === 0 && plan.removals.length === 0)}
              className="px-4 py-2 min-h-[44px] text-sm font-medium bg-primary-action text-on-primary-action rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {applying ? 'Saving…' : 'Save budgets'}
            </button>
          )}
        </div>
      </ModalFooter>
    </Modal>
  );
}
