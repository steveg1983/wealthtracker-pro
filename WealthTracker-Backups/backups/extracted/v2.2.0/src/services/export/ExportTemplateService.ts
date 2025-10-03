import type { ExportOptions } from '../exportService';
import { logger } from '../loggingService';

export interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  options: ExportOptions;
  isDefault: boolean;
  createdAt: Date;
}

/**
 * Enterprise-grade service for managing export templates
 * Follows Single Responsibility Principle - only handles template management
 */
export class ExportTemplateService {
  private templates: ExportTemplate[] = [];
  private readonly STORAGE_KEY = 'export_templates';

  constructor() {
    this.loadTemplates();
    this.initializeDefaultTemplates();
  }

  /**
   * Load templates from localStorage
   */
  private loadTemplates(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.templates = data.templates || [];
        // Convert date strings back to Date objects
        this.templates = this.templates.map(template => ({
          ...template,
          createdAt: new Date(template.createdAt),
          options: {
            ...template.options,
            startDate: new Date(template.options.startDate),
            endDate: new Date(template.options.endDate)
          }
        }));
      }
    } catch (error) {
      logger.error('Failed to load export templates:', error);
      this.templates = [];
    }
  }

  /**
   * Save templates to localStorage
   */
  private saveTemplates(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        templates: this.templates
      }));
    } catch (error) {
      logger.error('Failed to save export templates:', error);
    }
  }

  /**
   * Initialize default templates if none exist
   */
  private initializeDefaultTemplates(): void {
    if (this.templates.length === 0) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      const defaultTemplates: Omit<ExportTemplate, 'id' | 'createdAt'>[] = [
        {
          name: 'Monthly Report',
          description: 'Complete monthly financial report with all data',
          options: {
            startDate: startOfMonth,
            endDate: endOfMonth,
            format: 'pdf',
            includeCharts: true,
            includeTransactions: true,
            includeAccounts: true,
            includeInvestments: true,
            includeBudgets: true,
            groupBy: 'category'
          },
          isDefault: true
        },
        {
          name: 'Tax Report',
          description: 'Annual report for tax purposes',
          options: {
            startDate: startOfYear,
            endDate: now,
            format: 'xlsx',
            includeCharts: false,
            includeTransactions: true,
            includeAccounts: true,
            includeInvestments: true,
            includeBudgets: false,
            groupBy: 'month'
          },
          isDefault: false
        },
        {
          name: 'Transaction Export',
          description: 'Export transactions for accounting software',
          options: {
            startDate: startOfMonth,
            endDate: endOfMonth,
            format: 'csv',
            includeCharts: false,
            includeTransactions: true,
            includeAccounts: false,
            includeInvestments: false,
            includeBudgets: false,
            groupBy: 'none'
          },
          isDefault: false
        }
      ];

      defaultTemplates.forEach(template => {
        this.createTemplate(template);
      });
    }
  }

  /**
   * Get all templates
   */
  getTemplates(): ExportTemplate[] {
    return [...this.templates];
  }

  /**
   * Get template by ID
   */
  getTemplate(id: string): ExportTemplate | null {
    return this.templates.find(t => t.id === id) || null;
  }

  /**
   * Create a new template
   */
  createTemplate(template: Omit<ExportTemplate, 'id' | 'createdAt'>): ExportTemplate {
    const newTemplate: ExportTemplate = {
      ...template,
      id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date()
    };
    
    this.templates.push(newTemplate);
    this.saveTemplates();
    logger.info('Created export template:', newTemplate.name);
    
    return newTemplate;
  }

  /**
   * Update an existing template
   */
  updateTemplate(id: string, updates: Partial<ExportTemplate>): ExportTemplate | null {
    const index = this.templates.findIndex(t => t.id === id);
    if (index === -1) return null;
    
    this.templates[index] = { ...this.templates[index], ...updates, id };
    this.saveTemplates();
    logger.info('Updated export template:', id);
    
    return this.templates[index];
  }

  /**
   * Delete a template
   */
  deleteTemplate(id: string): boolean {
    const initialLength = this.templates.length;
    this.templates = this.templates.filter(t => t.id !== id);
    
    if (this.templates.length < initialLength) {
      this.saveTemplates();
      logger.info('Deleted export template:', id);
      return true;
    }
    
    return false;
  }

  /**
   * Get default template
   */
  getDefaultTemplate(): ExportTemplate | null {
    return this.templates.find(t => t.isDefault) || null;
  }

  /**
   * Set default template
   */
  setDefaultTemplate(id: string): boolean {
    const template = this.templates.find(t => t.id === id);
    if (!template) return false;

    // Remove default flag from all templates
    this.templates.forEach(t => {
      t.isDefault = false;
    });

    // Set new default
    template.isDefault = true;
    this.saveTemplates();
    
    logger.info('Set default export template:', id);
    return true;
  }
}

export const exportTemplateService = new ExportTemplateService();