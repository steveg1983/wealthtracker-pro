import { useState, useMemo, useCallback } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { dataManagementPageService } from '../services/dataManagementPageService';
import type { DataManagementTab, DataStats } from '../services/dataManagementPageService';
import { useLogger } from '../services/ServiceProvider';

interface DataManagementState {
  activeTab: DataManagementTab;
  showDeleteConfirm: boolean;
  showImportModal: boolean;
  showTestDataConfirm: boolean;
  showCSVImportWizard: boolean;
  showOFXImportModal: boolean;
  showQIFImportModal: boolean;
  showDuplicateDetection: boolean;
  showExcelExport: boolean;
  showBulkEdit: boolean;
  showReconciliation: boolean;
  showDataValidation: boolean;
  showSmartCategorization: boolean;
  showBatchImport: boolean;
  showImportRules: boolean;
  showBankConnections: boolean;
  showBankAPISettings: boolean;
  showMigrationWizard: boolean;
  showAutomaticBackup: boolean;
}

export function useDataManagementPage() {
  const logger = useLogger();
  const { 
    accounts, 
    transactions, 
    budgets, 
    categories,
    goals,
    clearAllData, 
    exportData, 
    hasTestData 
  } = useApp();
  const loadTestData = (useApp() as any).loadTestData;

  // Initialize state
  const [state, setState] = useState<DataManagementState>({
    activeTab: 'import',
    showDeleteConfirm: false,
    showImportModal: false,
    showTestDataConfirm: false,
    showCSVImportWizard: false,
    showOFXImportModal: false,
    showQIFImportModal: false,
    showDuplicateDetection: false,
    showExcelExport: false,
    showBulkEdit: false,
    showReconciliation: false,
    showDataValidation: false,
    showSmartCategorization: false,
    showBatchImport: false,
    showImportRules: false,
    showBankConnections: false,
    showBankAPISettings: false,
    showMigrationWizard: false,
    showAutomaticBackup: false
  });

  // Calculate data statistics
  const dataStats = useMemo<DataStats>(() => {
    return dataManagementPageService.calculateDataStats({
      accounts,
      transactions,
      budgets,
      categories,
      goals
    });
  }, [accounts, transactions, budgets, categories, goals]);

  // Tab configs
  const tabConfigs = useMemo(() => {
    return dataManagementPageService.getTabConfigs();
  }, []);

  // Set active tab
  const setActiveTab = useCallback((tab: DataManagementTab) => {
    setState(prev => ({ ...prev, activeTab: tab }));
  }, []);

  // Modal toggles
  const toggleModal = useCallback((modalName: keyof DataManagementState, value?: boolean) => {
    setState(prev => ({
      ...prev,
      [modalName]: value !== undefined ? value : !prev[modalName]
    }));
  }, []);

  // Export handlers
  const handleExportJSON = useCallback(() => {
    dataManagementPageService.exportToJSON(() => JSON.stringify(exportData()));
  }, [exportData]);

  const handleExportExcel = useCallback(() => {
    toggleModal('showExcelExport', true);
  }, [toggleModal]);

  const handleExportCSV = useCallback(() => {
    // CSV export feature not yet implemented
    logger.info('CSV export initiated');
  }, []);

  const handleExportPDF = useCallback(() => {
    // PDF export feature not yet implemented
    logger.info('PDF export initiated');
  }, []);

  // Import handlers
  const importHandlers = useMemo(() => ({
    csv: () => toggleModal('showCSVImportWizard', true),
    ofx: () => toggleModal('showOFXImportModal', true),
    qif: () => toggleModal('showQIFImportModal', true),
    batch: () => toggleModal('showBatchImport', true),
    json: () => toggleModal('showImportModal', true),
    bank: () => toggleModal('showBankConnections', true)
  }), [toggleModal]);

  // Export handlers object
  const exportHandlers = useMemo(() => ({
    json: handleExportJSON,
    excel: handleExportExcel,
    csv: handleExportCSV,
    pdf: handleExportPDF
  }), [handleExportJSON, handleExportExcel, handleExportCSV, handleExportPDF]);

  // Tool handlers
  const toolHandlers = useMemo(() => ({
    duplicate: () => toggleModal('showDuplicateDetection', true),
    bulk: () => toggleModal('showBulkEdit', true),
    reconcile: () => toggleModal('showReconciliation', true),
    validate: () => toggleModal('showDataValidation', true),
    categorize: () => toggleModal('showSmartCategorization', true),
    rules: () => toggleModal('showImportRules', true),
    migration: () => toggleModal('showMigrationWizard', true),
    api: () => toggleModal('showBankAPISettings', true)
  }), [toggleModal]);

  // Backup handlers
  const backupHandlers = useMemo(() => ({
    automatic: () => toggleModal('showAutomaticBackup', true),
    manual: handleExportJSON,
    restore: () => toggleModal('showImportModal', true)
  }), [toggleModal, handleExportJSON]);

  // Get configured options
  const importOptions = useMemo(() => {
    return dataManagementPageService.getImportOptions(importHandlers);
  }, [importHandlers]);

  const exportOptions = useMemo(() => {
    return dataManagementPageService.getExportOptions(exportHandlers);
  }, [exportHandlers]);

  const dataTools = useMemo(() => {
    return dataManagementPageService.getDataTools(toolHandlers);
  }, [toolHandlers]);

  const backupOptions = useMemo(() => {
    return dataManagementPageService.getBackupOptions(backupHandlers);
  }, [backupHandlers]);

  // Data management handlers
  const handleClearData = useCallback(() => {
    clearAllData();
    toggleModal('showDeleteConfirm', false);
  }, [clearAllData, toggleModal]);

  const handleLoadTestData = useCallback(() => {
    loadTestData();
    toggleModal('showTestDataConfirm', false);
  }, [loadTestData, toggleModal]);

  // Get confirmation message
  const getClearDataMessage = useCallback(() => {
    return dataManagementPageService.getClearDataMessage(hasTestData);
  }, [hasTestData]);

  return {
    // State
    ...state,
    hasTestData,
    dataStats,
    
    // Configs
    tabConfigs,
    importOptions,
    exportOptions,
    dataTools,
    backupOptions,
    
    // Handlers
    setActiveTab,
    toggleModal,
    handleClearData,
    handleLoadTestData,
    getClearDataMessage,
    
    // Export individual handlers for components
    handleExportJSON,
    handleExportExcel,
    handleExportCSV,
    handleExportPDF
  };
}