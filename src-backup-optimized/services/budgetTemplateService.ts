/**
 * Budget Template Service
 * Handles business logic for recurring budget templates
 */

export interface BudgetTemplate {
  id: string;
  name: string;
  description: string;
  budgetItems: Array<{
    name: string;
    amount: number;
    categoryIds: string[];
    color: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  totalAmount: number;
  isActive: boolean;
  frequency: 'monthly' | 'weekly' | 'biweekly' | 'quarterly' | 'yearly';
  nextApplicationDate: Date;
  createdAt: Date;
  lastApplied?: Date;
}

export interface RecurringSettings {
  autoApply: boolean;
  notificationDays: number;
  skipWeekends: boolean;
  rolloverUnspent: boolean;
}

export class BudgetTemplateService {
  /**
   * Calculate next application date based on frequency
   */
  calculateNextDate(frequency: string, skipWeekends: boolean = false): Date {
    const now = new Date();
    const next = new Date(now);
    
    switch (frequency) {
      case 'weekly':
        next.setDate(now.getDate() + 7);
        break;
      case 'biweekly':
        next.setDate(now.getDate() + 14);
        break;
      case 'monthly':
        next.setMonth(now.getMonth() + 1);
        break;
      case 'quarterly':
        next.setMonth(now.getMonth() + 3);
        break;
      case 'yearly':
        next.setFullYear(now.getFullYear() + 1);
        break;
      default:
        next.setMonth(now.getMonth() + 1);
    }
    
    // Skip weekends if enabled
    if (skipWeekends) {
      const day = next.getDay();
      if (day === 0) next.setDate(next.getDate() + 1); // Sunday -> Monday
      if (day === 6) next.setDate(next.getDate() + 2); // Saturday -> Monday
    }
    
    return next;
  }

  /**
   * Get frequency display text
   */
  getFrequencyText(frequency: string): string {
    switch (frequency) {
      case 'weekly': return 'Weekly';
      case 'biweekly': return 'Bi-weekly';
      case 'monthly': return 'Monthly';
      case 'quarterly': return 'Quarterly';
      case 'yearly': return 'Yearly';
      default: return 'Monthly';
    }
  }

  /**
   * Get status color classes for template
   */
  getStatusColor(template: BudgetTemplate, notificationDays: number): string {
    if (!template.isActive) return 'bg-gray-100 text-gray-800 border-gray-200';
    
    const now = new Date();
    const nextDate = new Date(template.nextApplicationDate);
    const daysUntil = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil <= notificationDays) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
    
    return 'bg-green-100 text-green-800 border-green-200';
  }

  /**
   * Get status text for template
   */
  getStatusText(template: BudgetTemplate, notificationDays: number): string {
    if (!template.isActive) return 'Inactive';
    
    const now = new Date();
    const nextDate = new Date(template.nextApplicationDate);
    const daysUntil = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil <= 0) return 'Ready to Apply';
    if (daysUntil <= notificationDays) return `Due in ${daysUntil} days`;
    
    return 'Active';
  }

  /**
   * Create a duplicate of template
   */
  duplicateTemplate(template: BudgetTemplate): BudgetTemplate {
    return {
      ...template,
      id: Date.now().toString(),
      name: `${template.name} (Copy)`,
      isActive: false,
      createdAt: new Date(),
      lastApplied: undefined
    };
  }
}

export const budgetTemplateService = new BudgetTemplateService();