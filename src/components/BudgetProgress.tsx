import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';

interface BudgetProgressProps {
  category: string;
  budgetAmount: number;
  spent: number;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function BudgetProgress({ 
  category, 
  budgetAmount, 
  spent, 
  onEdit, 
  onDelete 
}: BudgetProgressProps) {
  const percentage = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
  const remaining = budgetAmount - spent;
  
  const getProgressColor = () => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };
  
  const getStatusIcon = () => {
    if (percentage >= 100) return <XCircle className="text-red-500" size={20} />;
    if (percentage >= 80) return <AlertCircle className="text-yellow-500" size={20} />;
    return <CheckCircle className="text-green-500" size={20} />;
  };
  
  const getStatusText = () => {
    if (percentage >= 100) return 'Over budget';
    if (percentage >= 80) return 'Approaching limit';
    return 'On track';
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">{category}</h3>
          {getStatusIcon()}
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
          <span className="font-medium">£{spent.toFixed(2)} of £{budgetAmount.toFixed(2)}</span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        
        <div className="flex justify-between text-sm">
          <span className={`font-medium ${percentage >= 100 ? 'text-red-600' : 'text-gray-700'}`}>
            {getStatusText()}
          </span>
          <span className={remaining >= 0 ? 'text-green-600' : 'text-red-600'}>
            {remaining >= 0 ? `£${remaining.toFixed(2)} left` : `£${Math.abs(remaining).toFixed(2)} over`}
          </span>
        </div>
      </div>
    </div>
  );
}
