import React, { useMemo } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { CalendarIcon, AlertCircleIcon, CheckCircleIcon } from '../icons';
import type { Transaction } from '../../types';

interface UpcomingBillsWidgetProps {
  size: 'small' | 'medium' | 'large';
  settings: {
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
  isPaid: boolean;
  isOverdue: boolean;
  daysUntilDue: number;
}

export default function UpcomingBillsWidget({ size, settings }: UpcomingBillsWidgetProps) {
  const { transactions, categories } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const daysAhead = settings.daysAhead || 30;
  const showPaid = settings.showPaid ?? false;

  const upcomingBills = useMemo(() => {
    const now = new Date();
    const bills: UpcomingBill[] = [];
    
    // Find recurring bills from past transactions
    const billCategories = ['Bills', 'Utilities', 'Subscriptions', 'Insurance', 'Rent', 'Mortgage'];
    const relevantCategories = categories.filter(cat => 
      billCategories.some(billCat => cat.name.toLowerCase().includes(billCat.toLowerCase()))
    );
    
    // Group transactions by description to find recurring patterns
    const transactionGroups = new Map<string, Transaction[]>();
    transactions
      .filter(t => t.type === 'expense' && relevantCategories.some(cat => cat.id === t.category))
      .forEach(t => {
        const key = t.description.toLowerCase().trim();
        if (!transactionGroups.has(key)) {
          transactionGroups.set(key, []);
        }
        transactionGroups.get(key)!.push(t);
      });

    // Identify recurring bills and predict next due date
    transactionGroups.forEach((groupTransactions, description) => {
      if (groupTransactions.length >= 2) {
        // Sort by date
        const sorted = [...groupTransactions].sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        
        // Calculate average interval between transactions
        let totalDays = 0;
        for (let i = 1; i < Math.min(sorted.length, 4); i++) {
          const prevTx = sorted[i - 1];
          const currentTx = sorted[i];
          if (!prevTx || !currentTx) continue;

          const days = Math.floor(
            (new Date(prevTx.date).getTime() - new Date(currentTx.date).getTime()) /
            (1000 * 60 * 60 * 24)
          );
          totalDays += days;
        }
        const avgInterval = Math.round(totalDays / Math.min(sorted.length - 1, 3));
        
        // Predict next due date
        const lastTransaction = sorted[0];
        if (!lastTransaction) return;

        const lastDate = new Date(lastTransaction.date);
        const predictedDueDate = new Date(lastDate);
        predictedDueDate.setDate(predictedDueDate.getDate() + avgInterval);
        
        const daysUntilDue = Math.floor(
          (predictedDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        // Only include if within the specified days ahead
        if (daysUntilDue <= daysAhead && daysUntilDue >= -7) {
          bills.push({
            id: lastTransaction.id,
            name: lastTransaction.description,
            amount: lastTransaction.amount,
            dueDate: predictedDueDate,
            category: categories.find(c => c.id === lastTransaction.category)?.name || 'Bills',
            isPaid: daysUntilDue < 0 && daysUntilDue >= -avgInterval / 4,
            isOverdue: daysUntilDue < 0,
            daysUntilDue
          });
        }
      }
    });

    // Sort by due date
    return bills
      .filter(bill => showPaid || !bill.isPaid)
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
      .slice(0, size === 'small' ? 3 : size === 'medium' ? 5 : 10);
  }, [transactions, categories, daysAhead, showPaid, size]);

  const totalUpcoming = useMemo(() => {
    return upcomingBills
      .filter(bill => !bill.isPaid && !bill.isOverdue)
      .reduce((sum, bill) => sum + bill.amount, 0);
  }, [upcomingBills]);

  if (upcomingBills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <CalendarIcon size={48} className="mb-2 opacity-50" />
        <p className="text-sm">No upcoming bills</p>
        <p className="text-xs mt-1">Bills will appear based on your transaction history</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatCurrency(totalUpcoming)}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Due in next {daysAhead} days
        </p>
      </div>

      {/* Bills List */}
      <div className={`space-y-2 ${size === 'large' ? 'max-h-64 overflow-y-auto' : ''}`}>
        {upcomingBills.map((bill) => (
          <div
            key={bill.id}
            className={`p-3 rounded-lg border ${
              bill.isOverdue 
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
                : bill.isPaid
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                  {bill.name}
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {bill.category}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(bill.amount)}
                </p>
                <p className={`text-xs ${
                  bill.isOverdue 
                    ? 'text-red-600 dark:text-red-400' 
                    : bill.daysUntilDue <= 3 
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {bill.isOverdue ? (
                    <span className="flex items-center gap-1 justify-end">
                      <AlertCircleIcon size={12} />
                      Overdue
                    </span>
                  ) : bill.isPaid ? (
                    <span className="flex items-center gap-1 justify-end">
                      <CheckCircleIcon size={12} />
                      Paid
                    </span>
                  ) : bill.daysUntilDue === 0 ? (
                    'Due today'
                  ) : bill.daysUntilDue === 1 ? (
                    'Due tomorrow'
                  ) : (
                    `Due in ${bill.daysUntilDue} days`
                  )}
                </p>
              </div>
            </div>
            
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {bill.dueDate.toLocaleDateString('en-GB', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Alert for overdue bills */}
      {upcomingBills.some(bill => bill.isOverdue && !bill.isPaid) && (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
            <AlertCircleIcon size={16} />
            You have overdue bills
          </p>
        </div>
      )}
    </div>
  );
}