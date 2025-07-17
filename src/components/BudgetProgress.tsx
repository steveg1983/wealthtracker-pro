import React, { useMemo } from 'react';
import { AlertCircle, CheckCircle, XCircle } from './icons';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';

interface BudgetProgressProps {
  category: string;
  budgetAmount: number;
  spent: number;
  onEdit?: () => void;
  onDelete?: () => void;
}

const BudgetProgress = React.memo(function BudgetProgress({ 
  category, 
  budgetAmount, 
  spent, 
  onEdit, 
  onDelete 
}: BudgetProgressProps) {
  const { formatCurrency } = useCurrencyDecimal();
  
  const { percentage, remaining } = useMemo(() => {
    const pct = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
    const rem = budgetAmount - spent;
    return { percentage: pct, remaining: rem };
  }, [budgetAmount, spent]);
  
  const progressColor = useMemo(() => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  }, [percentage]);
  
  const statusIcon = useMemo(() => {
    if (percentage >= 100) return <XCircle className="text-red-500" size={20} />;
    if (percentage >= 80) return <AlertCircle className="text-yellow-500" size={20} />;
    return <CheckCircle className="text-green-500" size={20} />;
  }, [percentage]);
  
  const statusText = useMemo(() => {
    if (percentage >= 100) return 'Over budget';
    if (percentage >= 80) return 'Approaching limit';
    return 'On track';
  }, [percentage]);

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">{category}</h3>
          {statusIcon}
        </div>
        <div className="flex gap-1">
          {onEdit && (
            <button
              onClick={onEdit}
              className="text-sm text-primary hover:text-secondary px-2 py-1"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="text-sm text-red-500 hover:text-red-700 px-2 py-1"
            >
              Delete
            </button>
          )}
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Spent</span>
          <span className="font-medium">{formatCurrency(spent)} of {formatCurrency(budgetAmount)}</span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${progressColor}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        
        <div className="flex justify-between text-sm">
          <span className={`font-medium ${percentage >= 100 ? 'text-red-600' : 'text-gray-700'}`}>
            {statusText}
          </span>
          <span className={remaining >= 0 ? 'text-green-600' : 'text-red-600'}>
            {remaining >= 0 ? `${formatCurrency(remaining)} left` : `${formatCurrency(Math.abs(remaining))} over`}
          </span>
        </div>
      </div>
    </div>
  );
});

export default BudgetProgress;
