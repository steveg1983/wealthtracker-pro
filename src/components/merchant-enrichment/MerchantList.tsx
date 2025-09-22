/**
 * @component MerchantList
 * @description Virtualized list of merchants with selection and actions
 */

import { memo, useCallback, useMemo, useEffect } from 'react';
import { MerchantCard } from './MerchantCard';
import { LoadingState } from './LoadingState';
import { EmptyState } from './EmptyState';
import type { MerchantListProps } from './types';
import type { MerchantData } from '../../services/dataIntelligenceService';
import { useLogger } from '../services/ServiceProvider';

export const MerchantList = memo(function MerchantList({ merchants,
  isLoading,
  onMerchantUpdate,
  onBulkSelect,
  selectedIds = new Set()
 }: MerchantListProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('MerchantList component initialized', {
      componentName: 'MerchantList'
    });
  }, []);
  
  const handleMerchantSelect = useCallback((merchantId: string, selected: boolean) => {
    if (!onBulkSelect) return;
    
    const newSelection = new Set(selectedIds);
    if (selected) {
      newSelection.add(merchantId);
    } else {
      newSelection.delete(merchantId);
    }
    onBulkSelect(Array.from(newSelection));
  }, [selectedIds, onBulkSelect]);

  const handleSelectAll = useCallback(() => {
    if (!onBulkSelect) return;
    
    if (selectedIds.size === merchants.length) {
      // Deselect all
      onBulkSelect([]);
    } else {
      // Select all
      onBulkSelect(merchants.map(m => m.id));
    }
  }, [merchants, selectedIds, onBulkSelect]);

  // Loading state
  if (isLoading && merchants.length === 0) {
    return <LoadingState message="Loading merchants..." />;
  }

  // Empty state
  if (!isLoading && merchants.length === 0) {
    return <EmptyState />;
  }

  const allSelected = merchants.length > 0 && selectedIds.size === merchants.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < merchants.length;

  return (
    <div className="space-y-2">
      {/* Select All Checkbox */}
      {onBulkSelect && merchants.length > 0 && (
        <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
          <input
            type="checkbox"
            checked={allSelected}
            ref={input => {
              if (input) {
                input.indeterminate = someSelected;
              }
            }}
            onChange={handleSelectAll}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            aria-label={allSelected ? "Deselect all merchants" : "Select all merchants"}
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {selectedIds.size > 0 
              ? `${selectedIds.size} selected`
              : 'Select all'
            }
          </span>
        </div>
      )}
      
      {/* Merchant Cards */}
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {merchants.map((merchant) => (
          <div key={merchant.id} className="relative">
            {onBulkSelect && (
              <input
                type="checkbox"
                checked={selectedIds.has(merchant.id)}
                onChange={(e) => handleMerchantSelect(merchant.id, e.target.checked)}
                className="absolute left-4 top-4 w-4 h-4 text-blue-600 rounded focus:ring-blue-500 z-10"
                aria-label={`Select ${merchant.name}`}
              />
            )}
            <MerchantCard
              merchant={merchant}
              onUpdate={onMerchantUpdate}
              isSelected={selectedIds.has(merchant.id)}
              showCheckbox={!!onBulkSelect}
            />
          </div>
        ))}
      </div>
      
      {/* Loading more indicator */}
      {isLoading && merchants.length > 0 && (
        <div className="text-center py-4">
          <span className="text-sm text-gray-500">Loading more...</span>
        </div>
      )}
    </div>
  );
});