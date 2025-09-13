/**
 * @component Header
 * @description Mortgage calculator header with title and actions
 */

import { memo, useEffect } from 'react';
import { 
  CalculatorIcon, 
  PlusIcon, 
  CompareIcon,
  DatabaseIcon 
} from '../../icons';
import type { HeaderProps } from './types';
import { logger } from '../../../services/loggingService';

export const Header = memo(function Header({
  onNewCalculation,
  onShowComparison,
  onToggleAccountData,
  useRealAccountData,
  hasCalculations
}: HeaderProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('Header component initialized', {
      componentName: 'Header'
    });
  }, []);

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <CalculatorIcon size={24} className="text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Mortgage Calculator
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Calculate mortgages, compare options, and plan your home purchase
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleAccountData}
          className={`
            px-4 py-2 rounded-lg font-medium transition-colors
            ${useRealAccountData 
              ? 'bg-green-600 text-white hover:bg-green-700' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }
          `}
          title="Use real account data"
        >
          <DatabaseIcon size={16} className="inline mr-2" />
          Real Data
        </button>
        
        {hasCalculations && (
          <button
            onClick={onShowComparison}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            <CompareIcon size={16} className="inline mr-2" />
            Compare
          </button>
        )}
        
        <button
          onClick={onNewCalculation}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
        >
          <PlusIcon size={16} className="inline mr-2" />
          New Calculation
        </button>
      </div>
    </div>
  );
});