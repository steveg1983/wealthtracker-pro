/**
 * Calculations Module
 * Comprehensive financial calculation utilities
 */

// Core calculations
export {
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
  calculateGrowthRate
} from './coreCalculations';

// Budget calculations
export {
  calculateBudgetPercentage,
  calculateBudgetVariance,
  calculateBudgetSpending,
  calculateBudgetRemaining,
  calculateBudgetUsage,
  calculateBudgetProgress,
  allocateBudget,
  calculateBudgetEfficiency,
  getBudgetRecommendations
} from './budgetCalculations';

// Goal calculations
export {
  calculateGoalProgress,
  calculateMonthsToGoal,
  calculateRequiredMonthlySavings,
  calculateProjectedSavings,
  calculateEmergencyFundCoverage,
  calculateRetirementReadiness,
  calculateFIRENumber,
  calculateYearsToFI
} from './goalCalculations';

// Cash flow calculations
export {
  calculateCashFlow,
  calculateBalanceHistory,
  calculateMonthlyTrends,
  calculateCategoryTrends,
  calculateBurnRate,
  calculateRunway,
  calculateSeasonalPatterns
} from './cashFlowCalculations';

// Transaction helpers
export {
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
  sortTransactions
} from './transactionHelpers';

// Icon helpers
export {
  getCategoryIcon,
  getAccountTypeIcon,
  getTransactionTypeIcon,
  getBudgetStatusIcon,
  getGoalStatusIcon,
  getTrendIcon,
  getCurrencySymbol,
  getAllCategoryIcons,
  getAllAccountTypeIcons
} from './iconHelpers';

// Types
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
} from './types';