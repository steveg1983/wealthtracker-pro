import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useUser } from '@clerk/clerk-react';
import { investmentService, type PortfolioSummary } from '../services/api/investmentService';
import { logger } from '../services/loggingService';

export type InvestmentTab = 'overview' | 'watchlist' | 'portfolio' | 'optimize' | 'manage';
export type PeriodType = '1M' | '3M' | '6M' | '1Y' | 'ALL';

export function useInvestments() {
  const { accounts, transactions, updateAccount } = useApp();
  const { user } = useUser();
  
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('1Y');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [showAddInvestmentModal, setShowAddInvestmentModal] = useState(false);
  const [activeTab, setActiveTab] = useState<InvestmentTab>('overview');
  const [managingAccountId, setManagingAccountId] = useState<string | null>(null);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load portfolio data from investment service
  useEffect(() => {
    if (user?.id) {
      loadPortfolioData();
      
      // Start real-time price updates
      investmentService.startPriceUpdates(user.id, 60000); // Update every minute
      
      return () => {
        investmentService.stopPriceUpdates();
      };
    }
  }, [user?.id, selectedAccountId]);

  const loadPortfolioData = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const summary = await investmentService.getPortfolioSummary(user.id, selectedAccountId || undefined);
      setPortfolioSummary(summary);
      
      // Migrate from localStorage if needed
      await investmentService.migrateFromLocalStorage(user.id);
    } catch (error) {
      logger.error('Failed to load portfolio data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to format percentages
  const formatPercentage = useCallback((value: number): string => {
    return new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value) + '%';
  }, []);

  // Get investment accounts only
  const investmentAccounts = accounts.filter(acc => acc.type === 'investment');
  
  // Use portfolio summary from investment service if available, otherwise fall back to calculated values
  const portfolioValue = portfolioSummary?.totalValue || investmentAccounts.reduce((sum, acc) => sum + acc.balance, 0);
  const totalInvested = portfolioSummary?.totalCost || 0;
  const totalReturn = portfolioSummary?.totalGainLoss || (portfolioValue - totalInvested);
  const returnPercentage = portfolioSummary?.totalGainLossPercent || (totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0);
  
  // Get investment transactions for chart data
  const investmentTransactions = transactions.filter(t => 
    t.category?.toLowerCase().includes('invest') || 
    investmentAccounts.some(acc => t.accountId === acc.id)
  );

  // Create holdings data from portfolio summary or investment accounts
  const holdings = portfolioSummary?.investments.map((inv) => ({
    name: inv.name,
    value: inv.marketValue || 0,
    allocation: portfolioValue > 0 ? ((inv.marketValue || 0) / portfolioValue) * 100 : 0,
    return: inv.costBasis > 0 ? (((inv.marketValue || 0) - inv.costBasis) / inv.costBasis) * 100 : 0,
    ticker: inv.symbol || 'N/A'
  })) || investmentAccounts.map((acc) => {
    const numericBalance = typeof acc.balance === 'string' ? parseFloat(acc.balance) : acc.balance;
    return {
      name: acc.name,
      value: numericBalance,
      allocation: portfolioValue > 0 ? (numericBalance / portfolioValue) * 100 : 0,
      return: 0,
      ticker: acc.institution || 'N/A'
    };
  });

  // Create performance data based on transactions
  const generatePerformanceData = useCallback(() => {
    const data: Array<{ month: string; value: number }> = [];
    const today = new Date();
    let periodMonths = 12; // Default to 1Y
    
    // Adjust period based on selection
    switch (selectedPeriod) {
      case '1M': periodMonths = 1; break;
      case '3M': periodMonths = 3; break;
      case '6M': periodMonths = 6; break;
      case '1Y': periodMonths = 12; break;
      case 'ALL': {
        // Find earliest transaction date
        const earliestDate = investmentTransactions.reduce((earliest, t) => {
          const tDate = new Date(t.date);
          return tDate < earliest ? tDate : earliest;
        }, new Date());
        periodMonths = Math.max(12, Math.ceil((today.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24 * 30)));
        break;
      }
    }
    
    let cumulativeValue = 0;
    
    for (let i = periodMonths - 1; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      
      // Get all transactions up to this month
      const transactionsUpToDate = investmentTransactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate <= new Date(date.getFullYear(), date.getMonth() + 1, 0);
      });
      
      // Calculate cumulative invested amount
      const totalInvestedUpToDate = transactionsUpToDate
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
        
      const totalWithdrawnUpToDate = transactionsUpToDate
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      
      cumulativeValue = totalInvestedUpToDate - totalWithdrawnUpToDate;
      
      // For the current month, use actual portfolio value
      if (i === 0) {
        cumulativeValue = portfolioValue;
      } else {
        // Add some simulated growth for historical data (since we don't have actual historical values)
        const monthsFromNow = i;
        const estimatedGrowthRate = returnPercentage > 0 ? (returnPercentage / 100) / 12 : 0;
        cumulativeValue = cumulativeValue * (1 + (estimatedGrowthRate * monthsFromNow));
      }
      
      data.push({
        month: date.toLocaleString('default', { month: 'short' }),
        value: Math.max(0, cumulativeValue)
      });
    }
    
    return data;
  }, [selectedPeriod, investmentTransactions, portfolioValue, returnPercentage]);

  const performanceData = generatePerformanceData();

  // Handle portfolio management
  const handleManagePortfolio = useCallback((accountId: string) => {
    setManagingAccountId(accountId);
    setActiveTab('manage');
  }, []);

  return {
    // State
    investmentAccounts,
    portfolioSummary,
    isLoading,
    selectedPeriod,
    setSelectedPeriod,
    selectedAccountId,
    setSelectedAccountId,
    showAddInvestmentModal,
    setShowAddInvestmentModal,
    activeTab,
    setActiveTab,
    managingAccountId,
    setManagingAccountId,
    
    // Computed values
    portfolioValue,
    totalInvested,
    totalReturn,
    returnPercentage,
    holdings,
    performanceData,
    investmentTransactions,
    
    // Actions
    formatPercentage,
    loadPortfolioData,
    handleManagePortfolio,
    updateAccount
  };
}