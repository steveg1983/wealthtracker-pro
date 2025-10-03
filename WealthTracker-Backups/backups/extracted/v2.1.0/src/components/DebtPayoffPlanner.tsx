import React from 'react';
import { CreditCardIcon } from './icons';

interface DebtPayoffPlannerProps {
  onDataChange: () => void;
}

export default function DebtPayoffPlanner({ onDataChange }: DebtPayoffPlannerProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
      <CreditCardIcon size={48} className="mx-auto mb-4 text-gray-400" />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Debt Payoff Planning
      </h3>
      <p className="text-gray-500 dark:text-gray-400">
        Debt payoff planning tools will be available in a future update
      </p>
    </div>
  );
}