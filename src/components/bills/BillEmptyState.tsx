/**
 * @component BillEmptyState
 * @description Empty state component for different bill tabs
 * @performance Memoized to prevent unnecessary re-renders
 */

import React, { memo } from 'react';
import { CalendarIcon, PlusIcon } from '../icons';
import { logger } from '../../services/loggingService';

interface BillEmptyStateProps {
  activeTab: string;
  onAddBill: () => void;
}

export const BillEmptyState = memo(function BillEmptyState({ activeTab, onAddBill }: BillEmptyStateProps) {
  const getMessage = () => {
    try {
      switch (activeTab) {
        case 'upcoming':
          return {
            title: 'No upcoming bills',
            description: 'You have no upcoming bills at the moment'
          };
        case 'overdue':
          return {
            title: 'No overdue bills',
            description: 'Great! You have no overdue bills'
          };
        default:
          return {
            title: 'No bills found',
            description: 'Start by adding your first bill to track payments and due dates'
          };
      }
    } catch (error) {
      logger.error('Error getting empty state message:', error, 'BillEmptyState');
      return {
        title: 'No bills found',
        description: 'Start by adding your first bill'
      };
    }
  };

  const { title, description } = getMessage();

  return (
    <div className="col-span-full text-center py-12">
      <CalendarIcon className="mx-auto text-gray-400 mb-4" size={48} />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      <p className="text-gray-500 dark:text-gray-400 mb-4">
        {description}
      </p>
      {activeTab === 'all' && (
        <button
          onClick={() => {
            try {
              logger.debug('Add first bill button clicked', { componentName: 'BillEmptyState' });
              onAddBill();
            } catch (error) {
              logger.error('Add first bill button click failed:', error, 'BillEmptyState');
            }
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90 transition-colors"
        >
          <PlusIcon size={16} />
          Add Your First Bill
        </button>
      )}
    </div>
  );
});