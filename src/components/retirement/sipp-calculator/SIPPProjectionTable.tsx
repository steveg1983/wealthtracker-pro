import { memo, useState, useEffect } from 'react';
import { TrendingUpIcon, ChevronUpIcon, ChevronDownIcon } from '../../icons';
import type { SIPPProjection } from '../../../services/sippCalculatorService';
import { logger } from '../../../services/loggingService';

interface SIPPProjectionTableProps {
  projection: SIPPProjection[];
  formatCurrency: (amount: number) => string;
}

/**
 * SIPP projection table component
 */
export const SIPPProjectionTable = memo(function SIPPProjectionTable({
  projection,
  formatCurrency
}: SIPPProjectionTableProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('SIPPProjectionTable component initialized', {
      componentName: 'SIPPProjectionTable'
    });
  }, []);

  const [showProjection, setShowProjection] = useState(false);

  if (projection.length === 0) return <></>;

  return (
    <div>
      <button
        onClick={() => setShowProjection(!showProjection)}
        className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-500 hover:text-blue-700 dark:hover:text-gray-300 mb-3"
      >
        <TrendingUpIcon size={14} />
        {showProjection ? 'Hide' : 'Show'} Year-by-Year Projection
        {showProjection ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
      </button>

      {showProjection && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-600">
                <th className="text-left py-2">Age</th>
                <th className="text-right py-2">Your Contribution</th>
                <th className="text-right py-2">Tax Relief</th>
                <th className="text-right py-2">Employer</th>
                <th className="text-right py-2">Growth</th>
                <th className="text-right py-2">Balance</th>
              </tr>
            </thead>
            <tbody>
              {projection.slice(0, 10).map((year) => (
                <tr key={year.age} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-2">{year.age}</td>
                  <td className="text-right py-2">{formatCurrency(year.contribution)}</td>
                  <td className="text-right py-2 text-green-600 dark:text-green-400">
                    +{formatCurrency(year.taxRelief)}
                  </td>
                  <td className="text-right py-2 text-gray-600 dark:text-gray-500">
                    +{formatCurrency(year.employerContribution)}
                  </td>
                  <td className="text-right py-2 text-purple-600 dark:text-purple-400">
                    +{formatCurrency(year.growth)}
                  </td>
                  <td className="text-right py-2 font-semibold">
                    {formatCurrency(year.balance)}
                  </td>
                </tr>
              ))}
              {projection.length > 10 && (
                <tr>
                  <td colSpan={6} className="text-center py-2 text-gray-500 dark:text-gray-400">
                    ... and {projection.length - 10} more years
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});