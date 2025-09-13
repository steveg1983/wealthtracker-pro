import { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { logger } from '../services/loggingService';
import { 
  dataIntelligencePageService,
  type ActiveTab,
  type SubscriptionWithDays
} from '../services/dataIntelligencePageService';
import type { DataIntelligenceStats, SpendingInsight, Subscription } from '../services/dataIntelligenceService';

export function useDataIntelligencePage() {
  const { transactions } = useApp();
  
  // State
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [stats, setStats] = useState<DataIntelligenceStats | null>(null);
  const [insights, setInsights] = useState<SpendingInsight[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [detectedSubscriptions, setDetectedSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Load initial data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await dataIntelligencePageService.loadInitialData();
      setStats(data.stats);
      setInsights(data.insights);
      setSubscriptions(data.subscriptions);
    } catch (error) {
      logger.error('Error loading data intelligence:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Analyze transactions
  const analyzeTransactions = useCallback(async () => {
    if (!transactions || transactions.length === 0) return;
    
    try {
      const result = await dataIntelligencePageService.analyzeTransactions(transactions);
      setDetectedSubscriptions(result.detectedSubscriptions);
      setInsights(result.insights);
      setStats(result.stats);
    } catch (error) {
      logger.error('Error analyzing transactions:', error);
    }
  }, [transactions]);

  // Run analysis manually
  const handleRunAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    try {
      await analyzeTransactions();
      await loadData();
    } catch (error) {
      logger.error('Error running analysis:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [analyzeTransactions, loadData]);

  // Handle data change from child components
  const handleDataChange = useCallback(() => {
    loadData();
  }, [loadData]);

  // Effects
  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (transactions && transactions.length > 0) {
      analyzeTransactions();
    }
  }, [transactions, analyzeTransactions]);

  // Computed values
  const hasTransactions = useMemo(
    () => dataIntelligencePageService.hasTransactions(transactions),
    [transactions]
  );

  const tabConfigs = useMemo(
    () => dataIntelligencePageService.getTabConfigs(insights.length),
    [insights.length]
  );

  const activeSubscriptionsCount = useMemo(
    () => dataIntelligencePageService.getActiveSubscriptionsCount(subscriptions, detectedSubscriptions),
    [subscriptions, detectedSubscriptions]
  );

  const allSubscriptions = useMemo(
    () => dataIntelligencePageService.processSubscriptionsForDisplay(subscriptions, detectedSubscriptions),
    [subscriptions, detectedSubscriptions]
  );

  const upcomingRenewals = useMemo(
    () => allSubscriptions.slice(0, 3),
    [allSubscriptions]
  );

  const recentInsights = useMemo(
    () => insights.slice(0, 3),
    [insights]
  );

  // Utilities
  const formatCurrency = useCallback((amount: number) => 
    dataIntelligencePageService.formatCurrency(amount), []);
  
  const formatDate = useCallback((date: Date) => 
    dataIntelligencePageService.formatDate(date), []);
  
  const getInsightSeverityColor = useCallback((severity: SpendingInsight['severity']) => 
    dataIntelligencePageService.getInsightSeverityColor(severity), []);
  
  const getInsightIconData = useCallback((type: SpendingInsight['type']) => 
    dataIntelligencePageService.getInsightIconData(type), []);
  
  const getRenewalStatusColor = useCallback((days: number) => 
    dataIntelligencePageService.getRenewalStatusColor(days), []);
  
  const getTabClassName = useCallback((isActive: boolean) => 
    dataIntelligencePageService.getTabClassName(isActive), []);

  return {
    // State
    activeTab,
    stats,
    insights,
    subscriptions,
    detectedSubscriptions,
    isLoading,
    isAnalyzing,
    
    // Computed
    hasTransactions,
    tabConfigs,
    activeSubscriptionsCount,
    allSubscriptions,
    upcomingRenewals,
    recentInsights,
    
    // Handlers
    setActiveTab,
    handleRunAnalysis,
    handleDataChange,
    
    // Utilities
    formatCurrency,
    formatDate,
    getInsightSeverityColor,
    getInsightIconData,
    getRenewalStatusColor,
    getTabClassName
  };
}