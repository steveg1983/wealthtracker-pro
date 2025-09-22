import React, { useEffect } from 'react';
import { EditIcon, CreditCardIcon, TargetIcon, InfoIcon, TrendingUpIcon, DollarSignIcon } from '../../icons';
import type { Debt, PayoffProjection } from '../../DebtManagement';
import type { Account } from '../../../types';
import { useLogger } from '../services/ServiceProvider';

interface DebtCardProps {
  debt: Debt;
  account: Account | undefined;
  projection: PayoffProjection | undefined;
  formatCurrency: (value: number) => string;
  onEdit: (debtId: string) => void;
}

export function DebtCard({ debt, account, projection, formatCurrency, onEdit  }: DebtCardProps): React.JSX.Element {
  const logger = useLogger();
  const getDebtTypeColor = (type: Debt['type']): string => {
    switch (type) {
      case 'credit_card': return 'text-red-600 dark:text-red-400';
      case 'mortgage': return 'text-green-600 dark:text-green-400';
      case 'student_loan': return 'text-gray-600 dark:text-gray-500';
      case 'auto_loan': return 'text-purple-600 dark:text-purple-400';
      case 'personal_loan': return 'text-orange-600 dark:text-orange-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getDebtTypeIcon = (type: Debt['type']) => {
    switch (type) {
      case 'credit_card': return CreditCardIcon;
      case 'mortgage': return TargetIcon;
      case 'student_loan': return InfoIcon;
      case 'auto_loan': return TrendingUpIcon;
      case 'personal_loan': return DollarSignIcon;
      default: return InfoIcon;
    }
  };

  const Icon = getDebtTypeIcon(debt.type);

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6 hover:shadow-xl transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Icon className={getDebtTypeColor(debt.type)} size={24} />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {debt.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
              {debt.type.replace('_', ' ')}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(debt.id)}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <EditIcon size={16} />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Balance:</span>
          <span className="text-lg font-bold text-red-600 dark:text-red-400">
            {formatCurrency(debt.balance.toNumber())}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Interest Rate:</span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {debt.interestRate.toFixed(2)}%
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Min Payment:</span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {formatCurrency(debt.minimumPayment.toNumber())}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Due Date:</span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {debt.dueDate}{debt.dueDate === 1 ? 'st' : debt.dueDate === 2 ? 'nd' : debt.dueDate === 3 ? 'rd' : 'th'} of month
          </span>
        </div>
        
        {projection && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Payoff Time:</span>
              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                {Math.floor(projection.monthsToPayoff / 12)}y {projection.monthsToPayoff % 12}m
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total Interest:</span>
              <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
                {formatCurrency(projection.totalInterest.toNumber())}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
