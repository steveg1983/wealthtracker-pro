import React from 'react';
import { TargetIcon } from './icons';

interface FinancialGoalTrackerProps {
  onDataChange: () => void;
}

export default function FinancialGoalTracker({ onDataChange }: FinancialGoalTrackerProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
      <TargetIcon size={48} className="mx-auto mb-4 text-gray-400" />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Financial Goal Tracker
      </h3>
      <p className="text-gray-500 dark:text-gray-400">
        Financial goal tracking tools will be available in a future update
      </p>
    </div>
  );
}