import { useCallback, useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { preserveDemoParam } from '../utils/navigation';
import { ChevronLeftIcon, ChevronRightIcon } from '../components/icons';
import PageWrapper from '../components/PageWrapper';
import PageTip from '../components/PageTip';
import { toDecimal } from '../utils/decimal';
import { getDateLocale } from '../utils/dateFormatter';
import { detectRecurring } from '../utils/recurringDetection';
import { projectRecurringSchedule } from '../utils/recurringSchedule';
import { dismissedKeys, recurringAnswerKey } from '../utils/suggestionDismissals';
import { computeIncomeExpense } from '../utils/incomeExpense';
import { createCategoryLabeller } from '../utils/categoryLabel';

interface DayData {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  income: number;
  expense: number;
  transactionCount: number;
  runningBalance: number;
}

export default function Calendar() {
  const {
    transactions, transactionSplits, categories, accounts,
    suggestionDismissals, suggestionDismissalsStatus, refreshSuggestionDismissals,
  } = useApp();

  // The verdicts are lazy-loaded; a reader must ask (see the note in
  // RecurringCommitmentsReport). Without this the due-next panel's confirmed
  // set was empty in production whatever the user had confirmed.
  useEffect(() => {
    if (suggestionDismissalsStatus === 'idle') void refreshSuggestionDismissals();
  }, [suggestionDismissalsStatus, refreshSuggestionDismissals]);
  const { formatCurrency } = useCurrencyDecimal();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Calculate total balance across all accounts
  const totalOpeningBalance = useMemo(() => {
    return accounts.reduce((sum, acc) => {
      return sum + (acc.openingBalance ?? 0);
    }, 0);
  }, [accounts]);

  // Build calendar grid data
  const calendarData = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay(); // 0 = Sunday
    const daysInMonth = lastDay.getDate();
    const today = new Date();

    // Helper to get YYYY-MM-DD from a Date
    const toDateKey = (d: Date) => {
      const dt = d instanceof Date ? d : new Date(d);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    };

    // Group transactions by date string. The calendar is a CASH-MOVEMENT day
    // ledger (a bank-statement view): buckets are money in / money out by
    // direction, transfers included — it is deliberately NOT an income
    // statement, and its labels must say so (income semantics live in
    // utils/incomeExpense for the reporting surfaces).
    const txByDate = new Map<string, { income: number; expense: number; count: number }>();
    transactions.forEach(t => {
      const dateKey = toDateKey(t.date);
      const existing = txByDate.get(dateKey) || { income: 0, expense: 0, count: 0 };
      existing.count++;
      if (t.amount >= 0) {
        existing.income = toDecimal(existing.income).plus(toDecimal(t.amount)).toNumber();
      } else {
        existing.expense = toDecimal(existing.expense).plus(toDecimal(t.amount).abs()).toNumber();
      }
      txByDate.set(dateKey, existing);
    });

    // Compute running balance day by day
    // Sort all transactions chronologically
    const allSorted = [...transactions].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const balanceByDate = new Map<string, number>();
    let runningBal = totalOpeningBalance;
    allSorted.forEach(t => {
      runningBal += t.amount;
      balanceByDate.set(toDateKey(t.date), runningBal);
    });

    // Fill in balances for dates with no transactions (carry forward)
    const startOfMonth = new Date(year, month, 1);

    // Find the last known balance before the month starts
    let lastKnownBalance = totalOpeningBalance;
    allSorted.forEach(t => {
      if (new Date(t.date) < startOfMonth) {
        lastKnownBalance = balanceByDate.get(toDateKey(t.date)) ?? lastKnownBalance;
      }
    });

    // Build grid: fill previous month days, current month, next month
    const days: DayData[] = [];

    // Previous month padding
    for (let i = 0; i < startDay; i++) {
      const prevDate = new Date(year, month, -startDay + i + 1);
      days.push({
        date: prevDate,
        day: prevDate.getDate(),
        isCurrentMonth: false,
        isToday: false,
        income: 0,
        expense: 0,
        transactionCount: 0,
        runningBalance: 0,
      });
    }

    // Current month days
    let currentBalance = lastKnownBalance;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayTx = txByDate.get(dateKey);

      if (balanceByDate.has(dateKey)) {
        currentBalance = balanceByDate.get(dateKey)!;
      }

      days.push({
        date,
        day: d,
        isCurrentMonth: true,
        isToday: date.toDateString() === today.toDateString(),
        income: dayTx?.income ?? 0,
        expense: dayTx?.expense ?? 0,
        transactionCount: dayTx?.count ?? 0,
        runningBalance: currentBalance,
      });
    }

    // Next month padding to fill 6 rows
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i);
      days.push({
        date: nextDate,
        day: nextDate.getDate(),
        isCurrentMonth: false,
        isToday: false,
        income: 0,
        expense: 0,
        transactionCount: 0,
        runningBalance: 0,
      });
    }

    return days;
  }, [transactions, year, month, totalOpeningBalance]);

  /**
   * THE FORWARD HALF (Design handover 17 Aug, §1 and §8 step 3): what is
   * DUE, projected from the recurring patterns the user has CONFIRMED on
   * "What I'm committed to" — and only those. An unconfirmed detection is
   * the app's opinion, and an opinion must never sit on a calendar looking
   * like a payment that is going to happen (§5). Everything here is an
   * inference and is dressed as one: the word is "due", the styling is
   * quiet, and nothing joins the actual-money figures around it.
   */
  const confirmedPatterns = useMemo(() => {
    const confirmed = dismissedKeys(suggestionDismissals, 'recurring-confirmed');
    const isVouched = (accountId: string, direction: 'in' | 'out', payeeKey: string): boolean =>
      confirmed.has(recurringAnswerKey(accountId, direction, payeeKey));
    // The verdicts are handed to detection as well as applied after it: a
    // vouched payee is read leniently (its amounts need not repeat), which is
    // the whole point of marking a variable commitment recurring. Matched
    // across every label the pattern has worn, so a Confirm given before the
    // bank renamed the payee still reaches this calendar.
    return detectRecurring(transactions, new Date(), { isVouched }).filter(
      d => !d.stopped && d.payeeKeys.some(payee => isVouched(d.accountId, d.direction, payee))
    );
  }, [transactions, suggestionDismissals]);

  /** The panel's window: the next 30 days, from today wherever the grid is. */
  const dueNext = useMemo(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const until = new Date(from.getTime() + 30 * 86_400_000);
    return projectRecurringSchedule(confirmedPatterns, from, until);
  }, [confirmedPatterns]);

  /** Expected items per day of the VISIBLE month, for the quiet cell marks. */
  const dueByDay = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(year, month, 1);
    const from = monthStart > today ? monthStart : today;
    const until = new Date(year, month + 1, 0, 23, 59, 59);
    const byDay = new Map<number, number>();
    for (const occurrence of projectRecurringSchedule(confirmedPatterns, from, until)) {
      if (occurrence.date.getMonth() !== month || occurrence.date.getFullYear() !== year) continue;
      const day = occurrence.date.getDate();
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    return byDay;
  }, [confirmedPatterns, year, month]);

  const accountNameById = useMemo(
    () => new Map(accounts.map(a => [a.id, a.name])),
    [accounts]
  );

  /** The due-next panel, opened out past its eight-row cap. */
  const [showAllDue, setShowAllDue] = useState(false);

  /**
   * WEEK / MONTH / YEAR (owner, 19 Aug: "apple style buttons for week /
   * Month / Year on the left hand side of the 'Today' button… If the user
   * clicks on 'week' then the calendar goes to week view and the income and
   * expenses figures above change… If the user presses the back arrow to go
   * to the previous week, then that is what is viewed").
   *
   * The view lives in the URL, the Investments tabs' idiom: a refresh
   * rebuilds state from nothing and the URL is the one thing a refresh
   * keeps — which matters doubly here, where the home-screen app resumes
   * rather than reloads. Month is the default and carries no parameter.
   * `replace`, not push: switching views is not a navigation the back
   * button should replay.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('view');
  const view: 'week' | 'month' | 'year' =
    viewParam === 'week' || viewParam === 'year' ? viewParam : 'month';
  const setView = useCallback((next: 'week' | 'month' | 'year'): void => {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      if (next === 'month') params.delete('view');
      else params.set('view', next);
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  /**
   * The stretch of time the page is LOOKING AT — one definition, so the
   * tiles, the title and each view's content can never disagree about it.
   * The week runs Sunday to Saturday, matching the grid's own columns.
   */
  const visibleWindow = useMemo(() => {
    if (view === 'week') {
      const start = new Date(year, month, currentDate.getDate() - currentDate.getDay());
      return {
        from: start,
        to: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999),
      };
    }
    if (view === 'year') {
      return { from: new Date(year, 0, 1), to: new Date(year, 11, 31, 23, 59, 59, 999) };
    }
    return { from: new Date(year, month, 1), to: new Date(year, month + 1, 0, 23, 59, 59, 999) };
  }, [view, year, month, currentDate]);

  /**
   * THE TILES SPEAK INCOME AND EXPENDITURE, NOT CASH MOVEMENT (owner,
   * 18 Aug, reading a month whose "Money in" included a six-figure transfer
   * between his own accounts: "These figures are not the figures for one
   * month. It is misleading… they have to at least be correct and match up
   * to what has actually been the user's 'income' and 'expenditure'").
   *
   * They go through the same computeIncomeExpense the dashboard's cards use
   * (transfers and revaluations excluded, splits expanded) — and since the
   * views arrived they cover the VISIBLE WINDOW, whichever it is: step back
   * a week and the figures are that week's (owner, 19 Aug). The day cells
   * stay the honest movement ledger they were; the transaction count stays
   * a movement count over the same window.
   */
  const windowSummary = useMemo(() => {
    const flows = computeIncomeExpense(transactions, transactionSplits, categories, visibleWindow);
    const count = transactions.filter(t => {
      const time = new Date(t.date).getTime();
      return time >= visibleWindow.from.getTime() && time <= visibleWindow.to.getTime();
    }).length;
    return {
      totalIncome: flows.income.toNumber(),
      totalExpense: flows.expenses.toNumber(),
      totalTransactions: count,
    };
  }, [transactions, transactionSplits, categories, visibleWindow]);

  /**
   * THE WEEK, BY CATEGORY, split income from expenditure (owner, 18 Aug:
   * "in weekly, it should show by category, separated by income and
   * expenditure"). Labels come from the register's own labeller, so a
   * category reads here exactly as its column reads there — and the
   * uncategorised remainder is NAMED, never folded silently into a figure
   * that would then claim to be complete.
   */
  const weekBreakdown = useMemo(() => {
    if (view !== 'week') return null;
    const flows = computeIncomeExpense(transactions, transactionSplits, categories, visibleWindow);
    const label = createCategoryLabeller(categories, accounts);
    const grouped = (rows: typeof flows.incomeRows): Array<{ label: string; total: number }> => {
      const totals = new Map<string, ReturnType<typeof toDecimal>>();
      for (const row of rows) {
        const key = label(row) || 'Uncategorised';
        totals.set(key, (totals.get(key) ?? toDecimal(0)).plus(toDecimal(row.amount).abs()));
      }
      return [...totals.entries()]
        .map(([name, total]) => ({ label: name, total: total.toNumber() }))
        .sort((a, b) => b.total - a.total);
    };
    return {
      income: grouped(flows.incomeRows),
      expense: grouped(flows.expenseRows),
      uncategorizedIn: flows.uncategorizedIn.toNumber(),
      uncategorizedOut: flows.uncategorizedOut.toNumber(),
    };
  }, [view, transactions, transactionSplits, categories, accounts, visibleWindow]);

  /**
   * THE YEAR AS TWELVE MONTHS, each with its own income and expenditure,
   * each a door into that month's view. Computed only while the year is on
   * screen — twelve passes over the ledger is a cost the other views never
   * pay.
   */
  const yearMonths = useMemo(() => {
    if (view !== 'year') return null;
    return Array.from({ length: 12 }, (_, m) => {
      const flows = computeIncomeExpense(transactions, transactionSplits, categories, {
        from: new Date(year, m, 1),
        to: new Date(year, m + 1, 0, 23, 59, 59, 999),
      });
      return { month: m, income: flows.income.toNumber(), expense: flows.expenses.toNumber() };
    });
  }, [view, transactions, transactionSplits, categories, year]);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const goToToday = () => setCurrentDate(new Date());
  /** One step of whatever the view counts in: a week, a month, a year. */
  const step = (direction: 1 | -1): void => {
    if (view === 'week') setCurrentDate(new Date(year, month, currentDate.getDate() + 7 * direction));
    else if (view === 'year') setCurrentDate(new Date(year + direction, month, 1));
    else setCurrentDate(new Date(year, month + direction, 1));
  };

  /** "10–16 August 2026", crossing a month or a year honestly when it does. */
  const weekTitle = (): string => {
    const { from, to } = visibleWindow;
    const locale = getDateLocale();
    if (from.getMonth() === to.getMonth()) {
      return `${from.getDate()}–${to.getDate()} ${from.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}`;
    }
    const fromText = from.toLocaleDateString(locale, {
      day: 'numeric', month: 'short',
      ...(from.getFullYear() !== to.getFullYear() ? { year: 'numeric' } : {}),
    });
    return `${fromText} – ${to.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  };

  /**
   * "What was that day made of?" — answered in Find, dated to the day.
   *
   * It used to point at `/transactions?dateFrom=…&dateTo=…`, and that link had
   * never worked: the global list read one parameter, `?account=`, so the day
   * you clicked was thrown away and you arrived at the whole ledger. Find reads
   * the range, shows it, and offers a way to clear it — so the same click now
   * does what it always said it did.
   */
  const handleDayClick = (day: DayData) => {
    if (day.transactionCount > 0) {
      const dateStr = `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`;
      navigate(preserveDemoParam(`/find?dateFrom=${dateStr}&dateTo=${dateStr}`, location.search));
    }
  };

  return (
    <PageWrapper title="Calendar">
      {/* Month summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 px-4 py-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Income</span>
          <p className="text-lg font-semibold text-green-600 dark:text-green-400">{formatCurrency(windowSummary.totalIncome)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 px-4 py-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Expenditure</span>
          {/* `dark:text-red-400` is not decoration — without it this figure is
              unreadable at night. `styles/accessibility-colors.css` remaps
              `.text-red-600` to the brand expense red (#c9304a) with
              `!important` and publishes NO dark-mode counterpart; the dark
              handling lives entirely in `.dark .dark\:text-red-400`, which only
              applies to elements that carry that class. So a bare
              `text-red-600` paints #c9304a on a gray-800 card in dark mode —
              measured 2.8:1, against the 4.5:1 text needs. The income figure
              four lines up has carried the pair all along, which is why only
              the expense went dark. */}
          {/* Through formatCurrency as a NEGATIVE, so it wears the app-wide
              (£X) — a red figure without its brackets was the drift the
              owner caught on this very tile. */}
          <p className="text-lg font-semibold text-red-600 dark:text-red-400">{formatCurrency(-windowSummary.totalExpense)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 px-4 py-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Net</span>
          <p className={`text-lg font-semibold ${toDecimal(windowSummary.totalIncome).minus(toDecimal(windowSummary.totalExpense)).greaterThanOrEqualTo(0) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatCurrency(toDecimal(windowSummary.totalIncome).minus(toDecimal(windowSummary.totalExpense)).toNumber())}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 px-4 py-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Transactions</span>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{windowSummary.totalTransactions}</p>
        </div>
      </div>

      {/* ─ DUE NEXT — the forward panel (Design handover §1, §8 step 3) ────
          Confirmed patterns only, and it says so: an unconfirmed detection
          is an opinion and never sits here looking like a payment that will
          happen. Every figure is an EXPECTATION — neutral, worded "due",
          never joining the actual-money hues around it (P8: an inference is
          not a figure the user entered). */}
      <section
        aria-labelledby="due-next-heading"
        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 px-4 py-3 mb-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="due-next-heading" className="text-sm font-semibold text-gray-900 dark:text-white">
            Due in the next 30 days
            {dueNext.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">
                {dueNext.length}
              </span>
            )}
          </h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Only patterns you have confirmed on{' '}
            <Link
              to={preserveDemoParam('/recurring-payments', location.search)}
              className="text-primary hover:underline"
            >
              What I&rsquo;m committed to
            </Link>
          </span>
        </div>
        {dueNext.length === 0 ? (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Nothing confirmed yet — open{' '}
            <Link
              to={preserveDemoParam('/recurring-payments', location.search)}
              className="text-primary hover:underline"
            >
              Recurring Payments
            </Link>
            {' '}under Plan and confirm a pattern: it appears here before it
            falls due. You can also mark any payment in a register as
            recurring.
          </p>
        ) : (
          <>
            <ul className="mt-2 divide-y divide-gray-50 dark:divide-gray-700/50">
              {(showAllDue ? dueNext : dueNext.slice(0, 8)).map((occurrence) => (
                <li
                  key={`${occurrence.detection.key}-${occurrence.date.getTime()}`}
                  className="py-1.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5"
                >
                  <span className="min-w-0 flex items-baseline gap-2">
                    <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400 w-14 shrink-0">
                      {occurrence.date.toLocaleDateString(getDateLocale(), { day: 'numeric', month: 'short' })}
                    </span>
                    <span className="text-sm text-gray-900 dark:text-white truncate">
                      {occurrence.detection.description}
                    </span>
                    {accountNameById.get(occurrence.detection.accountId) && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 truncate">
                        {accountNameById.get(occurrence.detection.accountId)}
                      </span>
                    )}
                  </span>
                  {/* An expected OUTGOING wears the expense convention —
                      red, (£X) — like every other expense figure in the app
                      (owner, 18 Aug). Expected income is green with its +. */}
                  <span className={`text-sm tabular-nums shrink-0 ${
                    occurrence.detection.direction === 'out'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}>
                    {occurrence.detection.direction === 'out'
                      ? formatCurrency(-occurrence.amount.toNumber())
                      : `+${formatCurrency(occurrence.amount.toNumber())}`}
                  </span>
                </li>
              ))}
            </ul>
            {dueNext.length > 8 && (
              /* Named, never silently truncated — and now a door, not a
                 remark (owner, 18 Aug: "click to view all"). */
              <button
                type="button"
                onClick={() => setShowAllDue(open => !open)}
                className="mt-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:underline"
              >
                {showAllDue
                  ? 'Show fewer'
                  : `…and ${dueNext.length - 8} more in the next 30 days — show all`}
              </button>
            )}
          </>
        )}
      </section>

      {/* Calendar header with navigation */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {view === 'year' ? year : view === 'week' ? weekTitle() : `${monthNames[month]} ${year}`}
          </h2>
          <div className="flex items-center gap-2">
            {/* The view, chosen the way Apple Calendar chooses it — a
                segmented control beside Today (owner, 19 Aug). The chosen
                segment presses in; the URL carries it (see setView). */}
            <div className="flex items-center rounded-lg bg-gray-100 dark:bg-gray-700 p-0.5" role="group" aria-label="Calendar view">
              {(['week', 'month', 'year'] as const).map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setView(option)}
                  aria-pressed={view === option}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    view === option
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  {option === 'week' ? 'Week' : option === 'month' ? 'Month' : 'Year'}
                </button>
              ))}
            </div>
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => step(-1)}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label={`Previous ${view}`}
            >
              <ChevronLeftIcon size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
            <button
              onClick={() => step(1)}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label={`Next ${view}`}
            >
              <ChevronRightIcon size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {view === 'month' && (<>
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-700">
          {dayNames.map(day => (
            <div key={day} className="px-2 py-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid. Plain CSS grid — no ARIA grid role (that requires a
            strict grid>row>gridcell tree and arrow-key navigation; days with
            transactions are real buttons instead, so keyboard users can open
            them with Tab + Enter). */}
        <div className="grid grid-cols-7" aria-label="Financial calendar">
          {calendarData.map((day, i) => (
            <div
              key={i}
              onClick={day.transactionCount > 0 ? () => handleDayClick(day) : undefined}
              role={day.transactionCount > 0 ? 'button' : undefined}
              tabIndex={day.transactionCount > 0 ? 0 : undefined}
              aria-label={day.transactionCount > 0
                ? `Day ${day.day}, ${day.transactionCount} transaction${day.transactionCount === 1 ? '' : 's'}`
                : undefined}
              onKeyDown={day.transactionCount > 0 ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleDayClick(day);
                }
              } : undefined}
              className={`
                min-h-[60px] sm:min-h-[100px] p-1 sm:p-2 border-b border-r border-gray-50 dark:border-gray-700/50
                ${!day.isCurrentMonth ? 'bg-gray-50 dark:bg-gray-800/50 opacity-40' : 'bg-white dark:bg-gray-800'}
                ${day.isToday ? 'ring-2 ring-inset ring-blue-500' : ''}
                ${day.transactionCount > 0 ?'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50':''}
                transition-colors
              `}
            >
              {/* Day number */}
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-medium ${
                  day.isToday
                    ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs'
                    : day.isCurrentMonth
                      ? 'text-gray-900 dark:text-gray-200'
                      : 'text-gray-400 dark:text-gray-600'
                }`}>
                  {day.day}
                </span>
                {day.transactionCount > 0 && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {day.transactionCount}
                  </span>
                )}
              </div>

              {/* Transaction amounts */}
              {day.isCurrentMonth && day.income > 0 && (
                <div className="text-xs text-green-600 dark:text-green-400 font-medium truncate">
                  +{formatCurrency(day.income)}
                </div>
              )}
              {day.isCurrentMonth && day.expense > 0 && (
                <div className="text-xs text-red-500 dark:text-red-400 font-medium truncate">
                  ({formatCurrency(day.expense)})
                </div>
              )}

              {/* Running balance at bottom */}
              {day.isCurrentMonth && day.transactionCount > 0 && (
                <div className={`text-xs mt-auto pt-1 font-medium truncate ${
                  day.runningBalance < 0 ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {formatCurrency(day.runningBalance)}
                </div>
              )}

              {/* EXPECTED, not happened: confirmed patterns falling due on
                  this day. Neutral and worded, deliberately nothing like the
                  actual-money figures above — an inference on a calendar must
                  never read as a transaction (P8). The panel above the grid
                  carries the detail. */}
              {day.isCurrentMonth && (dueByDay.get(day.day) ?? 0) > 0 && (
                <div className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                  {dueByDay.get(day.day)} due
                </div>
              )}
            </div>
          ))}
        </div>
        </>)}

        {/* THE WEEK, BY CATEGORY — income one side, expenditure the other
            (owner, 18 Aug). Every category figure is a sum of that week's
            rows; the uncategorised remainder is named rather than folded in. */}
        {view === 'week' && weekBreakdown && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-100 dark:bg-gray-700" aria-label="Week by category">
            <div className="bg-white dark:bg-gray-800 p-4 sm:p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Income</h3>
              {weekBreakdown.income.length === 0 && weekBreakdown.uncategorizedIn === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No income recorded this week.</p>
              ) : (
                <ul>
                  {weekBreakdown.income.map(row => (
                    <li key={row.label} className="py-1.5 flex items-baseline justify-between gap-4 border-t border-gray-50 dark:border-gray-700/50 first:border-0">
                      <span className="text-sm text-gray-900 dark:text-white truncate">{row.label}</span>
                      <span className="text-sm tabular-nums text-green-600 dark:text-green-400 shrink-0">
                        +{formatCurrency(row.total)}
                      </span>
                    </li>
                  ))}
                  {weekBreakdown.uncategorizedIn > 0 && (
                    <li className="py-1.5 flex items-baseline justify-between gap-4 border-t border-gray-50 dark:border-gray-700/50">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Uncategorised — not yet filed</span>
                      <span className="text-sm tabular-nums text-gray-500 dark:text-gray-400 shrink-0">
                        +{formatCurrency(weekBreakdown.uncategorizedIn)}
                      </span>
                    </li>
                  )}
                </ul>
              )}
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 sm:p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Expenditure</h3>
              {weekBreakdown.expense.length === 0 && weekBreakdown.uncategorizedOut === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No expenditure recorded this week.</p>
              ) : (
                <ul>
                  {weekBreakdown.expense.map(row => (
                    <li key={row.label} className="py-1.5 flex items-baseline justify-between gap-4 border-t border-gray-50 dark:border-gray-700/50 first:border-0">
                      <span className="text-sm text-gray-900 dark:text-white truncate">{row.label}</span>
                      <span className="text-sm tabular-nums text-red-600 dark:text-red-400 shrink-0">
                        {formatCurrency(-row.total)}
                      </span>
                    </li>
                  ))}
                  {weekBreakdown.uncategorizedOut > 0 && (
                    <li className="py-1.5 flex items-baseline justify-between gap-4 border-t border-gray-50 dark:border-gray-700/50">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Uncategorised — not yet filed</span>
                      <span className="text-sm tabular-nums text-gray-500 dark:text-gray-400 shrink-0">
                        {formatCurrency(-weekBreakdown.uncategorizedOut)}
                      </span>
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* THE YEAR AS TWELVE MONTHS, each a door into its month view. */}
        {view === 'year' && yearMonths && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-gray-100 dark:bg-gray-700" aria-label="Year by month">
            {yearMonths.map(({ month: m, income, expense }) => (
              <button
                key={m}
                type="button"
                onClick={() => { setCurrentDate(new Date(year, m, 1)); setView('month'); }}
                className="bg-white dark:bg-gray-800 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors"
                aria-label={`Open ${monthNames[m]} ${year}`}
              >
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{monthNames[m]}</p>
                <p className="text-sm tabular-nums text-green-600 dark:text-green-400 mt-1">
                  +{formatCurrency(income)}
                </p>
                <p className="text-sm tabular-nums text-red-600 dark:text-red-400">
                  {formatCurrency(-expense)}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      <PageTip
        id="calendar-intro"
        title="Your financial calendar"
        description="See money moving in and out laid out by day, like a bank statement — transfers included. Click any day with transactions to view the details. Green amounts are money in, amounts in parentheses are money out."
      />
    </PageWrapper>
  );
}
