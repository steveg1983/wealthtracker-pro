import { memo, useEffect } from 'react';
import { RadioCheckbox } from '../../common/RadioCheckbox';
import { useLogger } from '../services/ServiceProvider';

interface AdditionalOptionsProps {
  includeCharts: boolean;
  includeTransactions: boolean;
  onIncludeChartsChange: (value: boolean) => void;
  onIncludeTransactionsChange: (value: boolean) => void;
}

/**
 * Additional report options component
 */
export const AdditionalOptions = memo(function AdditionalOptions({ includeCharts,
  includeTransactions,
  onIncludeChartsChange,
  onIncludeTransactionsChange
 }: AdditionalOptionsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('AdditionalOptions component initialized', {
      componentName: 'AdditionalOptions'
    });
  }, []);

  return (
    <div className="grid grid-cols-2 gap-4">
      <label className="flex items-center gap-2">
        <RadioCheckbox
          checked={includeCharts}
          onChange={onIncludeChartsChange}
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Include charts and visualizations
        </span>
      </label>
      <label className="flex items-center gap-2">
        <RadioCheckbox
          checked={includeTransactions}
          onChange={onIncludeTransactionsChange}
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Include transaction details
        </span>
      </label>
    </div>
  );
});