import React from 'react';
import { TrendingUpIcon } from './icons';

interface NetWorthProjectorProps {
  onDataChange: () => void;
}

export default function NetWorthProjector({ onDataChange: _onDataChange }: NetWorthProjectorProps) {
  return (
    <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
      <TrendingUpIcon size={48} className="mx-auto mb-4 text-gray-400" />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Net Worth Projector
      </h3>
      <p className="text-gray-500 dark:text-gray-400">
        Net worth projection tools will be available in a future update
      </p>
    </div>
  );
}
