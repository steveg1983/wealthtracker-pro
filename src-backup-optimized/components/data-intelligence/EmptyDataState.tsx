import React from 'react';
import { DatabaseIcon } from '../icons';

interface EmptyDataStateProps {
  onGoToTransactions: () => void;
}

export default function EmptyDataState({ 
  onGoToTransactions 
}: EmptyDataStateProps): React.JSX.Element {
  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-8 text-center">
      <DatabaseIcon size={48} className="mx-auto text-amber-500 mb-4" />
      <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-2">
        No Transaction Data Available
      </h3>
      <p className="text-amber-700 dark:text-amber-300 mb-4">
        Add some transactions to start analyzing your spending patterns, detecting subscriptions, and gaining insights.
      </p>
      <button
        onClick={onGoToTransactions}
        className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
      >
        Go to Transactions
      </button>
    </div>
  );
}