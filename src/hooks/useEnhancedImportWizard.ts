/**
 * Custom Hook for Enhanced Import Wizard
 * Manages wizard state and navigation
 */

import { useState, useEffect, useCallback } from 'react';
import { enhancedImportWizardService } from '../services/enhancedImportWizardService';
import type { WizardStep, PreviewData, ImportFile } from '../services/enhancedImportWizardService';
import type { ImportFile as FileInfo } from '../components/import/useImportWizard';

export interface UseEnhancedImportWizardReturn {
  currentStep: WizardStep;
  showRulesManager: boolean;
  showTestDataWarning: boolean;
  previewData: PreviewData | null;
  csvHeaders: string[];
  canProceed: boolean;
  setShowRulesManager: (show: boolean) => void;
  setShowTestDataWarning: (show: boolean) => void;
  handleNext: () => Promise<void>;
  handleBack: () => void;
  handleGeneratePreview: () => Promise<void>;
  handleTestDataConfirm: () => Promise<void>;
}

export function useEnhancedImportWizard(
  files: FileInfo[],
  selectedBankFormat: string | null,
  mappings: any[],
  currentStep: WizardStep,
  hasTestData: boolean,
  isProcessing: boolean,
  setCurrentStep: (step: WizardStep) => void,
  processFiles: () => Promise<void>,
  reset: () => void,
  clearAllData?: () => Promise<void>
): UseEnhancedImportWizardReturn {
  const [showRulesManager, setShowRulesManager] = useState(false);
  const [showTestDataWarning, setShowTestDataWarning] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);

  // Filter and transform files to match service expectations
  const validFiles: ImportFile[] = files
    .filter(f => f.type !== 'unknown')
    .map(f => ({ file: f.file, type: f.type as 'csv' | 'ofx' | 'qif' }));

  const canProceed = enhancedImportWizardService.canProceed(
    currentStep,
    validFiles,
    selectedBankFormat,
    mappings
  );

  const handleGeneratePreview = useCallback(async () => {
    if (validFiles.length === 0) return;

    const preview = await enhancedImportWizardService.generatePreview(
      validFiles,
      selectedBankFormat,
      mappings
    );
    
    if (preview) {
      setPreviewData(preview);
    }
  }, [validFiles, selectedBankFormat, mappings]);

  const handleNext = useCallback(async () => {
    const nextStep = enhancedImportWizardService.getNextStep(
      currentStep,
      validFiles,
      selectedBankFormat
    );

    if (!nextStep) return;

    // Handle special cases
    if (currentStep === 'files' && nextStep === 'preview') {
      // Skip format and mapping for OFX/QIF files
      await handleGeneratePreview();
      setCurrentStep('preview');
    } else if (currentStep === 'format' && nextStep === 'preview') {
      await handleGeneratePreview();
      setCurrentStep('preview');
    } else if (currentStep === 'mapping' && nextStep === 'preview') {
      await handleGeneratePreview();
      setCurrentStep('preview');
    } else if (currentStep === 'preview') {
      if (hasTestData && !showTestDataWarning) {
        setShowTestDataWarning(true);
      } else {
        await processFiles();
      }
    } else {
      setCurrentStep(nextStep);
    }
  }, [currentStep, validFiles, selectedBankFormat, hasTestData, showTestDataWarning,
      handleGeneratePreview, setCurrentStep, processFiles]);

  const handleBack = useCallback(() => {
    const previousStep = enhancedImportWizardService.getPreviousStep(
      currentStep,
      validFiles,
      selectedBankFormat
    );

    if (previousStep) {
      setCurrentStep(previousStep);
    } else if (currentStep === 'result') {
      reset();
    }
  }, [currentStep, validFiles, selectedBankFormat, setCurrentStep, reset]);

  const handleTestDataConfirm = useCallback(async () => {
    if (clearAllData) {
      await clearAllData();
    }
    setShowTestDataWarning(false);
    await processFiles();
  }, [clearAllData, processFiles]);

  // Load CSV headers when on mapping step
  useEffect(() => {
    if (currentStep === 'mapping' && validFiles.some(f => f.type === 'csv')) {
      enhancedImportWizardService.getCsvHeaders(validFiles).then(setCsvHeaders);
    }
  }, [currentStep, validFiles]);

  return {
    currentStep,
    showRulesManager,
    showTestDataWarning,
    previewData,
    csvHeaders,
    canProceed,
    setShowRulesManager,
    setShowTestDataWarning,
    handleNext,
    handleBack,
    handleGeneratePreview,
    handleTestDataConfirm
  };
}