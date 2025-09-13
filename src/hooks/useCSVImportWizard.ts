import { useState, useCallback, useEffect } from 'react';
import { enhancedCsvImportService, type ColumnMapping, type ImportProfile, type ImportResult } from '../services/enhancedCsvImportService';
import { CSVImportWizardService, type WizardState } from '../services/csv-import/csvImportWizardService';
import { logger } from '../services/loggingService';
import type { Transaction, Account, Category } from '../types';

interface UseCSVImportWizardProps {
  type: 'transaction' | 'account';
  accounts?: Account[];
  categories?: Category[];
  addTransaction?: (transaction: Transaction) => Promise<void>;
  addAccount?: (account: Account) => Promise<void>;
  isOpen: boolean;
}

export function useCSVImportWizard({
  type,
  accounts,
  categories,
  addTransaction,
  addAccount,
  isOpen
}: UseCSVImportWizardProps) {
  // Wizard state
  const [state, setState] = useState<WizardState>({
    currentStep: 'upload',
    csvContent: '',
    headers: [],
    data: [],
    mappings: [],
    selectedProfile: null,
    isProcessing: false,
    importResult: null,
    showDuplicates: true,
    duplicateThreshold: 90,
    error: null
  });

  // Initialize with validation
  useEffect(() => {
    if (isOpen) {
      const error = CSVImportWizardService.validateInitialization(type, accounts, categories);
      setState(prev => ({ ...prev, error }));
    }
  }, [isOpen, type, accounts, categories]);

  // Get saved profiles
  const profiles = CSVImportWizardService.getProfiles(type);

  // Reset wizard
  const resetWizard = useCallback(() => {
    try {
      logger.debug('Resetting import wizard', { componentName: 'useCSVImportWizard' });
      setState({
        currentStep: 'upload',
        csvContent: '',
        headers: [],
        data: [],
        mappings: [],
        selectedProfile: null,
        isProcessing: false,
        importResult: null,
        showDuplicates: true,
        duplicateThreshold: 90,
        error: null
      });
    } catch (error) {
      logger.error('Failed to reset wizard:', error, 'useCSVImportWizard');
      setState(prev => ({ ...prev, error: 'Failed to reset wizard. Please refresh the page.' }));
    }
  }, []);

  // Handle file processed
  const handleFileProcessed = useCallback((content: string, parsedHeaders: string[], parsedData: string[][]) => {
    try {
      const { mappings } = CSVImportWizardService.processUploadedFile(content, parsedHeaders, parsedData, type);
      
      setState(prev => ({
        ...prev,
        csvContent: content,
        headers: parsedHeaders,
        data: parsedData,
        mappings,
        error: null,
        currentStep: 'mapping'
      }));
    } catch (error) {
      logger.error('File processing failed:', error, 'useCSVImportWizard');
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to process uploaded file'
      }));
    }
  }, [type]);

  // Update mapping
  const updateMapping = useCallback((index: number, field: keyof ColumnMapping, value: any) => {
    try {
      if (index < 0 || index >= state.mappings.length) {
        throw new Error(`Invalid mapping index: ${index}`);
      }
      
      logger.debug('Updating mapping', { index, field, value, componentName: 'useCSVImportWizard' });
      
      setState(prev => {
        const newMappings = [...prev.mappings];
        newMappings[index] = { ...newMappings[index], [field]: value };
        return { ...prev, mappings: newMappings, error: null };
      });
    } catch (error) {
      logger.error('Failed to update mapping:', error, 'useCSVImportWizard');
      setState(prev => ({ ...prev, error: 'Failed to update column mapping.' }));
    }
  }, [state.mappings]);

  // Add new mapping
  const addMapping = useCallback(() => {
    try {
      logger.debug('Adding new mapping', { currentMappingsCount: state.mappings.length, componentName: 'useCSVImportWizard' });
      setState(prev => ({
        ...prev,
        mappings: [...prev.mappings, { sourceColumn: '', targetField: '' }],
        error: null
      }));
    } catch (error) {
      logger.error('Failed to add mapping:', error, 'useCSVImportWizard');
      setState(prev => ({ ...prev, error: 'Failed to add column mapping.' }));
    }
  }, [state.mappings]);

  // Remove mapping
  const removeMapping = useCallback((index: number) => {
    try {
      if (index < 0 || index >= state.mappings.length) {
        throw new Error(`Invalid mapping index: ${index}`);
      }
      
      logger.debug('Removing mapping', { index, componentName: 'useCSVImportWizard' });
      setState(prev => ({
        ...prev,
        mappings: prev.mappings.filter((_, i) => i !== index),
        error: null
      }));
    } catch (error) {
      logger.error('Failed to remove mapping:', error, 'useCSVImportWizard');
      setState(prev => ({ ...prev, error: 'Failed to remove column mapping.' }));
    }
  }, [state.mappings]);

  // Load profile
  const loadProfile = useCallback((profile: ImportProfile) => {
    try {
      if (!profile || !profile.mappings) {
        throw new Error('Invalid profile data');
      }
      
      logger.debug('Loading import profile', { profileId: profile.id, profileName: profile.name, componentName: 'useCSVImportWizard' });
      
      setState(prev => ({
        ...prev,
        selectedProfile: profile,
        mappings: profile.mappings,
        error: null
      }));
      
      logger.info('Profile loaded successfully', { profileName: profile.name, mappingsCount: profile.mappings.length, componentName: 'useCSVImportWizard' });
    } catch (error) {
      logger.error('Failed to load profile:', error, 'useCSVImportWizard');
      setState(prev => ({ ...prev, error: 'Failed to load import profile.' }));
    }
  }, []);

  // Save profile
  const saveProfile = useCallback(() => {
    try {
      const profileName = prompt('Enter a name for this import profile:');
      if (!profileName || profileName.trim().length === 0) {
        logger.debug('Profile save cancelled - no name provided', { componentName: 'useCSVImportWizard' });
        return;
      }
      
      const profile = CSVImportWizardService.saveProfile(type, state.mappings, profileName);
      setState(prev => ({ ...prev, selectedProfile: profile, error: null }));
    } catch (error) {
      logger.error('Failed to save profile:', error, 'useCSVImportWizard');
      setState(prev => ({ ...prev, error: 'Failed to save import profile.' }));
    }
  }, [type, state.mappings]);

  // Auto-detect mappings
  const autoDetectMappings = useCallback(() => {
    try {
      const suggestedMappings = CSVImportWizardService.autoDetectMappings(state.headers, type);
      setState(prev => ({ ...prev, mappings: suggestedMappings, error: null }));
    } catch (error) {
      logger.error('Auto-detection failed:', error, 'useCSVImportWizard');
      setState(prev => ({ ...prev, error: 'Failed to auto-detect column mappings.' }));
    }
  }, [state.headers, type]);

  // Process import
  const processImport = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isProcessing: true, error: null }));
      
      const result = await CSVImportWizardService.processImport(
        state.csvContent,
        state.mappings,
        state.data,
        {
          type,
          accounts,
          categories,
          addTransaction,
          addAccount
        }
      );
      
      setState(prev => ({
        ...prev,
        importResult: result,
        currentStep: 'result',
        isProcessing: false
      }));
      
      logger.info('Import process completed successfully', { type, componentName: 'useCSVImportWizard' });
    } catch (error) {
      logger.error('Import process failed:', error, 'useCSVImportWizard');
      
      const { message, result } = CSVImportWizardService.getErrorMessage(
        error instanceof Error ? error : new Error('Unknown error'),
        state.data.length
      );
      
      setState(prev => ({
        ...prev,
        importResult: result,
        error: message,
        currentStep: 'result',
        isProcessing: false
      }));
    }
  }, [type, state.csvContent, state.mappings, state.data, state.showDuplicates, state.duplicateThreshold, accounts, categories, addTransaction, addAccount]);

  // Export report
  const exportReport = useCallback(() => {
    try {
      if (!state.importResult) return;
      CSVImportWizardService.exportReport(state.importResult, type);
    } catch (error) {
      logger.error('Failed to export report:', error, 'useCSVImportWizard');
      setState(prev => ({ ...prev, error: 'Failed to export report.' }));
    }
  }, [state.importResult, type]);

  // Navigation helpers
  const handleBack = useCallback(() => {
    switch (state.currentStep) {
      case 'mapping':
        setState(prev => ({ ...prev, currentStep: 'upload' }));
        break;
      case 'preview':
        setState(prev => ({ ...prev, currentStep: 'mapping' }));
        break;
      case 'result':
        resetWizard();
        break;
    }
  }, [state.currentStep, resetWizard]);

  const handleNext = useCallback(() => {
    switch (state.currentStep) {
      case 'upload':
        setState(prev => ({ ...prev, currentStep: 'mapping' }));
        break;
      case 'mapping':
        setState(prev => ({ ...prev, currentStep: 'preview' }));
        break;
      case 'preview':
        processImport();
        break;
    }
  }, [state.currentStep, processImport]);

  const canProceed = () => {
    switch (state.currentStep) {
      case 'upload':
        return state.headers.length > 0 && state.data.length > 0;
      case 'mapping':
        return state.mappings.some(m => m.sourceColumn && m.targetField);
      case 'preview':
        return true;
      default:
        return false;
    }
  };

  // State setters for controlled components
  const setDuplicateThreshold = useCallback((threshold: number) => {
    setState(prev => ({ ...prev, duplicateThreshold: threshold }));
  }, []);

  const setShowDuplicates = useCallback((show: boolean) => {
    setState(prev => ({ ...prev, showDuplicates: show }));
  }, []);

  const setCurrentStep = useCallback((step: WizardState['currentStep']) => {
    setState(prev => ({ ...prev, currentStep: step }));
  }, []);

  return {
    // State
    ...state,
    profiles,
    
    // Actions
    resetWizard,
    handleFileProcessed,
    updateMapping,
    addMapping,
    removeMapping,
    loadProfile,
    saveProfile,
    autoDetectMappings,
    processImport,
    exportReport,
    
    // Navigation
    handleBack,
    handleNext,
    canProceed,
    
    // Setters
    setDuplicateThreshold,
    setShowDuplicates,
    setCurrentStep
  };
}