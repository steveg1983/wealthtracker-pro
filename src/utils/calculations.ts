/**
 * Calculations Utilities
 * Re-exports from modularized calculations
 * Original file: 679 lines → Now: 97 lines (86% reduction)
 * 
 * @deprecated These calculation functions are deprecated. Use calculations-decimal.ts instead.
 * 
 * Backward-compatible calculation functions that work with number types
 * These wrap the decimal calculation functions for components not yet migrated
 * 
 * Migration guide:
 * 1. Import from './calculations-decimal' instead of './calculations'
 * 2. Use getDecimalAccounts(), getDecimalTransactions() etc. from AppContext
 * 3. Use useCurrencyDecimal() hook instead of useCurrency()
 */

// Re-export everything from modularized calculations
export {
  // Core calculations
  calculateTotalIncome,
  calculateTotalExpenses,
  calculateNetIncome,
  calculateAccountBalance,
  calculateTotalBalance,
  calculateNetWorth,
  calculateSavingsRate,
  calculateSavingsRateFromAmounts,
  calculateDebtToIncomeRatio,
  calculateInvestmentReturn,
  calculateCompoundInterest,
  calculateAverageTransactionAmount,
  calculateAverageSpending,
  calculateGrowthRate,
  
  // Budget calculations
  calculateBudgetPercentage,
  calculateBudgetVariance,
  calculateBudgetSpending,
  calculateBudgetRemaining,
  calculateBudgetUsage,
  calculateBudgetProgress,
  allocateBudget,
  calculateBudgetEfficiency,
  getBudgetRecommendations,
  
  // Goal calculations
  calculateGoalProgress,
  calculateMonthsToGoal,
  calculateRequiredMonthlySavings,
  calculateProjectedSavings,
  calculateEmergencyFundCoverage,
  calculateRetirementReadiness,
  calculateFIRENumber,
  calculateYearsToFI,
  
  // Cash flow calculations
  calculateCashFlow,
  calculateBalanceHistory,
  calculateMonthlyTrends,
  calculateCategoryTrends,
  calculateBurnRate,
  calculateRunway,
  calculateSeasonalPatterns,
  
  // Transaction helpers
  getTransactionsByCategory,
  getTransactionsByDateRange,
  getTransactionsByType,
  getTransactionsByAccount,
  getRecentTransactions,
  getTopSpendingCategories,
  getDuplicateTransactions,
  groupTransactionsByPeriod,
  getCategoryDisplayPath,
  filterTransactionsBySearch,
  sortTransactions,
  
  // Icon helpers
  getCategoryIcon,
  getAccountTypeIcon,
  getTransactionTypeIcon,
  getBudgetStatusIcon,
  getGoalStatusIcon,
  getTrendIcon,
  getCurrencySymbol,
  getAllCategoryIcons,
  getAllAccountTypeIcons
} from './calculations/index';

// Re-export all types
export type {
  CashFlowResult,
  BudgetProgressResult,
  ProjectedSavingsResult,
  EmergencyFundResult,
  InvestmentReturnResult,
  MonthlyTrendData,
  CategoryTrendData,
  BalanceHistoryData,
  IconMap
} from './calculations/index';
