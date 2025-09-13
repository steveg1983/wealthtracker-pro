import { useState, useMemo } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { toDecimal } from '../../utils/decimal';
import { calculateBudgetSpending, calculateBudgetRemaining } from '../../utils/calculations-decimal';
import type { 
  RolloverSettings, 
  RolloverHistory,
  BudgetRolloverData
} from './types';
import { DEFAULT_ROLLOVER_SETTINGS } from './types';

export function useBudgetRollover() {
  const { budgets, transactions, categories, updateBudget } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const [rolloverSettings, setRolloverSettings] = useLocalStorage<RolloverSettings>(
    'budgetRolloverSettings',
    DEFAULT_ROLLOVER_SETTINGS
  );
  const [rolloverHistory, setRolloverHistory] = useLocalStorage<RolloverHistory[]>(
    'budgetRolloverHistory', 
    []
  );
  const [showSettings, setShowSettings] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Current month info
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  // Previous month info
  const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  
  // Calculate rollover data for each budget
  const rolloverData = useMemo((): BudgetRolloverData[] => {
    const startDate = new Date(previousYear, previousMonth, 1);
    const endDate = new Date(previousYear, previousMonth + 1, 0, 23, 59, 59, 999);
    
    return budgets.map(budget => {
      const decimalBudget = {
        ...budget,
        amount: toDecimal(budget.amount)
      };
      
      // Convert transactions to decimal for calculations
      const decimalTransactions = transactions.map(t => ({
        ...t,
        amount: toDecimal(t.amount)
      }));
      
      // Calculate spending for this budget's category
      const spent = decimalTransactions
        .filter(t => 
          t.type === 'expense' && 
          t.category === budget.categoryId &&
          t.date >= startDate &&
          t.date <= endDate
        )
        .reduce((sum, t) => sum.plus(t.amount), toDecimal(0));
      
      const remaining = decimalBudget.amount.minus(spent);
      
      // Calculate rollover amount based on settings
      let rolloverAmount = toDecimal(0);
      
      if (rolloverSettings.enabled && !rolloverSettings.excludeCategories.includes(budget.categoryId)) {
        if (remaining.greaterThan(0) || (remaining.lessThan(0) && rolloverSettings.carryNegative)) {
          switch (rolloverSettings.mode) {
            case 'all':
              rolloverAmount = remaining;
              break;
            case 'percentage':
              rolloverAmount = remaining.times(rolloverSettings.percentage / 100);
              break;
            case 'fixed':
              rolloverAmount = remaining.greaterThan(0) ? remaining : toDecimal(0);
              break;
          }
          
          // Apply max cap if set
          if (rolloverSettings.maxAmount && rolloverAmount.greaterThan(rolloverSettings.maxAmount)) {
            rolloverAmount = toDecimal(rolloverSettings.maxAmount);
          }
        }
      }
      
      return {
        budgetId: budget.id,
        category: budget.categoryId,
        originalBudget: decimalBudget.amount,
        spent,
        remaining,
        rolloverAmount,
        isEligible: rolloverSettings.enabled && !rolloverSettings.excludeCategories.includes(budget.categoryId),
        willRollover: rolloverAmount.abs().greaterThan(0)
      };
    }).filter(Boolean) as BudgetRolloverData[];
  }, [budgets, transactions, previousMonth, previousYear, rolloverSettings]);

  const totalRollover = rolloverData.reduce((sum, data) => 
    data ? sum.plus(data.rolloverAmount) : sum, toDecimal(0)
  );

  const eligibleBudgets = rolloverData.filter(data => data?.isEligible).length;
  const budgetsWithSurplus = rolloverData.filter(data => data?.remaining.greaterThan(0)).length;
  const budgetsWithDeficit = rolloverData.filter(data => data?.remaining.lessThan(0)).length;

  const applyRollover = () => {
    const rollovers = rolloverData
      .filter(data => data?.willRollover)
      .map(data => {
        if (!data) return null;
        
        // Update budget with rollover
        const currentBudget = budgets.find(b => b.id === data.budgetId);
        if (currentBudget) {
          const newAmount = toDecimal(currentBudget.amount).plus(data.rolloverAmount).toNumber();
          updateBudget(data.budgetId, { amount: newAmount });
        }
        
        return {
          budgetId: data.budgetId,
          category: data.category,
          originalBudget: data.originalBudget,
          spent: data.spent,
          remaining: data.remaining,
          rolledOver: data.rolloverAmount
        };
      })
      .filter(Boolean);

    // Save to history
    const historyEntry: RolloverHistory = {
      id: Date.now().toString(),
      fromPeriod: { month: previousMonth, year: previousYear },
      toPeriod: { month: currentMonth, year: currentYear },
      rollovers: rollovers as any,
      totalRolledOver: totalRollover,
      appliedAt: new Date()
    };
    
    setRolloverHistory([historyEntry, ...rolloverHistory]);
    setShowPreview(false);
  };

  const getMonthName = (month: number) => {
    return new Date(2000, month).toLocaleString('default', { month: 'long' });
  };

  return {
    rolloverSettings,
    setRolloverSettings,
    rolloverHistory,
    showSettings,
    setShowSettings,
    showPreview,
    setShowPreview,
    rolloverData,
    totalRollover,
    eligibleBudgets,
    budgetsWithSurplus,
    budgetsWithDeficit,
    applyRollover,
    getMonthName,
    formatCurrency,
    previousMonth,
    previousYear,
    currentMonth,
    currentYear,
    budgets,
    categories
  };
}