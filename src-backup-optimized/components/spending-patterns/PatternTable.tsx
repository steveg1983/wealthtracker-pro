/**
 * Pattern Table Component
 * Displays spending patterns in a table format
 */

import React, { useEffect } from 'react';
import { 
  TrendingUpIcon,
  EyeIcon,
  CheckCircleIcon,
  CalendarIcon,
  ClockIcon,
  AlertCircleIcon,
  BarChart3Icon
} from '../icons';
import { spendingPatternsService } from '../../services/spendingPatternsService';
import type { SpendingPattern } from '../../services/dataIntelligenceService';
import { useLogger } from '../services/ServiceProvider';

interface PatternTableProps {
  patterns: SpendingPattern[];
}

const PatternTable = React.memo(({ patterns }: PatternTableProps) => {
  const getPatternIcon = (type: SpendingPattern['patternType']) => {
    switch (type) {
      case 'recurring':
        return <CalendarIcon size={16} className="text-gray-600 dark:text-gray-500" />;
      case 'seasonal':
        return <ClockIcon size={16} className="text-purple-600 dark:text-purple-400" />;
      case 'trend':
        return <TrendingUpIcon size={16} className="text-green-600 dark:text-green-400" />;
      case 'anomaly':
        return <AlertCircleIcon size={16} className="text-red-600 dark:text-red-400" />;
      default:
        return <BarChart3Icon size={16} className="text-gray-600 dark:text-gray-400" />;
    }
  };

  if (patterns.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="text-center py-8">
          <TrendingUpIcon size={48} className="mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500 dark:text-gray-400">No spending patterns found</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
            Try analyzing your transactions to discover patterns
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Pattern
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Frequency
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Confidence
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Detected
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {patterns.map((pattern) => (
              <tr key={pattern.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-6 py-4">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {pattern.description}
                    </div>
                    {pattern.merchant && (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {pattern.merchant}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${spendingPatternsService.getPatternTypeColor(pattern.patternType)}`}>
                    {getPatternIcon(pattern.patternType)}
                    {pattern.patternType}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-gray-900 dark:text-white">
                    {pattern.category}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-gray-900 dark:text-white capitalize">
                    {pattern.frequency}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-gray-900 dark:text-white">
                    {spendingPatternsService.formatCurrency(pattern.amount)}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    ±{spendingPatternsService.formatCurrency(pattern.variance)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${spendingPatternsService.getConfidenceBadge(pattern.confidence)}`}>
                    <CheckCircleIcon size={12} />
                    {(pattern.confidence * 100).toFixed(0)}%
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">
                    {spendingPatternsService.formatDate(pattern.detectedAt)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button className="text-gray-600 dark:text-gray-500 hover:text-blue-900 dark:hover:text-gray-300">
                    <EyeIcon size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

PatternTable.displayName = 'PatternTable';

export default PatternTable;