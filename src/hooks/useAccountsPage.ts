import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from './useCurrencyDecimal';
import { preserveDemoParam } from '../utils/navigation';
import { 
  accountsPageService,
  type DecimalAccount,
  type InvestmentSummary
} from '../services/accountsPageService';

export function useAccountsPage(onAccountClick?: (accountId: string) => void) {
  const { accounts, updateAccount, deleteAccount } = useApp();
  const { formatCurrency: formatDisplayCurrency } = useCurrencyDecimal();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState('');
  const [reconcileAccountId, setReconcileAccountId] = useState<string | null>(null);
  const [balanceAdjustmentData, setBalanceAdjustmentData] = useState<{
    accountId: string;
    currentBalance: number;
    newBalance: string;
  } | null>(null);
  const [portfolioAccountId, setPortfolioAccountId] = useState<string | null>(null);
  const [settingsAccountId, setSettingsAccountId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Convert accounts to decimal for calculations
  const decimalAccounts = useMemo(
    () => accountsPageService.convertToDecimalAccounts(accounts),
    [accounts]
  );
  
  // Group accounts by type
  const accountsByType = useMemo(
    () => accountsPageService.groupAccountsByType(accounts),
    [accounts]
  );
  
  // Group decimal accounts by type for calculations
  const decimalAccountsByType = useMemo(
    () => accountsPageService.groupDecimalAccountsByType(decimalAccounts),
    [decimalAccounts]
  );

  // Get account type metadata
  const accountTypes = useMemo(
    () => accountsPageService.getAccountTypeMetadata(),
    []
  );

  // Set loading to false when accounts are loaded
  useEffect(() => {
    if (accounts !== undefined) {
      setIsLoading(false);
    }
  }, [accounts]);

  // Handlers
  const handleEdit = useCallback((accountId: string, currentBalance: number) => {
    setEditingId(accountId);
    setEditBalance(currentBalance.toString());
  }, []);

  const handleSaveEdit = useCallback((accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    if (account) {
      setBalanceAdjustmentData({
        accountId,
        currentBalance: account.balance,
        newBalance: editBalance
      });
    }
    setEditingId(null);
    setEditBalance('');
  }, [accounts, editBalance]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditBalance('');
  }, []);

  const handleDelete = useCallback((accountId: string) => {
    if (window.confirm('Are you sure you want to delete this account? All related transactions will also be deleted.')) {
      deleteAccount(accountId);
    }
  }, [deleteAccount]);

  const handleAccountNavigation = useCallback((accountId: string, event: React.MouseEvent) => {
    // Don't navigate if clicking on buttons or inputs
    if ((event.target as HTMLElement).closest('button, input')) return;
    
    if (onAccountClick) {
      onAccountClick(accountId);
    } else {
      navigate(preserveDemoParam(`/accounts/${accountId}`, location.search));
    }
  }, [onAccountClick, navigate, location.search]);

  const handleAddAccount = useCallback(() => {
    setIsAddModalOpen(true);
  }, []);

  const handleCloseAddModal = useCallback(() => {
    setIsAddModalOpen(false);
  }, []);

  const handleOpenReconcile = useCallback((accountId: string) => {
    setReconcileAccountId(accountId);
  }, []);

  const handleCloseReconcile = useCallback(() => {
    setReconcileAccountId(null);
  }, []);

  const handleOpenSettings = useCallback((accountId: string) => {
    setSettingsAccountId(accountId);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setSettingsAccountId(null);
  }, []);

  const handleOpenPortfolio = useCallback((accountId: string) => {
    setPortfolioAccountId(accountId);
  }, []);

  const handleClosePortfolio = useCallback(() => {
    setPortfolioAccountId(null);
  }, []);

  const handleCloseBalanceAdjustment = useCallback(() => {
    if (balanceAdjustmentData?.accountId) {
      const newBalance = parseFloat(balanceAdjustmentData.newBalance) || 0;
      updateAccount(balanceAdjustmentData.accountId, {
        balance: newBalance,
        lastUpdated: new Date()
      });
    }
    setBalanceAdjustmentData(null);
  }, [balanceAdjustmentData, updateAccount]);

  const handleSaveSettings = useCallback((accountId: string, updates: any) => {
    updateAccount(accountId, updates);
    setSettingsAccountId(null);
  }, [updateAccount]);

  // Utility functions
  const getInvestmentSummary = useCallback((account: any): InvestmentSummary | null => {
    return accountsPageService.getInvestmentSummary(account);
  }, []);

  const calculateTypeTotal = useCallback((type: string) => {
    const typeAccounts = decimalAccountsByType[type] || [];
    return accountsPageService.calculateTypeTotal(typeAccounts);
  }, [decimalAccountsByType]);

  const formatLastUpdated = useCallback((date: Date | string) => {
    return accountsPageService.formatLastUpdated(date);
  }, []);

  return {
    // State
    isLoading,
    isAddModalOpen,
    editingId,
    editBalance,
    reconcileAccountId,
    balanceAdjustmentData,
    portfolioAccountId,
    settingsAccountId,
    
    // Data
    accounts,
    accountsByType,
    decimalAccountsByType,
    accountTypes,
    
    // Handlers
    handleEdit,
    handleSaveEdit,
    handleCancelEdit,
    handleDelete,
    handleAccountNavigation,
    handleAddAccount,
    handleCloseAddModal,
    handleOpenReconcile,
    handleCloseReconcile,
    handleOpenSettings,
    handleCloseSettings,
    handleOpenPortfolio,
    handleClosePortfolio,
    handleCloseBalanceAdjustment,
    handleSaveSettings,
    setEditBalance,
    
    // Utilities
    formatDisplayCurrency,
    getInvestmentSummary,
    calculateTypeTotal,
    formatLastUpdated
  };
}