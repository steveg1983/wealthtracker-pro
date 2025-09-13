import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from './useCurrencyDecimal';
import { enhancedInvestmentsService, type TabId, type InvestmentMetrics } from '../services/enhancedInvestmentsService';

export function useEnhancedInvestments() {
  const { accounts, investments = [], transactions } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  
  const [activeTab, setActiveTab] = useState<TabId>('allocation-analysis');
  const [metrics, setMetrics] = useState<InvestmentMetrics>({
    rebalancingSuggestions: [],
    riskMetrics: null,
    dividendInfo: [],
    esgScores: [],
    benchmarkData: null,
    insights: []
  });

  useEffect(() => {
    if (investments && investments.length > 0) {
      const calculatedMetrics = enhancedInvestmentsService.calculateAllMetrics(
        investments, 
        transactions
      );
      setMetrics(calculatedMetrics);
    }
  }, [investments, transactions]);

  const getTabs = useCallback(() => {
    return enhancedInvestmentsService.getTabs();
  }, []);

  const getTabButtonClass = useCallback((isActive: boolean) => {
    return enhancedInvestmentsService.getTabButtonClass(isActive);
  }, []);

  const getRiskLevelClass = useCallback((risk: 'high' | 'medium' | 'low') => {
    return enhancedInvestmentsService.getRiskLevelClass(risk);
  }, []);

  const getActionClass = useCallback((action: 'buy' | 'sell') => {
    return enhancedInvestmentsService.getActionClass(action);
  }, []);

  const getESGRatingClass = useCallback((rating: string) => {
    return enhancedInvestmentsService.getESGRatingClass(rating);
  }, []);

  const getReturnColorClass = useCallback((value: number) => {
    return enhancedInvestmentsService.getReturnColorClass(value);
  }, []);

  return {
    // State
    activeTab,
    setActiveTab,
    ...metrics,
    
    // Data
    accounts,
    investments,
    transactions,
    
    // Utilities
    formatCurrency,
    getTabs,
    getTabButtonClass,
    getRiskLevelClass,
    getActionClass,
    getESGRatingClass,
    getReturnColorClass
  };
}