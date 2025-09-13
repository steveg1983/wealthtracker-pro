import { memo, useEffect } from 'react';
import { CheckIcon, ClockIcon } from '../icons';
import { formatCurrency } from '../../utils/formatters';
import { toDecimal } from '../../utils/decimal';
import { mobileService } from '../../services/mobileService';
import { logger } from '../../services/loggingService';

interface CompleteStepProps {
  amount: number;
}

export const CompleteStep = memo(function CompleteStep({ amount }: CompleteStepProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('CompleteStep component initialized', {
      componentName: 'CompleteStep'
    });
  }, []);

  return (
    <div className="text-center space-y-6">
      <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
        <CheckIcon size={32} className="text-green-600 dark:text-green-400" />
      </div>
      
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Expense Saved!
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {formatCurrency(toDecimal(amount).toNumber())} expense has been {mobileService.isOffline() ? 'queued for sync' : 'saved'}
        </p>
      </div>
      
      {mobileService.isOffline() && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-gray-600 dark:text-gray-400 text-sm shadow-md border-l-4 border-amber-400 dark:border-amber-600">
          <ClockIcon size={16} className="inline mr-2 text-amber-600 dark:text-amber-400" />
          Will sync automatically when you're back online
        </div>
      )}
    </div>
  );
});