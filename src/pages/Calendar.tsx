import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { preserveDemoParam } from '../utils/navigation';
import { ChevronLeftIcon, ChevronRightIcon } from '../components/icons';
import PageWrapper from '../components/PageWrapper';
import PageTip from '../components/PageTip';
import { toDecimal } from '../utils/decimal';

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
  const { transactions, accounts } = useApp();
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

  // Month summary
  const monthSummary = useMemo(() => {
    const monthDays = calendarData.filter(d => d.isCurrentMonth);
    return {
      totalIncome: monthDays.reduce((s, d) => s.plus(toDecimal(d.income)), toDecimal(0)).toNumber(),
      totalExpense: monthDays.reduce((s, d) => s.plus(toDecimal(d.expense)), toDecimal(0)).toNumber(),
      totalTransactions: monthDays.reduce((s, d) => s + d.transactionCount, 0),
    };
  }, [calendarData]);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const goToToday = () => setCurrentDate(new Date());
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const handleDayClick = (day: DayData) => {
    if (day.transactionCount > 0) {
      const dateStr = `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`;
      navigate(preserveDemoParam(`/transactions?dateFrom=${dateStr}&dateTo=${dateStr}`, location.search));
    }
  };

  return (
    <PageWrapper title="Calendar">
      {/* Month summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 px-4 py-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Money in</span>
          <p className="text-lg font-semibold text-green-600 dark:text-green-400">{formatCurrency(monthSummary.totalIncome)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 px-4 py-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Money out</span>
          <p className="text-lg font-semibold text-red-600">{formatCurrency(monthSummary.totalExpense)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 px-4 py-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Net</span>
          <p className={`text-lg font-semibold ${toDecimal(monthSummary.totalIncome).minus(toDecimal(monthSummary.totalExpense)).greaterThanOrEqualTo(0) ? 'text-green-600 dark:text-green-400' : 'text-red-600'}`}>
            {formatCurrency(toDecimal(monthSummary.totalIncome).minus(toDecimal(monthSummary.totalExpense)).toNumber())}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 px-4 py-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Transactions</span>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{monthSummary.totalTransactions}</p>
        </div>
      </div>

      {/* Calendar header with navigation */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {monthNames[month]} {year}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Today
            </button>
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeftIcon size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Next month"
            >
              <ChevronRightIcon size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

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
                ${day.transactionCount > 0 ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500' : ''}
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
            </div>
          ))}
        </div>
      </div>

      <PageTip
        id="calendar-intro"
        title="Your financial calendar"
        description="See money moving in and out laid out by day, like a bank statement — transfers included. Click any day with transactions to view the details. Green amounts are money in, amounts in parentheses are money out."
      />
    </PageWrapper>
  );
}
