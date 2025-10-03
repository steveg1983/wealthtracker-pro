import React, { useMemo, useState } from 'react';
import { 
  BellIcon,
  CalendarDaysIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import type { Transaction } from '../../types';

interface BillReminderWidgetProps {
  transactions: Transaction[];
  formatCurrency: (value: number) => string;
  navigate: (path: string) => void;
  settings?: {
    daysAhead?: number;
    showPaid?: boolean;
  };
}

interface UpcomingBill {
  id: string;
  name: string;
  amount: number;
  dueDate: Date;
  category: string;
  isRecurring: boolean;
  isPaid: boolean;
  isOverdue: boolean;
  daysUntilDue: number;
  lastPaidDate?: Date;
  frequency?: 'weekly' | 'monthly' | 'quarterly' | 'annual';
}

export default function BillReminderWidget({ 
  transactions, 
  formatCurrency, 
  navigate,
  settings = { daysAhead: 14, showPaid: false }
}: BillReminderWidgetProps): React.JSX.Element {
  
  const [selectedPeriod, setSelectedPeriod] = useState<7 | 14 | 30>((settings.daysAhead as 7 | 14 | 30) || 14);
  
  // Identify recurring bills from transaction history
  const upcomingBills = useMemo(() => {
    const bills: UpcomingBill[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Group transactions by description to find recurring patterns
    const transactionGroups = new Map<string, Transaction[]>();
    
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        // Normalize description for grouping
        const normalizedDesc = t.description.toLowerCase().trim();
        if (!transactionGroups.has(normalizedDesc)) {
          transactionGroups.set(normalizedDesc, []);
        }
        transactionGroups.get(normalizedDesc)!.push(t);
      });
    
    // Analyze each group for recurring patterns
    transactionGroups.forEach((groupTransactions, description) => {
      if (groupTransactions.length < 2) return;
      
      // Sort by date
      const sorted = groupTransactions.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      
      // Calculate average interval between transactions
      const intervals: number[] = [];
      for (let i = 0; i < sorted.length - 1 && i < 5; i++) {
        const days = Math.floor(
          (new Date(sorted[i].date).getTime() - new Date(sorted[i + 1].date).getTime()) 
          / (1000 * 60 * 60 * 24)
        );
        intervals.push(days);
      }
      
      if (intervals.length === 0) return;
      
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      
      // Determine frequency
      let frequency: UpcomingBill['frequency'] = 'monthly';
      if (avgInterval <= 8) frequency = 'weekly';
      else if (avgInterval <= 35) frequency = 'monthly';
      else if (avgInterval <= 95) frequency = 'quarterly';
      else if (avgInterval <= 370) frequency = 'annual';
      else return; // Not a regular pattern
      
      // Get the most recent transaction
      const lastTransaction = sorted[0];
      const lastPaidDate = new Date(lastTransaction.date);
      
      // Calculate next due date
      const nextDueDate = new Date(lastPaidDate);
      switch (frequency) {
        case 'weekly':
          nextDueDate.setDate(nextDueDate.getDate() + 7);
          break;
        case 'monthly':
          nextDueDate.setMonth(nextDueDate.getMonth() + 1);
          break;
        case 'quarterly':
          nextDueDate.setMonth(nextDueDate.getMonth() + 3);
          break;
        case 'annual':
          nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
          break;
      }
      
      // Skip if the next due date is in the past (already paid)
      if (nextDueDate < today && !settings.showPaid) return;
      
      const daysUntilDue = Math.floor(
        (nextDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      // Only include bills within the selected period
      if (Math.abs(daysUntilDue) > selectedPeriod) return;
      
      bills.push({
        id: lastTransaction.id,
        name: lastTransaction.description,
        amount: Math.abs(lastTransaction.amount),
        dueDate: nextDueDate,
        category: lastTransaction.category || 'Other',
        isRecurring: true,
        isPaid: daysUntilDue < 0 && Math.abs(daysUntilDue) <= 7,
        isOverdue: daysUntilDue < 0 && Math.abs(daysUntilDue) > 7,
        daysUntilDue,
        lastPaidDate,
        frequency
      });
    });
    
    // Sort by due date
    return bills.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  }, [transactions, selectedPeriod, settings.showPaid]);
  
  const totalUpcoming = useMemo(() => {
    return upcomingBills
      .filter(bill => !bill.isPaid && !bill.isOverdue)
      .reduce((sum, bill) => sum + bill.amount, 0);
  }, [upcomingBills]);
  
  const overdueBills = useMemo(() => {
    return upcomingBills.filter(bill => bill.isOverdue);
  }, [upcomingBills]);
  
  if (upcomingBills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <BellIcon className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No Upcoming Bills
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No recurring bills detected in the next {selectedPeriod} days
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Bill Reminders
        </h3>
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(Number(e.target.value) as 7 | 14 | 30)}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-800"
        >
          <option value={7}>Next 7 days</option>
          <option value={14}>Next 14 days</option>
          <option value={30}>Next 30 days</option>
        </select>
      </div>
      
      {/* Overdue Alert */}
      {overdueBills.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <div className="flex items-center">
            <ExclamationCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                {overdueBills.length} Overdue Bill{overdueBills.length > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-red-600 dark:text-red-400">
                Total: {formatCurrency(overdueBills.reduce((sum, b) => sum + b.amount, 0))}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Summary */}
      <div className="bg-blue-50 dark:bg-gray-900/20 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Total Due ({selectedPeriod} days)
          </span>
          <span className="text-lg font-semibold text-gray-600 dark:text-gray-500">
            {formatCurrency(totalUpcoming)}
          </span>
        </div>
      </div>
      
      {/* Bills List */}
      <div className="space-y-2">
        {upcomingBills.slice(0, 5).map(bill => (
          <div 
            key={bill.id}
            className={`border rounded-lg p-3 cursor-pointer transition-all hover:shadow-md ${
              bill.isOverdue 
                ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' 
                : bill.isPaid
                  ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
            }`}
            onClick={() => navigate(`/transactions?search=${encodeURIComponent(bill.name)}`)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center">
                  {bill.isOverdue ? (
                    <ExclamationCircleIcon className="h-4 w-4 text-red-500 mr-2" />
                  ) : bill.isPaid ? (
                    <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                  ) : (
                    <ClockIcon className="h-4 w-4 text-gray-400 mr-2" />
                  )}
                  <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                    {bill.name}
                  </h4>
                </div>
                
                <div className="flex items-center mt-1 text-xs text-gray-500 dark:text-gray-400">
                  <CalendarDaysIcon className="h-3 w-3 mr-1" />
                  <span>
                    {bill.isOverdue 
                      ? `Overdue ${Math.abs(bill.daysUntilDue)} days`
                      : bill.isPaid
                        ? 'Paid'
                        : bill.daysUntilDue === 0
                          ? 'Due today'
                          : bill.daysUntilDue === 1
                            ? 'Due tomorrow'
                            : `Due in ${bill.daysUntilDue} days`}
                  </span>
                  {bill.frequency && (
                    <>
                      <span className="mx-1">•</span>
                      <span className="capitalize">{bill.frequency}</span>
                    </>
                  )}
                </div>
              </div>
              
              <div className="text-right">
                <p className={`font-semibold ${
                  bill.isOverdue 
                    ? 'text-red-600 dark:text-red-400' 
                    : bill.isPaid
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-900 dark:text-white'
                }`}>
                  {formatCurrency(bill.amount)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {bill.category}
                </p>
              </div>
            </div>
            
            {/* Due Date Bar */}
            {!bill.isPaid && !bill.isOverdue && bill.daysUntilDue <= 7 && (
              <div className="mt-2">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                  <div 
                    className={`h-1 rounded-full ${
                      bill.daysUntilDue <= 1 
                        ? 'bg-red-500' 
                        : bill.daysUntilDue <= 3
                          ? 'bg-yellow-500'
                          : 'bg-gray-500'
                    }`}
                    style={{ width: `${((7 - bill.daysUntilDue) / 7) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* View All Link */}
      {upcomingBills.length > 5 && (
        <button
          onClick={() => navigate('/recurring-transactions')}
          className="w-full flex items-center justify-center text-sm text-gray-600 dark:text-gray-500 hover:text-blue-700 dark:hover:text-gray-300 font-medium"
        >
          View all {upcomingBills.length} bills
          <ChevronRightIcon className="h-4 w-4 ml-1" />
        </button>
      )}
      
      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => navigate('/add-transaction?type=expense&recurring=true')}
          className="px-3 py-2 bg-blue-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-500 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
        >
          Add Bill
        </button>
        <button
          onClick={() => navigate('/recurring-transactions')}
          className="px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
        >
          Manage Bills
        </button>
      </div>
    </div>
  );
}