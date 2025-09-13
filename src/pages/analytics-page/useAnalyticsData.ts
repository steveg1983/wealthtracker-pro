import { useState, useEffect, useMemo, useCallback } from 'react';
import { analyticsEngine } from '../../services/analyticsEngine';
import { anomalyDetectionService } from '../../services/anomalyDetectionService';
import type { Transaction, Account, Category, Budget, Goal, Investment } from '../../types';
import type { Dashboard, SavedQuery, Insight, QueryResult, CategorySegment, KeyMetrics } from './types';
import { logger } from '../../services/loggingService';

/**
 * Custom hook for analytics data management
 * Handles dashboards, queries, insights, and metrics calculation
 */
export function useAnalyticsData(
  transactions: Transaction[],
  accounts: Account[],
  categories: Category[],
  budgets: Budget[],
  goals: Goal[],
  investments?: Investment[]
) {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [activeDashboard, setActiveDashboard] = useState<Dashboard | null>(null);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [selectedData, setSelectedData] = useState<QueryResult | null>(null);

  // Load saved data from localStorage
  useEffect(() => {
    const savedDashboards = localStorage.getItem('analytics_dashboards');
    if (savedDashboards) {
      try {
        setDashboards(JSON.parse(savedDashboards));
      } catch (error) {
        logger.error('Failed to load dashboards:', error);
      }
    }
    
    const savedQueriesData = localStorage.getItem('analytics_queries');
    if (savedQueriesData) {
      try {
        setSavedQueries(JSON.parse(savedQueriesData));
      } catch (error) {
        logger.error('Failed to load queries:', error);
      }
    }
  }, []);

  // Calculate key metrics
  const keyMetrics = useMemo<KeyMetrics>(() => {
    const totalIncome = transactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpenses = Math.abs(transactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + t.amount, 0));
    
    const savingsRate = totalIncome > 0 
      ? ((totalIncome - totalExpenses) / totalIncome) * 100 
      : 0;
    
    const transactionCount = transactions.length;
    
    const netWorth = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0) +
      (investments?.reduce((sum, inv) => sum + (inv.currentValue || 0), 0) || 0);
    
    const budgetUtilization = budgets.length > 0
      ? (budgets.reduce((sum, b) => sum + ((b.spent || 0) / (b.limit || b.amount || 1) * 100), 0) / budgets.length)
      : 0;
    
    return {
      totalIncome,
      totalExpenses,
      savingsRate,
      transactionCount,
      netWorth,
      budgetUtilization
    };
  }, [transactions, accounts, budgets, investments]);

  // Generate insights
  const generateInsights = useCallback(async () => {
    const newInsights: Insight[] = [];
    
    try {
      // Spending trends
      const spendingTrend = analyticsEngine.detectSeasonalPatterns(transactions, 'expenses');
      if (spendingTrend.direction !== 'stable') {
        newInsights.push({
          type: 'trend',
          title: `Spending is ${spendingTrend.direction}`,
          description: `Your spending has ${spendingTrend.direction === 'increasing' ? 'increased' : 'decreased'} by ${Math.abs(spendingTrend.changeRate * 100).toFixed(1)}% over the last 30 days`,
          severity: spendingTrend.direction === 'increasing' ? 'warning' : 'success'
        });
      }
      
      // Category analysis
      const categoryAnalysis = analyticsEngine.performCohortAnalysis(transactions, accounts, 'category', 'value');
      const topCategory = categoryAnalysis.length > 0 ? categoryAnalysis[0] : null;
      
      if (topCategory) {
        const totalValue = topCategory.periods.reduce((sum, p) => sum + p.value, 0);
        newInsights.push({
          type: 'category',
          title: `Highest spending category: ${topCategory.cohort}`,
          description: `You've spent ${Math.abs(totalValue).toFixed(2)} in ${topCategory.cohort} this month`,
          severity: 'info'
        });
      }
      
      // Anomaly detection
      const anomalies = await anomalyDetectionService.detectAnomalies(transactions, categories);
      anomalies.slice(0, 3).forEach((anomaly: any) => {
        newInsights.push({
          type: 'anomaly',
          title: anomaly.message,
          description: anomaly.description || 'Unusual activity detected',
          severity: anomaly.severity as Insight['severity'],
          data: anomaly
        });
      });
      
      // Budget alerts
      budgets.forEach(budget => {
        const utilizationRate = (budget.spent || 0) / (budget.limit || budget.amount || 1) * 100;
        if (utilizationRate > 90) {
          newInsights.push({
            type: 'budget',
            title: `Budget Alert: ${budget.name || 'Unnamed'}`,
            description: `You've used ${utilizationRate.toFixed(0)}% of your budget`,
            severity: utilizationRate >= 100 ? 'error' : 'warning'
          });
        }
      });
      
      // Goal progress
      goals.forEach(goal => {
        const progress = (goal.currentAmount / goal.targetAmount) * 100;
        if (progress >= 90 && progress < 100) {
          newInsights.push({
            type: 'goal',
            title: `Almost there! ${goal.name}`,
            description: `You're ${progress.toFixed(0)}% of the way to your goal`,
            severity: 'success'
          });
        }
      });
      
      setInsights(newInsights);
    } catch (error) {
      logger.error('Failed to generate insights:', error);
    }
  }, [transactions, budgets, goals]);

  useEffect(() => {
    generateInsights();
  }, [generateInsights]);

  // Dashboard operations
  const handleSaveDashboard = useCallback((dashboard: Dashboard) => {
    const updated = dashboards.map(d => d.id === dashboard.id ? dashboard : d);
    if (!dashboards.find(d => d.id === dashboard.id)) {
      updated.push(dashboard);
    }
    setDashboards(updated);
    localStorage.setItem('analytics_dashboards', JSON.stringify(updated));
  }, [dashboards]);

  const handleDeleteDashboard = useCallback((id: string) => {
    const updated = dashboards.filter(d => d.id !== id);
    setDashboards(updated);
    localStorage.setItem('analytics_dashboards', JSON.stringify(updated));
  }, [dashboards]);

  // Query operations
  const handleSaveQuery = useCallback((query: SavedQuery) => {
    const updated = [...savedQueries, query];
    setSavedQueries(updated);
    localStorage.setItem('analytics_queries', JSON.stringify(updated));
  }, [savedQueries]);

  const handleRunQuery = useCallback(async (query: SavedQuery) => {
    // Implementation would execute the query
    logger.info('Running query:', query);
    return null;
  }, []);

  return {
    dashboards,
    activeDashboard,
    setActiveDashboard,
    savedQueries,
    insights,
    selectedData,
    setSelectedData,
    keyMetrics,
    handleSaveDashboard,
    handleDeleteDashboard,
    handleSaveQuery,
    handleRunQuery
  };
}