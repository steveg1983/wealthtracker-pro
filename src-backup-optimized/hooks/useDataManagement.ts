import { useState, useCallback } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { dataManagementService, type ModalType, type DataStats } from '../services/dataManagementService';
import { useLogger } from '../services/ServiceProvider';

export function useDataManagement() {
  const logger = useLogger();
  const appContext = useApp();
  const { accounts, transactions, budgets, clearAllData, exportData, hasTestData } = appContext;
  const loadTestData = () => {};
  
  // Modal states
  const [activeModals, setActiveModals] = useState<Set<ModalType>>(new Set());

  // Open modal
  const openModal = useCallback((modalType: ModalType) => {
    setActiveModals(prev => new Set(prev).add(modalType));
  }, []);

  // Close modal
  const closeModal = useCallback((modalType: ModalType) => {
    setActiveModals(prev => {
      const newSet = new Set(prev);
      newSet.delete(modalType);
      return newSet;
    });
  }, []);

  // Check if modal is open
  const isModalOpen = useCallback((modalType: ModalType) => {
    return activeModals.has(modalType);
  }, [activeModals]);

  // Export data handler
  const handleExportData = useCallback(() => {
    dataManagementService.exportDataAsJSON(() => JSON.stringify(exportData()));
  }, [exportData]);

  // Clear data handler
  const handleClearData = useCallback(() => {
    clearAllData();
    closeModal('deleteConfirm');
  }, [clearAllData, closeModal]);

  // Load test data handler
  const handleLoadTestData = useCallback(() => {
    loadTestData();
    closeModal('testDataConfirm');
  }, [loadTestData, closeModal]);

  // Migration complete handler
  const handleMigrationComplete = useCallback((data: any) => {
    logger.info('Migration completed', data);
    closeModal('migrationWizard');
  }, [closeModal]);

  // Get data stats
  const getDataStats = useCallback((): DataStats => {
    return {
      accountsCount: accounts.length,
      transactionsCount: transactions.length,
      budgetsCount: budgets.length
    };
  }, [accounts.length, transactions.length, budgets.length]);

  // Get button configurations
  const importButtons = dataManagementService.getImportButtons();
  const advancedOptions = dataManagementService.getAdvancedOptions();
  const bankButtons = dataManagementService.getBankConnectionButtons();

  return {
    // Data
    hasTestData,
    dataStats: getDataStats(),
    
    // Modal management
    openModal,
    closeModal,
    isModalOpen,
    
    // Handlers
    handleExportData,
    handleClearData,
    handleLoadTestData,
    handleMigrationComplete,
    
    // Button configurations
    importButtons,
    advancedOptions,
    bankButtons
  };
}