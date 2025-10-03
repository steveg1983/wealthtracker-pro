/**
 * Enhanced Import Wizard Service
 * Handles business logic for the import wizard
 */

import { enhancedCsvImportService } from './enhancedCsvImportService';
import { lazyLogger as logger } from './serviceFactory';

export type WizardStep = 'files' | 'format' | 'mapping' | 'rules' | 'preview' | 'result';

export interface ImportFile {
  file: File;
  type: 'csv' | 'ofx' | 'qif';
}

export interface PreviewData {
  accounts: Array<{ name: string; balance: number }>;
  transactions: Array<{
    date: string;
    description: string;
    amount: number;
    category?: string;
  }>;
  summary: {
    totalTransactions: number;
    totalIncome: number;
    totalExpenses: number;
    dateRange: { start: Date; end: Date };
  };
}

class EnhancedImportWizardService {
  /**
   * Format currency value
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  /**
   * Format date value
   */
  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  /**
   * Get step number for progress indicator
   */
  getStepNumber(step: WizardStep): number {
    const steps: WizardStep[] = ['files', 'format', 'mapping', 'rules', 'preview', 'result'];
    return steps.indexOf(step) + 1;
  }

  /**
   * Check if a step can proceed
   */
  canProceed(
    currentStep: WizardStep,
    files: ImportFile[],
    selectedBankFormat: string | null,
    mappings: any[]
  ): boolean {
    switch (currentStep) {
      case 'files':
        return files.length > 0;
      case 'format':
        return !!selectedBankFormat || !files.some(f => f.type === 'csv');
      case 'mapping':
        return mappings.length > 0 || selectedBankFormat !== 'custom';
      case 'preview':
        return true;
      default:
        return false;
    }
  }

  /**
   * Determine next step based on current state
   */
  getNextStep(
    currentStep: WizardStep,
    files: ImportFile[],
    selectedBankFormat: string | null
  ): WizardStep | null {
    switch (currentStep) {
      case 'files':
        return files.some(f => f.type === 'csv') ? 'format' : 'preview';
      case 'format':
        return selectedBankFormat === 'custom' ? 'mapping' : 'preview';
      case 'mapping':
        return 'preview';
      case 'preview':
        return 'result';
      default:
        return null;
    }
  }

  /**
   * Determine previous step
   */
  getPreviousStep(
    currentStep: WizardStep,
    files: ImportFile[],
    selectedBankFormat: string | null
  ): WizardStep | null {
    switch (currentStep) {
      case 'format':
        return 'files';
      case 'mapping':
        return 'format';
      case 'preview':
        if (selectedBankFormat === 'custom') {
          return 'mapping';
        } else if (files.some(f => f.type === 'csv')) {
          return 'format';
        } else {
          return 'files';
        }
      case 'result':
        return null; // Reset on back from result
      default:
        return null;
    }
  }

  /**
   * Check if a step should be shown
   */
  shouldShowStep(
    step: WizardStep,
    files: ImportFile[],
    selectedBankFormat: string | null
  ): boolean {
    switch (step) {
      case 'files':
      case 'preview':
        return true;
      case 'format':
        return files.some(f => f.type === 'csv');
      case 'mapping':
        return selectedBankFormat === 'custom';
      default:
        return false;
    }
  }

  /**
   * Get CSV headers from file
   */
  async getCsvHeaders(files: ImportFile[]): Promise<string[]> {
    const csvFile = files.find(f => f.type === 'csv');
    if (!csvFile) return [];
    
    try {
      const content = await csvFile.file.text();
      const parsed = enhancedCsvImportService.parseCSV(content);
      return parsed.headers;
    } catch (error) {
      logger.error('Error getting CSV headers:', error);
      return [];
    }
  }

  /**
   * Generate preview data
   */
  async generatePreview(
    files: ImportFile[],
    selectedBankFormat: string | null,
    mappings: any[]
  ): Promise<any> {
    const csvFile = files.find(f => f.type === 'csv');
    if (!csvFile) return null;
    
    try {
      const content = await csvFile.file.text();
      const parsed = enhancedCsvImportService.parseCSV(content);
      const usedMappings = selectedBankFormat && selectedBankFormat !== 'custom'
        ? enhancedCsvImportService.getBankMappings(selectedBankFormat)
        : mappings;
      
      return enhancedCsvImportService.generatePreview(parsed.data, usedMappings);
    } catch (error) {
      logger.error('Error generating preview:', error);
      return null;
    }
  }

  /**
   * Get step display name
   */
  getStepDisplayName(step: WizardStep): string {
    return step.charAt(0).toUpperCase() + step.slice(1);
  }

  /**
   * Get step classes for styling
   */
  getStepClasses(isActive: boolean, isComplete: boolean): {
    containerClass: string;
    textClass: string;
  } {
    const containerClass = isActive 
      ? 'bg-blue-600 text-white'
      : isComplete 
        ? 'bg-green-600 text-white'
        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
    
    const textClass = isActive 
      ? 'font-medium text-gray-900 dark:text-white'
      : 'text-gray-600 dark:text-gray-400';
    
    return { containerClass, textClass };
  }
}

export const enhancedImportWizardService = new EnhancedImportWizardService();
