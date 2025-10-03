import { memo, useEffect } from 'react';
import { TrendingUpIcon, TrendingDownIcon, MapPinIcon } from '../../icons';
import { StateTaxCalculatorService } from '../../../services/stateTaxCalculatorService';
import type { StateTaxCalculation } from '../../../services/stateTaxService';
import { useLogger } from '../services/ServiceProvider';

interface StateComparisonTableProps {
  results: StateTaxCalculation[];
  selectedState: string;
  formatCurrency: (amount: any) => string;
}

export const StateComparisonTable = memo(function StateComparisonTable({ results,
  selectedState,
  formatCurrency
 }: StateComparisonTableProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('StateComparisonTable component initialized', {
      componentName: 'StateComparisonTable'
    });
  }, []);

  const formattedData = StateTaxCalculatorService.formatComparisonData(results, formatCurrency);
  const sortedData = [...formattedData].sort((a, b) => (a.totalTax || 0) - (b.totalTax || 0));

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
              State
            </th>
            <th className="text-right py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
              Tax Amount
            </th>
            <th className="text-right py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
              Effective Rate
            </th>
            <th className="text-center py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
              Difference
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((state, index) => {
            const isSelected = state.stateCode === selectedState;
            const selectedTax = formattedData.find(s => s.stateCode === selectedState)?.totalTax || 0;
            const difference = (state.totalTax || 0) - selectedTax;
            
            return (
              <tr
                key={state.stateCode}
                className={`border-b border-gray-100 dark:border-gray-700 ${
                  isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    {index === 0 && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                        Best
                      </span>
                    )}
                    <MapPinIcon size={16} className="text-gray-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {state.state}
                    </span>
                    {isSelected && (
                      <span className="text-xs text-gray-500">(Current)</span>
                    )}
                  </div>
                </td>
                <td className="text-right py-3 px-3">
                  <span className={`font-medium ${
                    StateTaxCalculatorService.getTaxRateColor(state.effectiveRate)
                  }`}>
                    {state.formattedTax}
                  </span>
                </td>
                <td className="text-right py-3 px-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {state.effectiveRate.toFixed(2)}%
                  </span>
                </td>
                <td className="text-center py-3 px-3">
                  {!isSelected && (
                    <div className="flex items-center justify-center gap-1">
                      {difference < 0 ? (
                        <>
                          <TrendingDownIcon size={14} className="text-green-500" />
                          <span className="text-sm text-green-600">
                            {formatCurrency(Math.abs(difference))}
                          </span>
                        </>
                      ) : difference > 0 ? (
                        <>
                          <TrendingUpIcon size={14} className="text-red-500" />
                          <span className="text-sm text-red-600">
                            {formatCurrency(difference)}
                          </span>
                        </>
                      ) : (
                        <span className="text-sm text-gray-400">Same</span>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});