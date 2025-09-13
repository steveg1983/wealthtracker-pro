/**
 * Recurring Transaction Service
 * World-class service for managing recurring transaction templates
 * Follows Apple's design principles: Clarity, Deference, and Depth
 */

import { format, addDays, addWeeks, addMonths, addYears } from 'date-fns';
import { toMoney } from '../../types/money';
import type { Transaction } from '../../types';
import { logger } from '../loggingService';

export type RecurrenceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export interface RecurringTemplate {
  id: string;
  name: string;
  description: string;
  amount: string;
  category: string;
  accountId: string;
  frequency: RecurrenceFrequency;
  startDate: string;
  endDate?: string;
  nextDate: string;
  isActive: boolean;
  lastProcessed?: string;
  occurrences: number;
  maxOccurrences?: number;
  dayOfMonth?: number;
  dayOfWeek?: number;
  tags?: string[];
  notes?: string;
}

interface ProcessingResult {
  success: boolean;
  error?: Error;
  nextDate?: string;
}

/**
 * Service for managing recurring transactions with enterprise-grade reliability
 */
class RecurringTransactionService {
  private readonly STORAGE_KEY = 'recurringTemplates';
  private readonly CHECK_INTERVAL = 3600000; // 1 hour in milliseconds

  /**
   * Load templates from persistent storage
   */
  loadTemplates(): RecurringTemplate[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      logger.error('Failed to load recurring templates:', error);
      return [];
    }
  }

  /**
   * Save templates to persistent storage
   */
  saveTemplates(templates: RecurringTemplate[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(templates));
    } catch (error) {
      logger.error('Failed to save recurring templates:', error);
    }
  }

  /**
   * Get templates that are due for processing
   */
  getDueTemplates(templates: RecurringTemplate[]): RecurringTemplate[] {
    const today = format(new Date(), 'yyyy-MM-dd');
    
    return templates.filter(template => 
      template.isActive && 
      template.nextDate <= today && 
      (!template.endDate || template.nextDate <= template.endDate) &&
      (!template.maxOccurrences || template.occurrences < template.maxOccurrences)
    );
  }

  /**
   * Calculate the next occurrence date based on frequency
   */
  calculateNextDate(currentDate: string, frequency: RecurrenceFrequency): string {
    const date = new Date(currentDate);
    
    const calculators: Record<RecurrenceFrequency, (d: Date) => Date> = {
      'daily': (d) => addDays(d, 1),
      'weekly': (d) => addWeeks(d, 1),
      'biweekly': (d) => addWeeks(d, 2),
      'monthly': (d) => addMonths(d, 1),
      'quarterly': (d) => addMonths(d, 3),
      'yearly': (d) => addYears(d, 1)
    };
    
    const calculator = calculators[frequency];
    if (!calculator) {
      logger.warn(`Unknown frequency: ${frequency}`);
      return currentDate;
    }
    
    return format(calculator(date), 'yyyy-MM-dd');
  }

  /**
   * Create a transaction from a template
   */
  createTransactionFromTemplate(template: RecurringTemplate): Omit<Transaction, 'id'> {
    const normalized = toMoney(template.amount);
    const amount = Number(normalized);
    
    return {
      date: new Date(template.nextDate),
      description: template.description,
      amount,
      category: template.category,
      accountId: template.accountId,
      type: amount > 0 ? 'income' : 'expense',
      tags: template.tags,
      notes: this.formatTransactionNotes(template)
    };
  }

  /**
   * Format transaction notes with template information
   */
  private formatTransactionNotes(template: RecurringTemplate): string {
    const parts = [`Recurring: ${template.name}`];
    if (template.notes) {
      parts.push(template.notes);
    }
    return parts.join('\n');
  }

  /**
   * Update template after successful processing
   */
  updateTemplateAfterProcessing(template: RecurringTemplate): RecurringTemplate {
    const nextDate = this.calculateNextDate(template.nextDate, template.frequency);
    const newOccurrences = template.occurrences + 1;
    
    return {
      ...template,
      nextDate,
      lastProcessed: template.nextDate,
      occurrences: newOccurrences,
      isActive: template.maxOccurrences ? newOccurrences < template.maxOccurrences : true
    };
  }

  /**
   * Get human-readable frequency label
   */
  getFrequencyLabel(frequency: RecurrenceFrequency): string {
    const labels: Record<RecurrenceFrequency, string> = {
      'daily': 'Daily',
      'weekly': 'Weekly',
      'biweekly': 'Bi-weekly',
      'monthly': 'Monthly',
      'quarterly': 'Quarterly',
      'yearly': 'Yearly'
    };
    return labels[frequency] || frequency;
  }

  /**
   * Calculate status color based on template state
   */
  getStatusColor(template: RecurringTemplate, isProcessing: boolean = false): string {
    if (!template.isActive) return 'text-gray-500';
    if (isProcessing) return 'text-gray-500';
    
    const today = new Date();
    const nextDate = new Date(template.nextDate);
    const daysUntilNext = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilNext <= 0) return 'text-red-500';
    if (daysUntilNext <= 3) return 'text-orange-500';
    if (daysUntilNext <= 7) return 'text-yellow-500';
    return 'text-green-500';
  }

  /**
   * Generate a unique template ID
   */
  generateTemplateId(): string {
    return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate template data
   */
  validateTemplate(template: Partial<RecurringTemplate>): string[] {
    const errors: string[] = [];
    
    if (!template.name?.trim()) {
      errors.push('Template name is required');
    }
    
    if (!template.description?.trim()) {
      errors.push('Description is required');
    }
    
    if (!template.amount || isNaN(parseFloat(template.amount))) {
      errors.push('Valid amount is required');
    }
    
    if (!template.category) {
      errors.push('Category is required');
    }
    
    if (!template.accountId) {
      errors.push('Account is required');
    }
    
    if (!template.frequency) {
      errors.push('Frequency is required');
    }
    
    if (!template.startDate) {
      errors.push('Start date is required');
    }
    
    if (template.endDate && template.startDate && template.endDate < template.startDate) {
      errors.push('End date must be after start date');
    }
    
    if (template.maxOccurrences && template.maxOccurrences < 1) {
      errors.push('Maximum occurrences must be at least 1');
    }
    
    return errors;
  }

  /**
   * Check if template should be auto-disabled
   */
  shouldAutoDisable(template: RecurringTemplate): boolean {
    if (template.endDate && new Date(template.endDate) < new Date()) {
      return true;
    }
    
    if (template.maxOccurrences && template.occurrences >= template.maxOccurrences) {
      return true;
    }
    
    return false;
  }
}

export const recurringTransactionService = new RecurringTransactionService();
