/**
 * Custom Hook for Advanced Analytics
 * Manages analytics data fetching and state
 */

import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { advancedAnalyticsService } from '../services/advancedAnalyticsService';
import { advancedAnalyticsComponentService } from '../services/advancedAnalyticsComponentService';
import type { SpendingAnomaly, SpendingPrediction, SavingsOpportunity, FinancialInsight } from '../services/advancedAnalyticsService';
import type { TabType } from '../services/advancedAnalyticsComponentService';

export interface UseAdvancedAnalyticsReturn {
  activeTab: TabType;
  anomalies: SpendingAnomaly[];
  predictions: SpendingPrediction[];
  opportunities: SavingsOpportunity[];
  insights: FinancialInsight[];
  isAnalyzing: boolean;
  hasMinimumData: boolean;
  setActiveTab: (tab: TabType) => void;
  refreshAnalytics: () => void;
}

export function useAdvancedAnalytics(): UseAdvancedAnalyticsReturn {
  const { transactions, accounts, budgets, categories } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>('insights');
  const [anomalies, setAnomalies] = useState<SpendingAnomaly[]>([]);
  const [predictions, setPredictions] = useState<SpendingPrediction[]>([]);
  const [opportunities, setOpportunities] = useState<SavingsOpportunity[]>([]);
  const [insights, setInsights] = useState<FinancialInsight[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const hasMinimumData = advancedAnalyticsComponentService.hasMinimumData(transactions.length);

  const analyzeData = useCallback(async () => {
    if (!hasMinimumData) {
      // Clear all data if not enough transactions
      setAnomalies([]);
      setPredictions([]);
      setOpportunities([]);
      setInsights([]);
      return;
    }

    setIsAnalyzing(true);
    
    try {
      // Run all analyses in parallel
      const [
        detectedAnomalies,
        spendingPredictions,
        savingsOpportunities,
        financialInsights
      ] = await Promise.all([
        Promise.resolve(advancedAnalyticsService.detectSpendingAnomalies(transactions)),
        Promise.resolve(advancedAnalyticsService.predictSpending(transactions)),
        Promise.resolve(advancedAnalyticsService.identifySavingsOpportunities(transactions, accounts)),
        Promise.resolve(advancedAnalyticsService.generateInsights(transactions, accounts, budgets))
      ]);
      
      // Sort and set data
      setAnomalies(advancedAnalyticsComponentService.sortAnomalies(detectedAnomalies));
      setPredictions(advancedAnalyticsComponentService.sortPredictions(spendingPredictions));
      setOpportunities(advancedAnalyticsComponentService.sortOpportunities(savingsOpportunities));
      setInsights(advancedAnalyticsComponentService.sortInsights(financialInsights));
    } catch (error) {
      console.error('Error analyzing data:', error);
      // Reset to empty state on error
      setAnomalies([]);
      setPredictions([]);
      setOpportunities([]);
      setInsights([]);
    } finally {
      setIsAnalyzing(false);
    }
  }, [transactions, accounts, budgets, categories, hasMinimumData]);

  // Analyze on mount and when dependencies change
  useEffect(() => {
    analyzeData();
  }, [analyzeData]);

  // Manual refresh function
  const refreshAnalytics = useCallback(() => {
    analyzeData();
  }, [analyzeData]);

  return {
    activeTab,
    anomalies,
    predictions,
    opportunities,
    insights,
    isAnalyzing,
    hasMinimumData,
    setActiveTab,
    refreshAnalytics
  };
}
