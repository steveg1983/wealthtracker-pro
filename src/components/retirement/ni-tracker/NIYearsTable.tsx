import { memo, useEffect } from 'react';
import { 
  CalendarIcon as Calendar,
  CheckCircleIcon as CheckCircle,
  XCircleIcon as XCircle
} from '../../icons';
import type { NIYear, NICalculationResults } from '../../../services/niTrackerService';
import { logger } from '../../../services/loggingService';

interface NIYearsTableProps {
  years: NIYear[];
  canBuyYears: string[];
}

/**
 * NI Years Table component
 * Displays NI contribution history in a table format
 */
export const NIYearsTable = memo(function NIYearsTable({
  years,
  canBuyYears
}: NIYearsTableProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('NIYearsTable component initialized', {
      componentName: 'NIYearsTable'
    });
  }, []);

  // Show only the last 10 years in reverse order
  const recentYears = years.slice(-10).reverse();

  return (
    <div className="mt-6">
      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Calendar className="h-5 w-5 text-gray-600" />
        National Insurance Record (Recent Years)
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left py-2 px-3">Tax Year</th>
              <th className="text-left py-2 px-3">Status</th>
              <th className="text-left py-2 px-3">Contracted Out</th>
              <th className="text-left py-2 px-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {recentYears.map((year, index) => (
              <YearRow 
                key={index} 
                year={year} 
                canBuy={canBuyYears.includes(year.year)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

/**
 * Individual year row component
 */
const YearRow = memo(function YearRow({
  year,
  canBuy
}: {
  year: NIYear;
  canBuy: boolean;
}) {
  const getStatusStyle = (status: NIYear['status']) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'credited':
        return 'bg-blue-100 text-blue-800';
      case 'gap':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="py-2 px-3">{year.year}</td>
      <td className="py-2 px-3">
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusStyle(year.status)}`}>
          {year.status === 'paid' && <CheckCircle className="h-3 w-3" />}
          {year.status === 'gap' && <XCircle className="h-3 w-3" />}
          {year.status.charAt(0).toUpperCase() + year.status.slice(1)}
        </span>
      </td>
      <td className="py-2 px-3">
        {year.contractedOut ? 
          <span className="text-amber-600">Yes</span> : 
          <span className="text-gray-400">No</span>
        }
      </td>
      <td className="py-2 px-3">
        {year.status === 'gap' && canBuy && (
          <button className="text-xs text-gray-600 hover:text-blue-800 font-medium">
            Buy this year
          </button>
        )}
      </td>
    </tr>
  );
});