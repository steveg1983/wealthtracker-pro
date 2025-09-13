import { memo, useEffect } from 'react';
import { CheckCircleIcon } from '../icons';
import { logger } from '../../services/loggingService';

interface ReconciliationSuccessProps {
  show: boolean;
}

/**
 * Reconciliation success component
 * Shows success message when account is fully reconciled
 */
export const ReconciliationSuccess = memo(function ReconciliationSuccess({
  show
}: ReconciliationSuccessProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ReconciliationSuccess component initialized', {
      componentName: 'ReconciliationSuccess'
    });
  }, []);

  if (!show) return <></>;

  return (
    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-8 text-center">
      <CheckCircleIcon className="mx-auto text-green-600 dark:text-green-400 mb-3" size={48} />
      <h4 className="text-lg font-medium text-green-900 dark:text-green-300">
        Account Reconciled!
      </h4>
      <p className="text-sm text-green-800 dark:text-green-200 mt-1">
        All transactions are cleared and your balance matches the statement.
      </p>
    </div>
  );
});