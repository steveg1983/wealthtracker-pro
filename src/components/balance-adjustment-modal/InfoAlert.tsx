import React, { memo } from 'react';
import { logger } from '../../services/loggingService';

/**
 * Information alert explaining balance adjustment process
 * Provides context about why a transaction is created
 */
export const InfoAlert = memo(function InfoAlert(): React.JSX.Element {
  try {
    return (
      <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          Changing the balance requires creating a transaction to maintain accurate records. 
          This adjustment will be recorded in your transaction history.
        </p>
      </div>
    );
  } catch (error) {
    logger.error('InfoAlert render error:', error);
    return (
      <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          Note: Balance adjustment information unavailable
        </p>
      </div>
    );
  }
});