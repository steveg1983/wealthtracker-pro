/**
 * useRecurringTransactions Hook
 * World-class custom hook for managing recurring transactions
 * Implements best practices for state management and side effects
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { recurringTransactionService, type RecurringTemplate } from '../services/recurring/recurringTransactionService';
import { logger } from '../services/loggingService';
import type { Transaction } from '../types';

interface UseRecurringTransactionsReturn {
  templates: RecurringTemplate[];
  processingTemplates: Set<string>;
  isLoading: boolean;
  error: string | null;
  addTemplate: (template: Omit<RecurringTemplate, 'id' | 'occurrences'>) => void;
  updateTemplate: (template: RecurringTemplate) => void;
  deleteTemplate: (id: string) => void;
  toggleTemplateActive: (id: string) => void;
  processTemplate: (template: RecurringTemplate) => Promise<void>;
  processDueTemplates: () => void;
}

/**
 * Enterprise-grade hook for recurring transaction management
 */
export function useRecurringTransactions(): UseRecurringTransactionsReturn {
  const { addTransaction } = useApp();
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [processingTemplates, setProcessingTemplates] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout>();

  /**
   * Load templates on mount
   */
  useEffect(() => {
    try {
      const loadedTemplates = recurringTransactionService.loadTemplates();
      setTemplates(loadedTemplates);
      setError(null);
    } catch (err) {
      logger.error('Failed to load recurring templates:', err);
      setError('Failed to load recurring transactions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Save templates when they change
   */
  useEffect(() => {
    if (!isLoading && templates.length > 0) {
      recurringTransactionService.saveTemplates(templates);
    }
  }, [templates, isLoading]);

  /**
   * Process due templates on mount and periodically
   */
  useEffect(() => {
    const processAndSchedule = () => {
      processDueTemplates();
    };

    // Process immediately
    processAndSchedule();

    // Schedule periodic checks (every hour)
    intervalRef.current = setInterval(processAndSchedule, 3600000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [templates]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Process all due templates
   */
  const processDueTemplates = useCallback(() => {
    const dueTemplates = recurringTransactionService.getDueTemplates(templates);
    
    dueTemplates.forEach(template => {
      if (!processingTemplates.has(template.id)) {
        processTemplate(template);
      }
    });
  }, [templates, processingTemplates]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Process a single template
   */
  const processTemplate = useCallback(async (template: RecurringTemplate) => {
    setProcessingTemplates(prev => new Set(prev).add(template.id));

    try {
      // Create transaction from template
      const transaction = recurringTransactionService.createTransactionFromTemplate(template);
      
      // Add transaction to the system
      await addTransaction(transaction as Transaction);
      
      // Update template after successful processing
      const updatedTemplate = recurringTransactionService.updateTemplateAfterProcessing(template);
      
      setTemplates(prev => prev.map(t => 
        t.id === template.id ? updatedTemplate : t
      ));
      
      logger.info(`Successfully processed recurring template: ${template.name}`);
    } catch (err) {
      logger.error(`Failed to process recurring template ${template.name}:`, err);
      setError(`Failed to process recurring transaction: ${template.name}`);
    } finally {
      setProcessingTemplates(prev => {
        const next = new Set(prev);
        next.delete(template.id);
        return next;
      });
    }
  }, [addTransaction]);

  /**
   * Add a new template
   */
  const addTemplate = useCallback((templateData: Omit<RecurringTemplate, 'id' | 'occurrences'>) => {
    const validationErrors = recurringTransactionService.validateTemplate(templateData);
    
    if (validationErrors.length > 0) {
      setError(validationErrors.join(', '));
      return;
    }

    const newTemplate: RecurringTemplate = {
      ...templateData,
      id: recurringTransactionService.generateTemplateId(),
      occurrences: 0,
      nextDate: templateData.startDate // Start from the start date
    };
    
    setTemplates(prev => [...prev, newTemplate]);
    setError(null);
    logger.info(`Added recurring template: ${newTemplate.name}`);
  }, []);

  /**
   * Update an existing template
   */
  const updateTemplate = useCallback((template: RecurringTemplate) => {
    const validationErrors = recurringTransactionService.validateTemplate(template);
    
    if (validationErrors.length > 0) {
      setError(validationErrors.join(', '));
      return;
    }

    setTemplates(prev => prev.map(t => t.id === template.id ? template : t));
    setError(null);
    logger.info(`Updated recurring template: ${template.name}`);
  }, []);

  /**
   * Delete a template
   */
  const deleteTemplate = useCallback((id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    setError(null);
    logger.info(`Deleted recurring template: ${id}`);
  }, []);

  /**
   * Toggle template active state
   */
  const toggleTemplateActive = useCallback((id: string) => {
    setTemplates(prev => prev.map(t => {
      if (t.id === id) {
        const newActive = !t.isActive;
        logger.info(`${newActive ? 'Activated' : 'Paused'} recurring template: ${t.name}`);
        return { ...t, isActive: newActive };
      }
      return t;
    }));
    setError(null);
  }, []);

  return {
    templates,
    processingTemplates,
    isLoading,
    error,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    toggleTemplateActive,
    processTemplate,
    processDueTemplates
  };
}