import { useState, useEffect, useCallback } from 'react';
import { dataIntelligenceService } from '../services/dataIntelligenceService';
import type { 
  DataIntelligenceStats, 
  SpendingInsight, 
  Subscription 
} from '../services/dataIntelligenceService';
import type { Transaction } from '../types';
import { logger } from '../services/loggingService';

export function useDataIntelligence(transactions?: Transaction[]) {
  const [stats, setStats] = useState<DataIntelligenceStats | null>(null);
  const [insights, setInsights] = useState<SpendingInsight[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [detectedSubscriptions, setDetectedSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      setStats(dataIntelligenceService.getStats());
      setInsights(dataIntelligenceService.getInsights());
      setSubscriptions(dataIntelligenceService.getSubscriptions());
    } catch (error) {
      logger.error('Error loading data intelligence data:', error, 'useDataIntelligence');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const analyzeTransactions = useCallback(async () => {
    if (!transactions || transactions.length === 0) return;
    
    try {
      // Learn from actual transactions
      transactions.forEach(transaction => {
        dataIntelligenceService.learnMerchantFromTransaction(transaction);
      });
      
      // Detect subscriptions from real transactions
      const detected = dataIntelligenceService.detectSubscriptions(transactions);
      setDetectedSubscriptions(detected);
      
      // Analyze spending patterns
      dataIntelligenceService.analyzeSpendingPatterns(transactions);
      
      // Generate insights
      const newInsights = dataIntelligenceService.generateInsights(transactions);
      setInsights(newInsights);
      
      // Update stats
      setStats(dataIntelligenceService.getStats());
    } catch (error) {
      logger.error('Error analyzing transactions:', error, 'useDataIntelligence');
    }
  }, [transactions]);

  const runAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    try {
      await analyzeTransactions();
    } finally {
      setIsAnalyzing(false);
    }
  }, [analyzeTransactions]);

  // Initial data load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Analyze transactions when they change
  useEffect(() => {
    if (transactions && transactions.length > 0) {
      analyzeTransactions();
    }
  }, [transactions, analyzeTransactions]);

  return {
    stats,
    insights,
    subscriptions,
    detectedSubscriptions,
    isLoading,
    isAnalyzing,
    loadData,
    runAnalysis
  };
}