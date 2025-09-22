import { useMemo } from 'react';
import { useLogger } from '../services/ServiceProvider';

interface UseBalanceCalculationsProps {
  newBalance: string;
  currentBalance: number;
}

interface UseBalanceCalculationsReturn {
  newBalanceNum: number;
  difference: number;
  isIncrease: boolean;
}

/**
 * Custom hook for balance adjustment calculations
 * Handles parsing and computation with error handling
 */
export function useBalanceCalculations({
  newBalance,
  currentBalance
}: UseBalanceCalculationsProps): UseBalanceCalculationsReturn {
  const logger = useLogger();
  return useMemo(() => {
    try {
      const newBalanceNum = parseFloat(newBalance) || 0;
      const difference = newBalanceNum - currentBalance;
      const isIncrease = difference > 0;
      
      logger.debug('Balance calculations computed', {
        newBalanceNum,
        difference,
        isIncrease,
        componentName: 'useBalanceCalculations'
      });
      
      return { newBalanceNum, difference, isIncrease };
    } catch (error) {
      logger.error('Error calculating balance adjustments:', error);
      return { newBalanceNum: 0, difference: 0, isIncrease: false };
    }
  }, [newBalance, currentBalance]);
}