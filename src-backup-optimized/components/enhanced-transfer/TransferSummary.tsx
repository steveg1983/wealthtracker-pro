import { memo, useEffect } from 'react';
import { useLogger } from '../services/ServiceProvider';

interface TransferSummaryProps {
  amount: string;
  fees: string;
  exchangeRate: string;
  sourceAccountId: string;
  targetAccountId: string;
  netAmount: number;
  convertedAmount: number;
}

export const TransferSummary = memo(function TransferSummary({ amount,
  fees,
  exchangeRate,
  sourceAccountId,
  targetAccountId,
  netAmount,
  convertedAmount
 }: TransferSummaryProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('TransferSummary component initialized', {
      componentName: 'TransferSummary'
    });
  }, []);

  if (!amount || !sourceAccountId || !targetAccountId) {
    return null;
  }

  return (
    <div className="bg-blue-50 dark:bg-gray-900 p-4 rounded-xl">
      <h3 className="font-medium text-gray-900 dark:text-white mb-2">Transfer Summary</h3>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Amount:</span>
          <span className="font-medium">{parseFloat(amount).toLocaleString()}</span>
        </div>
        {fees && (
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Fees:</span>
            <span className="text-red-600">-{parseFloat(fees).toLocaleString()}</span>
          </div>
        )}
        {fees && (
          <div className="flex justify-between border-t pt-1">
            <span className="text-gray-600 dark:text-gray-400">Net Amount:</span>
            <span className="font-medium">{netAmount.toLocaleString()}</span>
          </div>
        )}
        {exchangeRate && exchangeRate !== '1' && (
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">After Exchange:</span>
            <span className="font-medium">{convertedAmount.toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
});
