import React, { useEffect, memo } from 'react';
import { CheckCircleIcon, AlertCircleIcon, InfoIcon } from '../icons';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import type { AssetAllocation } from '../../services/portfolioRebalanceService';
import type { PortfolioTarget } from '../../services/portfolioRebalanceService';
import { COLORS } from './AllocationChart';
import { logger } from '../../services/loggingService';

interface AllocationTableProps {
  allocations: AssetAllocation[];
  activeTarget: PortfolioTarget | null;
}

export const AllocationTable = memo(function AllocationTable({ 
  allocations, 
  activeTarget 
}: AllocationTableProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('AllocationTable component initialized', {
      componentName: 'AllocationTable'
    });
  }, []);

  const { formatCurrency } = useCurrencyDecimal();

  const getTargetPercent = (assetClass: string) => {
    if (!activeTarget) return null;
    const target = activeTarget.allocations.find(a => a.assetClass === assetClass);
    return target?.targetPercent || 0;
  };

  return (
    <div className="space-y-2">
      {allocations.map((alloc, index) => {
        const targetPercent = getTargetPercent(alloc.assetClass);
        const deviation = targetPercent ? Math.abs(alloc.currentPercent - targetPercent) : 0;
        const isOnTarget = deviation <= 2;

        return (
          <div key={alloc.assetClass} className="border-b dark:border-gray-700 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="font-medium">{alloc.assetClass}</span>
              </div>
              <div className="text-right">
                <p className="font-medium">
                  {formatCurrency(alloc.currentValue.toNumber())}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {alloc.currentPercent.toFixed(1)}%
                </p>
              </div>
            </div>
            
            {activeTarget && targetPercent !== null && (
              <div className="flex items-center justify-between mt-2 text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Target: {targetPercent}%
                </span>
                <span className={`flex items-center gap-1 ${
                  isOnTarget 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-orange-600 dark:text-orange-400'
                }`}>
                  {isOnTarget ? (
                    <><CheckCircleIcon size={16} /> On target</>
                  ) : (
                    <><AlertCircleIcon size={16} /> {deviation.toFixed(1)}% off</>
                  )}
                </span>
              </div>
            )}
          </div>
        );
      })}
      
      <div className="pt-2 border-t dark:border-gray-700">
        <div className="flex items-center justify-between font-semibold">
          <span>Total Value</span>
          <span>
            {formatCurrency(
              allocations.reduce((sum, a) => sum + a.currentValue.toNumber(), 0)
            )}
          </span>
        </div>
      </div>
    </div>
  );
});