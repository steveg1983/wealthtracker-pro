import { memo, useEffect } from 'react';
import type { Envelope } from '../../services/envelopeService';
import { logger } from '../../services/loggingService';

interface TransferFundsModalProps {
  envelopes: Envelope[];
  transferFrom: string;
  transferTo: string;
  transferAmount: string;
  transferDescription: string;
  formatCurrency: (value: number) => string;
  onTransferFromChange: (value: string) => void;
  onTransferToChange: (value: string) => void;
  onTransferAmountChange: (value: string) => void;
  onTransferDescriptionChange: (value: string) => void;
  onTransfer: () => void;
  onClose: () => void;
}

/**
 * Transfer funds modal component
 * Handles fund transfers between envelopes
 */
export const TransferFundsModal = memo(function TransferFundsModal({
  envelopes,
  transferFrom,
  transferTo,
  transferAmount,
  transferDescription,
  formatCurrency,
  onTransferFromChange,
  onTransferToChange,
  onTransferAmountChange,
  onTransferDescriptionChange,
  onTransfer,
  onClose
}: TransferFundsModalProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('TransferFundsModal component initialized', {
      componentName: 'TransferFundsModal'
    });
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Transfer Funds</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              From Envelope
            </label>
            <select
              value={transferFrom}
              onChange={(e) => onTransferFromChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select envelope...</option>
              {envelopes.map(envelope => (
                <option key={envelope.id} value={envelope.id}>
                  {envelope.name} ({formatCurrency(envelope.remainingAmount.toNumber())})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              To Envelope
            </label>
            <select
              value={transferTo}
              onChange={(e) => onTransferToChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select envelope...</option>
              {envelopes.filter(e => e.id !== transferFrom).map(envelope => (
                <option key={envelope.id} value={envelope.id}>
                  {envelope.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Amount
            </label>
            <input
              type="number"
              value={transferAmount}
              onChange={(e) => onTransferAmountChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description (Optional)
            </label>
            <input
              type="text"
              value={transferDescription}
              onChange={(e) => onTransferDescriptionChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Transfer reason..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={onTransfer}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Transfer
          </button>
        </div>
      </div>
    </div>
  );
});
