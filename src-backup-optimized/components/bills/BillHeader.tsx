/**
 * @component BillHeader
 * @description Header component for Bill Management with add bill functionality
 * @performance Memoized to prevent unnecessary re-renders
 */

import React, { memo } from 'react';
import { PlusIcon } from '../icons';
import { lazyLogger as logger } from '../../services/serviceFactory';

interface BillHeaderProps {
  onAddBill: () => void;
}

export const BillHeader = memo(function BillHeader({ onAddBill }: BillHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Bill Management</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Track and manage your recurring bills and payments
        </p>
      </div>
      <button
        onClick={() => {
          try {
            logger.debug('Add bill button clicked', { componentName: 'BillHeader' });
            onAddBill();
          } catch (error) {
            logger.error('Add bill button click failed:', error, 'BillHeader');
          }
        }}
        className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90 transition-colors"
      >
        <PlusIcon size={16} />
        Add Bill
      </button>
    </div>
  );
});