/**
 * @component BillRenderer
 * @description Renders bills based on active tab with comprehensive error handling
 * @performance Optimized bill filtering and rendering
 */

import React, { memo } from 'react';
import { BillCard } from './BillCard';
import { BillEmptyState } from './BillEmptyState';
import { lazyLogger as logger } from '../../services/serviceFactory';
import type { Account, Category } from '../../types';
import type { Bill } from './types';

type BillTabId = 'upcoming' | 'overdue' | 'all' | 'history';

interface BillRendererProps {
  activeTab: BillTabId;
  upcomingBills: Bill[];
  overdueBills: Bill[];
  allBills: Bill[];
  accounts: Account[];
  categories: Category[];
  onPayBill: (billId: string) => void;
  onEditBill: (bill: Bill) => void;
  onToggleActive: (billId: string) => void;
  onDeleteBill: (billId: string) => void;
  onViewDetails: (billId: string) => void;
  onAddBill: () => void;
}

export const BillRenderer = memo(function BillRenderer({
  activeTab,
  upcomingBills,
  overdueBills,
  allBills,
  accounts,
  categories,
  onPayBill,
  onEditBill,
  onToggleActive,
  onDeleteBill,
  onViewDetails,
  onAddBill
}: BillRendererProps) {
  try {
    let billsToRender: Bill[] = [];
    
    switch (activeTab) {
      case 'upcoming':
        billsToRender = upcomingBills || [];
        break;
      case 'overdue':
        billsToRender = overdueBills || [];
        break;
      case 'all':
        billsToRender = allBills || [];
        break;
      default:
        return (
          <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
            Payment history feature coming soon
          </div>
        );
    }

    if (billsToRender.length === 0) {
      return <BillEmptyState 
        activeTab={activeTab} 
        onAddBill={onAddBill}
      />;
    }

    return billsToRender.map(bill => {
      try {
        if (!bill || !bill.id) {
          logger.warn('Invalid bill data encountered', { bill, componentName: 'BillRenderer' });
          return null;
        }
        
        return (
          <BillCard
            key={bill.id}
            bill={bill}
            accounts={accounts || []}
            categories={categories || []}
            onPay={(billId) => {
              try {
                logger.debug('Bill payment initiated', { billId, componentName: 'BillRenderer' });
                onPayBill(billId);
              } catch (error) {
                logger.error('Bill payment failed:', error, 'BillRenderer');
              }
            }}
            onEdit={(bill) => {
              try {
                logger.debug('Bill edit initiated', { billId: bill.id, componentName: 'BillRenderer' });
                onEditBill(bill);
              } catch (error) {
                logger.error('Bill edit failed:', error, 'BillRenderer');
              }
            }}
            onToggleActive={(billId) => {
              try {
                logger.debug('Bill toggle active initiated', { billId, componentName: 'BillRenderer' });
                onToggleActive(billId);
              } catch (error) {
                logger.error('Bill toggle active failed:', error, 'BillRenderer');
              }
            }}
            onDelete={(billId) => {
              try {
                logger.debug('Bill deletion initiated', { billId, componentName: 'BillRenderer' });
                onDeleteBill(billId);
              } catch (error) {
                logger.error('Bill deletion failed:', error, 'BillRenderer');
              }
            }}
            onViewDetails={(billId) => {
              try {
                logger.debug('Bill details view initiated', { billId, componentName: 'BillRenderer' });
                onViewDetails(billId);
              } catch (error) {
                logger.error('Bill details view failed:', error, 'BillRenderer');
              }
            }}
          />
        );
      } catch (error) {
        logger.error('Error rendering bill card:', error, 'BillRenderer');
        return (
          <div key={bill?.id || Math.random()} className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">Error loading bill</p>
          </div>
        );
      }
    }).filter(Boolean);
  } catch (error) {
    logger.error('Error in BillRenderer:', error, 'BillRenderer');
    return (
      <div className="col-span-full p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-sm text-red-600 dark:text-red-400">Error loading bills. Please refresh the page.</p>
      </div>
    );
  }
});
