import { memo, useEffect } from 'react';
import { CheckIcon as Check, AlertCircleIcon as AlertCircle } from '../icons';
import { formatCurrency } from '../../utils/formatters';
import { useLogger } from '../services/ServiceProvider';

interface SplitControlsProps {
  splitMode: 'amount' | 'percentage';
  setSplitMode: (mode: 'amount' | 'percentage') => void;
  autoBalance: boolean;
  setAutoBalance: (value: boolean) => void;
  autoDistribute: () => void;
  isBalanced: boolean;
  remaining: number;
}

export const SplitControls = memo(function SplitControls({ splitMode,
  setSplitMode,
  autoBalance,
  setAutoBalance,
  autoDistribute,
  isBalanced,
  remaining
 }: SplitControlsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('SplitControls component initialized', {
      componentName: 'SplitControls'
    });
  }, []);

  return (
    <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex gap-1 bg-white dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setSplitMode('amount')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                splitMode === 'amount'
                  ? 'bg-gray-500 text-white'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Amount
            </button>
            <button
              onClick={() => setSplitMode('percentage')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                splitMode === 'percentage'
                  ? 'bg-gray-500 text-white'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Percentage
            </button>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoBalance}
              onChange={(e) => setAutoBalance(e.target.checked)}
              className="rounded"
            />
            <span className="text-gray-700 dark:text-gray-300">Auto-balance</span>
          </label>

          <button
            onClick={autoDistribute}
            className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"
          >
            Distribute Equally
          </button>
        </div>

        <div className={`flex items-center gap-2 px-3 py-1 rounded-lg ${
          isBalanced 
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
        }`}>
          {isBalanced ? <Check size={16} /> : <AlertCircle size={16} />}
          <span className="text-sm font-medium">
            {isBalanced 
              ? 'Balanced' 
              : `${remaining > 0 ? 'Under' : 'Over'} by ${formatCurrency(Math.abs(remaining))}`}
          </span>
        </div>
      </div>
    </div>
  );
});