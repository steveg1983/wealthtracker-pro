/**
 * @component ResultsSection
 * @description Displays state tax calculation results
 */

import { memo, useEffect } from 'react';
import { MapPinIcon, ChevronDownIcon, ChevronUpIcon } from '../../icons';
import { StateTaxCalculatorService } from '../../../services/stateTaxCalculatorService';
import { TaxBreakdown } from './TaxBreakdown';
import type { ResultsSectionProps } from './types';
import { useLogger } from '../services/ServiceProvider';

export const ResultsSection = memo(function ResultsSection({ calculation, 
  selectedState, 
  formatCurrency,
  showBreakdown,
  onToggleBreakdown
 }: ResultsSectionProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('ResultsSection component initialized', {
      componentName: 'ResultsSection'
    });
  }, []);

  if (!calculation) return <></>;
  
  const effectiveRate = calculation.effectiveRate;
  
  return (
    <div className="mt-6">
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPinIcon size={20} className="text-blue-600" />
            <span className="font-medium text-gray-900 dark:text-white">
              {StateTaxCalculatorService.formatStateName(selectedState)} State Tax
            </span>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${
              StateTaxCalculatorService.getTaxRateColor(effectiveRate)
            }`}>
              {formatCurrency(calculation.totalTax || 0)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {effectiveRate.toFixed(2)}% effective rate
            </div>
          </div>
        </div>
        
        <button
          onClick={onToggleBreakdown}
          className="mt-3 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
        >
          {showBreakdown ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
          {showBreakdown ? 'Hide' : 'Show'} Tax Breakdown
        </button>
      </div>
      
      {showBreakdown && (
        <div className="mt-4">
          <TaxBreakdown
            calculation={calculation}
            formatCurrency={formatCurrency}
            isExpanded={true}
            onToggle={() => {}}
          />
        </div>
      )}
    </div>
  );
});