import type { Account, Transaction, Budget } from '../types';

export interface DashboardMetrics {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlySavings: number;
  savingsRate: number;
  recentActivity: Transaction[];
  accountsNeedingAttention: Account[];
  budgetStatus: BudgetStatus[];
  totalBudgeted: number;
  totalSpentOnBudgets: number;
  overallBudgetPercent: number;
  netWorthChange: number;
  netWorthChangePercent: number;
}

export interface BudgetStatus extends Budget {
  spent: number;
  remaining: number;
  percentUsed: number;
  isOverBudget: boolean;
}

export interface NetWorthDataPoint {
  month: string;
  netWorth: number;
}

export interface PieDataPoint {
  id: string;
  name: string;
  value: number;
}

/**
 * Service for improved dashboard operations
 */
export class ImprovedDashboardService {
  /**
   * Chart colors
   */
  static readonly CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  /**
   * Calculate all dashboard metrics
   */
  static calculateMetrics(
    accounts: Account[],
    transactions: Transaction[],
    budgets: Budget[]
  ): DashboardMetrics {
    // Calculate assets and liabilities
    const totalAssets = accounts
      .filter(acc => acc.balance > 0)
      .reduce((sum, acc) => sum + acc.balance, 0);
    
    const totalLiabilities = accounts
      .filter(acc => acc.balance < 0)
      .reduce((sum, acc) => sum + Math.abs(acc.balance), 0);
    
    const netWorth = totalAssets - totalLiabilities;
    
    // Calculate monthly metrics (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentTransactions = transactions.filter(t => 
      new Date(t.date) >= thirtyDaysAgo
    );
    
    const monthlyIncome = recentTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const monthlyExpenses = recentTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const monthlySavings = monthlyIncome - monthlyExpenses;
    const savingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;
    
    // Get recent activity
    const recentActivity = transactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
    
    // Identify accounts needing attention
    const accountsNeedingAttention = this.identifyAccountsNeedingAttention(accounts);
    
    // Calculate budget status
    const { budgetStatus, totalBudgeted, totalSpentOnBudgets, overallBudgetPercent } = 
      this.calculateBudgetStatus(budgets, recentTransactions);
    
    return {
      netWorth,
      totalAssets,
      totalLiabilities,
      monthlyIncome,
      monthlyExpenses,
      monthlySavings,
      savingsRate,
      recentActivity,
      accountsNeedingAttention,
      budgetStatus,
      totalBudgeted,
      totalSpentOnBudgets,
      overallBudgetPercent,
      netWorthChange: 0, // Will be calculated from historical data
      netWorthChangePercent: 0 // Will be calculated from historical data
    };
  }

  /**
   * Identify accounts that need attention
   */
  static identifyAccountsNeedingAttention(accounts: Account[]): Account[] {
    return accounts.filter(acc => {
      // Check for low balances in checking/current accounts
      if ((acc.type === 'current' || acc.type === 'checking') && acc.balance < 500) {
        return true;
      }
      // Check for high credit utilization
      if (acc.type === 'credit' && acc.creditLimit) {
        const utilization = Math.abs(acc.balance) / acc.creditLimit;
        return utilization > 0.7;
      }
      return false;
    });
  }

  /**
   * Calculate budget status
   */
  static calculateBudgetStatus(
    budgets: Budget[],
    recentTransactions: Transaction[]
  ) {
    const activeBudgets = budgets.filter(b => b.isActive);
    
    const budgetStatus = activeBudgets.map(budget => {
      const categoryId = (budget as any).categoryId || (budget as any).category;
      const categoryTransactions = recentTransactions.filter(t => 
        t.category === categoryId && t.type === 'expense'
      );
      const spent = categoryTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const remaining = budget.amount - spent;
      const percentUsed = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
      
      return {
        ...budget,
        spent,
        remaining,
        percentUsed,
        isOverBudget: spent > budget.amount
      };
    });
    
    const totalBudgeted = activeBudgets.reduce((sum, b) => sum + b.amount, 0);
    const totalSpentOnBudgets = budgetStatus.reduce((sum, b) => sum + b.spent, 0);
    const overallBudgetPercent = totalBudgeted > 0 ? (totalSpentOnBudgets / totalBudgeted) * 100 : 0;
    
    return {
      budgetStatus,
      totalBudgeted,
      totalSpentOnBudgets,
      overallBudgetPercent
    };
  }

  /**
   * Generate net worth data for chart
   */
  static generateNetWorthData(netWorth: number): NetWorthDataPoint[] {
    const currentDate = new Date();
    const currentMonth = currentDate.toLocaleDateString('en-US', { 
      month: 'short', 
      year: 'numeric' 
    });
    
    // For now, only current data
    // Historical data will be added as it becomes available
    return [{
      month: currentMonth,
      netWorth
    }];
  }

  /**
   * Generate pie chart data for account distribution
   */
  static generatePieData(accounts: Account[]): PieDataPoint[] {
    return accounts
      .filter(acc => acc.balance > 0)
      .map(acc => ({
        id: acc.id,
        name: acc.name,
        value: acc.balance
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Top 5 accounts
  }

  /**
   * Get chart styles based on theme
   */
  static getChartStyles(isDarkMode: boolean) {
    return {
      tooltip: {
        backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        border: isDarkMode ? '1px solid #374151' : '1px solid #E5E7EB',
        borderRadius: '8px',
        color: isDarkMode ? '#E5E7EB' : '#111827'
      },
      pieTooltip: {
        backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        border: isDarkMode ? '1px solid #374151' : '1px solid #ccc',
        borderRadius: '8px',
        color: isDarkMode ? '#E5E7EB' : '#111827'
      }
    };
  }

  /**
   * Load saved account preferences
   */
  static loadSavedAccountPreferences(): string[] | null {
    const saved = localStorage.getItem('dashboardKeyAccounts');
    return saved ? JSON.parse(saved) : null;
  }

  /**
   * Save account preferences
   */
  static saveAccountPreferences(accountIds: string[]): void {
    localStorage.setItem('dashboardKeyAccounts', JSON.stringify(accountIds));
  }
}
