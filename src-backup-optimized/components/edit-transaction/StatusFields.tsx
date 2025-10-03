import React, { useEffect, memo } from 'react';
import { CheckIcon2, LinkIcon } from '../icons';
import { RadioCheckbox } from '../common/RadioCheckbox';
import { useLogger } from '../services/ServiceProvider';

interface StatusFieldsProps {
  cleared: boolean;
  reconciledWith: string;
  transactionReconciledWith?: string;
  onClearedChange: (cleared: boolean) => void;
}

export const StatusFields = memo(function StatusFields({ cleared,
  reconciledWith,
  transactionReconciledWith,
  onClearedChange
 }: StatusFieldsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('StatusFields component initialized', {
      componentName: 'StatusFields'
    });
  }, []);

  return (
    <div className="md:col-span-12 space-y-3">
      <label className="flex items-center gap-2 cursor-pointer">
        <RadioCheckbox
          checked={cleared}
          onChange={onClearedChange}
        />
        <CheckIcon2 size={16} className="text-green-600 dark:text-green-400" />
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Reconciled
        </span>
      </label>

      <label className="flex items-center gap-2">
        <RadioCheckbox
          checked={!!reconciledWith && reconciledWith !== 'manual'}
          disabled
          onChange={() => {}}
        />
        <LinkIcon size={16} className="text-gray-600 dark:text-gray-500" />
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Linked to bank statement
        </span>
      </label>

      {transactionReconciledWith && transactionReconciledWith !== 'manual' && (
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-500">
          <LinkIcon size={16} />
          <span>Reconciled with transaction ID: {transactionReconciledWith}</span>
        </div>
      )}
    </div>
  );
});
