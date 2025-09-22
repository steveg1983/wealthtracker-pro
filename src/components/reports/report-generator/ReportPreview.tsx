import { memo, useEffect } from 'react';
import { PresentationChartBarIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import type { ReportData, ReportOptions } from '../../../services/reportGeneratorService';
import { useLogger } from '../services/ServiceProvider';

interface ReportPreviewProps {
  reportData: ReportData;
  reportOptions: ReportOptions;
  formatCurrency: (amount: number) => string;
}

/**
 * Report preview component
 */
export const ReportPreview = memo(function ReportPreview({ reportData,
  reportOptions,
  formatCurrency
 }: ReportPreviewProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('ReportPreview component initialized', {
      componentName: 'ReportPreview'
    });
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Report Preview
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <PreviewCard
          label="Net Worth"
          value={formatCurrency(reportData.netWorth)}
          valueClass="text-gray-900 dark:text-white"
        />
        <PreviewCard
          label="Monthly Income"
          value={formatCurrency(reportData.income)}
          valueClass="text-green-600"
        />
        <PreviewCard
          label="Monthly Expenses"
          value={formatCurrency(reportData.expenses)}
          valueClass="text-red-600"
        />
        <PreviewCard
          label="Savings Rate"
          value={`${reportData.savingsRate.toFixed(1)}%`}
          valueClass="text-gray-600"
        />
      </div>

      <div className="mt-4 p-4 bg-blue-50 dark:bg-gray-900/20 rounded-lg">
        <div className="flex items-start gap-2">
          <PresentationChartBarIcon className="h-5 w-5 text-gray-600 mt-0.5" />
          <div>
            <div className="font-medium text-blue-900 dark:text-blue-200">
              Report will include {reportOptions.sections.filter(s => s.enabled).length} sections
            </div>
            <div className="text-sm text-blue-700 dark:text-gray-300 mt-1">
              Date range: {format(reportOptions.dateRange.start, 'MMM d, yyyy')} - {format(reportOptions.dateRange.end, 'MMM d, yyyy')}
            </div>
            <div className="text-sm text-blue-700 dark:text-gray-300">
              {reportData.transactionCount} transactions in selected period
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

/**
 * Preview card component
 */
const PreviewCard = memo(function PreviewCard({
  label,
  value,
  valueClass
}: {
  label: string;
  value: string;
  valueClass: string;
}) {
  const logger = useLogger();
  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`text-xl font-bold ${valueClass}`}>
        {value}
      </div>
    </div>
  );
});