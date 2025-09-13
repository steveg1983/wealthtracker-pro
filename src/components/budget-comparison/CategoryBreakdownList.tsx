import { memo, useState, useEffect } from 'react';
import { 
  ChevronDownIcon, 
  ChevronRightIcon, 
  AlertTriangleIcon, 
  CheckCircleIcon 
} from '../icons';
import { formatCurrency } from '../../utils/formatters';
// Local types for rendering
type CategoryStatus = 'over' | 'warning' | 'on-track' | 'under';
interface CategoryComparison {
  categoryId: string;
  categoryName: string;
  budgeted: number;
  actual: number;
  variance: number;
  variancePercent: number;
  transactions: number;
  status: CategoryStatus;
}
type DateRange = 'current' | 'last' | 'year';
import { logger } from '../../services/loggingService';

// Style helpers available to sub-components
function getStatusTextClass(status: CategoryStatus): string {
  switch (status) {
    case 'over':
      return 'text-red-600 dark:text-red-400';
    case 'warning':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'on-track':
    case 'under':
    default:
      return 'text-green-600 dark:text-green-400';
  }
}

function getProgressBarColor(spentPercent: number): string {
  if (spentPercent > 100) return 'bg-red-500';
  if (spentPercent > 90) return 'bg-yellow-500';
  return 'bg-green-500';
}

interface CategoryBreakdownListProps {
  categoryComparisons: CategoryComparison[];
  selectedPeriod: DateRange;
}

/**
 * Category breakdown list component
 * Extracted from BudgetComparison for single responsibility
 */
export const CategoryBreakdownList = memo(function CategoryBreakdownList({ 
  categoryComparisons, 
  selectedPeriod 
}: CategoryBreakdownListProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('CategoryBreakdownList component initialized', {
      componentName: 'CategoryBreakdownList'
    });
  }, []);

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleCategoryExpansion = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const getStatusIcon = (status: CategoryComparison['status']) => {
    switch (status) {
      case 'over':
        return <AlertTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />;
      case 'warning':
        return <AlertTriangleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />;
      case 'on-track':
      case 'under':
        return <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />;
    }
  };

  const getStatusTextClass = (status: CategoryStatus) => {
    switch (status) {
      case 'over':
        return 'text-red-600 dark:text-red-400';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'on-track':
      case 'under':
      default:
        return 'text-green-600 dark:text-green-400';
    }
  };

  const getProgressBarColor = (spentPercent: number) => {
    if (spentPercent > 100) return 'bg-red-500';
    if (spentPercent > 90) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Category Breakdown
        </h3>
      </div>
      
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {categoryComparisons.map((category) => {
          const spentPercent = category.budgeted > 0 
            ? (category.actual / category.budgeted) * 100 
            : 100;
          const isExpanded = expandedCategories.has(category.categoryId);
          
          return (
            <div key={category.categoryId}>
              <div 
                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                onClick={() => toggleCategoryExpansion(category.categoryId)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <button className="p-1">
                      {isExpanded ? (
                        <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronRightIcon className="h-4 w-4 text-gray-500" />
                      )}
                    </button>
                    {getStatusIcon(category.status)}
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {category.categoryName}
                    </h4>
                    {category.transactions > 0 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        ({category.transactions} transactions)
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {formatCurrency(category.actual)} / {formatCurrency(category.budgeted)}
                      </p>
                      <p className={`text-sm font-medium ${getStatusTextClass(category.status)}`}>
                        {category.variance >= 0 ? 'Under' : 'Over'} by {formatCurrency(Math.abs(category.variance))}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <CategoryProgressBar 
                  spentPercent={spentPercent} 
                  status={category.status}
                />
              </div>
              
              {/* Expanded Details */}
              {isExpanded && (
                <CategoryExpandedDetails 
                  category={category} 
                  selectedPeriod={selectedPeriod}
                />
              )}
            </div>
          );
        })}
      </div>
      
      {categoryComparisons.length === 0 && (
        <div className="p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            No budget data available for the selected period.
          </p>
        </div>
      )}
    </div>
  );
});

// Progress bar sub-component
const CategoryProgressBar = memo(function CategoryProgressBar({ 
  spentPercent, 
  status 
}: { 
  spentPercent: number; 
  status: CategoryComparison['status'];
}) {
  return (
    <div className="relative">
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all ${getProgressBarColor(spentPercent)}`}
          style={{ width: `${Math.min(spentPercent, 100)}%` }}
        />
        {spentPercent > 100 && (
          <div 
            className="absolute top-0 left-0 h-2 bg-red-600 dark:bg-red-400 opacity-50 rounded-full"
            style={{ width: '100%' }}
          />
        )}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs text-gray-500 dark:text-gray-400">0%</span>
        <span className={`text-xs font-medium ${getStatusTextClass(status)}`}>
          {spentPercent.toFixed(1)}%
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">100%</span>
      </div>
    </div>
  );
});

// Expanded details sub-component
const CategoryExpandedDetails = memo(function CategoryExpandedDetails({ 
  category, 
  selectedPeriod 
}: { 
  category: CategoryComparison; 
  selectedPeriod: DateRange;
}) {
  return (
    <div className="px-6 pb-4 bg-gray-50 dark:bg-gray-700/30">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-gray-600 dark:text-gray-400">Budget Period</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)}ly
          </p>
        </div>
        <div>
          <p className="text-gray-600 dark:text-gray-400">Average per Transaction</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {category.transactions > 0 
              ? formatCurrency(category.actual / category.transactions)
              : '-'}
          </p>
        </div>
        <div>
          <p className="text-gray-600 dark:text-gray-400">Variance Percentage</p>
          <p className={`font-medium ${getStatusTextClass(category.status)}`}>
            {category.variancePercent >= 0 ? '+' : ''}{category.variancePercent.toFixed(1)}%
          </p>
        </div>
      </div>
      
      {category.status === 'over' && (
        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">
            💡 Tip: Review recent transactions in this category to identify areas for potential savings.
          </p>
        </div>
      )}
      
      {category.status === 'under' && category.variancePercent > 30 && (
        <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <p className="text-sm text-green-800 dark:text-green-200">
            ✨ Great job! You're well under budget. Consider adjusting your budget or allocating savings elsewhere.
          </p>
        </div>
      )}
    </div>
  );
});
