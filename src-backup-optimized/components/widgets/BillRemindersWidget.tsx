import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { CalendarIcon, CheckCircleIcon, AlertCircleIcon } from '../icons';
import { format, addDays } from 'date-fns';

interface BillRemindersWidgetProps {
  isCompact?: boolean;
}

interface UpcomingBill {
  id: string;
  name: string;
  amount: number;
  dueDate: Date;
  isPaid: boolean;
  isOverdue: boolean;
  daysUntilDue: number;
  category: string;
  isAutoPay?: boolean;
}

export default function BillRemindersWidget({ isCompact = false }: BillRemindersWidgetProps): React.JSX.Element {
  const navigate = useNavigate();
  const { transactions } = useApp();
  const { formatCurrency } = useCurrencyDecimal();

  const upcomingBills = useMemo(() => {
    const today = new Date();
    // Identify recurring bills from transaction history
    const recurringPatterns = new Map<string, { amount: number; dayOfMonth: number; lastPaid?: Date }>();
    
    // Analyze last 3 months of transactions
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    transactions
      .filter(t => 
        t.type === 'expense' && 
        new Date(t.date) >= threeMonthsAgo &&
        t.isRecurring
      )
      .forEach(t => {
        const key = `${t.description}-${Math.round(t.amount)}`;
        const date = new Date(t.date);
        
        if (!recurringPatterns.has(key) || 
            (recurringPatterns.get(key)?.lastPaid || new Date(0)) < date) {
          recurringPatterns.set(key, {
            amount: Math.abs(t.amount),
            dayOfMonth: date.getDate(),
            lastPaid: date
          });
        }
      });

    // Generate upcoming bills
    const bills: UpcomingBill[] = [];
    
    recurringPatterns.forEach((pattern, key) => {
      const [description] = key.split('-');
      const nextDueDate = new Date(today);
      nextDueDate.setDate(pattern.dayOfMonth);
      
      // If due date has passed this month, set to next month
      if (nextDueDate <= today) {
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      }
      
      const daysUntilDue = Math.ceil((nextDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      bills.push({
        id: key,
        name: description,
        amount: pattern.amount,
        dueDate: nextDueDate,
        isPaid: false,
        isOverdue: daysUntilDue < 0,
        daysUntilDue,
        category: 'Subscription',
        isAutoPay: Math.random() > 0.5 // Mock auto-pay status
      });
    });

    // Add some mock bills for demo
    if (bills.length === 0) {
      bills.push(
        {
          id: 'rent',
          name: 'Rent Payment',
          amount: 1500,
          dueDate: new Date(today.getFullYear(), today.getMonth(), 1),
          isPaid: today.getDate() > 1,
          isOverdue: false,
          daysUntilDue: 1 - today.getDate(),
          category: 'Housing',
          isAutoPay: true
        },
        {
          id: 'utilities',
          name: 'Electric Bill',
          amount: 120,
          dueDate: addDays(today, 5),
          isPaid: false,
          isOverdue: false,
          daysUntilDue: 5,
          category: 'Utilities',
          isAutoPay: false
        },
        {
          id: 'internet',
          name: 'Internet',
          amount: 60,
          dueDate: addDays(today, 12),
          isPaid: false,
          isOverdue: false,
          daysUntilDue: 12,
          category: 'Utilities',
          isAutoPay: true
        }
      );
    }

    // Sort by due date
    return bills.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  }, [transactions]);

  const summary = useMemo(() => {
    const unpaidBills = upcomingBills.filter(b => !b.isPaid);
    const totalDue = unpaidBills.reduce((sum, bill) => sum + bill.amount, 0);
    const overdueBills = unpaidBills.filter(b => b.isOverdue);
    const dueSoon = unpaidBills.filter(b => b.daysUntilDue <= 3 && b.daysUntilDue >= 0);
    
    return {
      totalDue,
      unpaidCount: unpaidBills.length,
      overdueCount: overdueBills.length,
      dueSoonCount: dueSoon.length
    };
  }, [upcomingBills]);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-blue-50 dark:bg-gray-900/20 rounded-lg p-3">
          <div className="text-xs text-gray-600 dark:text-gray-500">Total Due</div>
          <div className="text-lg font-bold text-blue-700 dark:text-gray-300">
            {formatCurrency(summary.totalDue)}
          </div>
        </div>
        
        {summary.overdueCount > 0 ? (
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
            <div className="text-xs text-red-600 dark:text-red-400">Overdue</div>
            <div className="text-lg font-bold text-red-700 dark:text-red-300">
              {summary.overdueCount} {summary.overdueCount === 1 ? 'bill' : 'bills'}
            </div>
          </div>
        ) : (
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
            <div className="text-xs text-green-600 dark:text-green-400">On Track</div>
            <div className="text-lg font-bold text-green-700 dark:text-green-300">
              All good!
            </div>
          </div>
        )}
      </div>

      {/* Urgent Alert */}
      {summary.dueSoonCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <AlertCircleIcon size={16} className="text-amber-600" />
          <span className="text-sm text-amber-700 dark:text-amber-300">
            {summary.dueSoonCount} {summary.dueSoonCount === 1 ? 'bill' : 'bills'} due in next 3 days
          </span>
        </div>
      )}

      {/* Bills List */}
      <div className="space-y-2">
        {upcomingBills.slice(0, isCompact ? 4 : 6).map(bill => (
          <div 
            key={bill.id}
            className={`p-3 rounded-lg border ${
              bill.isOverdue 
                ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10'
                : bill.daysUntilDue <= 3
                ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-gray-900 dark:text-white">
                    {bill.name}
                  </span>
                  {bill.isAutoPay && (
                    <span className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded">
                      Auto
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <CalendarIcon size={12} className="text-gray-400" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {format(bill.dueDate, 'MMM d')}
                  </span>
                  <span className="text-xs text-gray-400">•</span>
                  <span className={`text-xs ${
                    bill.isOverdue ? 'text-red-600 dark:text-red-400' :
                    bill.daysUntilDue <= 3 ? 'text-amber-600 dark:text-amber-400' :
                    'text-gray-500 dark:text-gray-400'
                  }`}>
                    {bill.isOverdue ? 'Overdue' :
                     bill.daysUntilDue === 0 ? 'Due today' :
                     bill.daysUntilDue === 1 ? 'Due tomorrow' :
                     `${bill.daysUntilDue} days`}
                  </span>
                </div>
              </div>
              
              <div className="text-right">
                <div className="font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(bill.amount)}
                </div>
                {bill.isPaid && (
                  <CheckCircleIcon size={14} className="text-green-600 ml-auto mt-1" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* View All Button */}
      <button
        onClick={() => navigate('/transactions?filter=recurring')}
        className="w-full text-sm text-gray-600 hover:text-blue-700 dark:text-gray-500 dark:hover:text-gray-300 text-center py-2"
      >
        View All Bills →
      </button>
    </div>
  );
}
