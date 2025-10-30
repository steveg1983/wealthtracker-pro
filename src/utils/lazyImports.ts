import { lazy } from 'react';

// Heavy page components - lazy load these
export const Transactions = lazy(() => import('../pages/Transactions'));
export const Reconciliation = lazy(() => import('../pages/Reconciliation'));
export const Analytics = lazy(() => import('../pages/Analytics'));
export const Investments = lazy(() => import('../pages/Investments'));
export const Budget = lazy(() => import('../pages/Budget'));
export const Goals = lazy(() => import('../pages/Goals'));
export const Reports = lazy(() => import('../pages/Reports'));
export const Settings = lazy(() => import('../pages/Settings'));

// Heavy modals - lazy load on demand
export const ImportDataModal = lazy(() => import('../components/ImportDataModal'));
export const CSVImportWizard = lazy(() => import('../components/CSVImportWizard'));
export const BatchImportModal = lazy(() => import('../components/BatchImportModal'));
export const GoalModal = lazy(() => import('../components/GoalModal'));
export const BudgetModal = lazy(() => import('../components/BudgetModal'));
export const RecurringTransactionModal = lazy(() => import('../components/RecurringTransactionModal'));

// Heavy chart components
export const PortfolioView = lazy(() => import('../components/PortfolioView'));
export const CashFlowForecast = lazy(() => import('../components/CashFlowForecast'));
export const SpendingByCategoryChart = lazy(() => import('../components/SpendingByCategoryChart'));
export const NetWorthTrendChart = lazy(() => import('../components/NetWorthTrendChart'));

// Data-heavy components
export const DebtManagement = lazy(() => import('../components/DebtManagement'));
export const DataValidation = lazy(() => import('../components/DataValidation'));

// Export utilities for preloading
export const preloadTransactions = () => import('../pages/Transactions');
export const preloadAnalytics = () => import('../pages/Analytics');
export const preloadImportModal = () => import('../components/ImportDataModal');