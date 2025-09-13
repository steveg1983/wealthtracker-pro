/**
 * Rule Engine Module
 * Manages notification rules and their evaluation
 */

import type { 
  NotificationRule, 
  NotificationCondition,
  NotificationAction,
  NotificationTemplate 
} from './types';
import type { Notification } from '../../contexts/NotificationContext';
import { logger } from '../loggingService';

export class RuleEngine {
  private rules: NotificationRule[] = [];
  private templates: NotificationTemplate[] = [];
  private cooldowns: Map<string, Date> = new Map();

  constructor() {
    this.loadRules();
    this.initializeTemplates();
  }

  /**
   * Load rules from storage
   */
  private loadRules(): void {
    try {
      const stored = localStorage.getItem('notification-rules');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.rules = parsed.map((r: any) => ({
          ...r,
          created: new Date(r.created),
          lastTriggered: r.lastTriggered ? new Date(r.lastTriggered) : undefined
        }));
      }
    } catch (error) {
      logger.error('Failed to load notification rules:', error);
    }
  }

  /**
   * Initialize default templates
   */
  private initializeTemplates(): void {
    this.templates = [
      {
        id: 'budget-warning',
        name: 'Budget Warning',
        type: 'budget',
        title: '⚠️ Budget Alert',
        messageTemplate: 'You\'ve used {{percentage}}% of your {{categoryName}} budget',
        icon: '⚠️',
        priority: 'medium',
        variables: ['percentage', 'categoryName', 'spent', 'budget']
      },
      {
        id: 'budget-exceeded',
        name: 'Budget Exceeded',
        type: 'budget',
        title: '🚨 Budget Exceeded',
        messageTemplate: 'You\'ve exceeded your {{categoryName}} budget by £{{overspend}}',
        icon: '🚨',
        priority: 'high',
        variables: ['categoryName', 'overspend', 'spent', 'budget']
      },
      {
        id: 'large-transaction',
        name: 'Large Transaction',
        type: 'transaction',
        title: '💰 Large Transaction',
        messageTemplate: 'Large {{type}} of £{{amount}} detected{{description}}',
        icon: '💰',
        priority: 'medium',
        variables: ['type', 'amount', 'description', 'category']
      },
      {
        id: 'goal-milestone',
        name: 'Goal Milestone',
        type: 'goal',
        title: '🎯 Goal Progress',
        messageTemplate: 'You\'re {{percentage}}% of the way to "{{goalName}}"!',
        icon: '🎯',
        priority: 'low',
        variables: ['percentage', 'goalName', 'currentAmount', 'targetAmount']
      }
    ];
  }

  /**
   * Add a new rule
   */
  addRule(rule: Omit<NotificationRule, 'id' | 'created'>): NotificationRule {
    const newRule: NotificationRule = {
      ...rule,
      id: `rule-${Date.now()}`,
      created: new Date()
    };
    
    this.rules.push(newRule);
    this.saveRules();
    
    return newRule;
  }

  /**
   * Update an existing rule
   */
  updateRule(id: string, updates: Partial<NotificationRule>): boolean {
    const index = this.rules.findIndex(r => r.id === id);
    if (index === -1) return false;
    
    this.rules[index] = {
      ...this.rules[index],
      ...updates,
      id: this.rules[index].id,
      created: this.rules[index].created
    };
    
    this.saveRules();
    return true;
  }

  /**
   * Delete a rule
   */
  deleteRule(id: string): boolean {
    const index = this.rules.findIndex(r => r.id === id);
    if (index === -1) return false;
    
    this.rules.splice(index, 1);
    this.saveRules();
    return true;
  }

  /**
   * Get all rules
   */
  getRules(): NotificationRule[] {
    return [...this.rules];
  }

  /**
   * Get rules by type
   */
  getRulesByType(type: NotificationRule['type']): NotificationRule[] {
    return this.rules.filter(r => r.type === type);
  }

  /**
   * Check if rule should trigger based on cooldown
   */
  shouldTriggerRule(rule: NotificationRule): boolean {
    if (!rule.enabled) return false;
    
    if (rule.cooldown && rule.lastTriggered) {
      const cooldownUntil = new Date(
        rule.lastTriggered.getTime() + rule.cooldown * 60 * 1000
      );
      
      if (new Date() < cooldownUntil) {
        return false;
      }
    }
    
    // Check global cooldown for this rule
    const globalCooldown = this.cooldowns.get(rule.id);
    if (globalCooldown && new Date() < globalCooldown) {
      return false;
    }
    
    return true;
  }

  /**
   * Evaluate conditions
   */
  evaluateConditions(
    conditions: NotificationCondition[],
    context: Record<string, any>
  ): boolean {
    return conditions.every(condition => {
      const value = context[condition.field];
      
      switch (condition.operator) {
        case 'equals':
          return value === condition.value;
        
        case 'greater_than':
          return Number(value) > Number(condition.value);
        
        case 'less_than':
          return Number(value) < Number(condition.value);
        
        case 'contains':
          return String(value).toLowerCase()
            .includes(String(condition.value).toLowerCase());
        
        case 'percentage_of':
          if (Array.isArray(condition.value) && condition.value.length === 2) {
            const [base, percentage] = condition.value;
            return Number(value) >= (Number(base) * Number(percentage) / 100);
          }
          return false;
        
        case 'date_range': {
          if (Array.isArray(condition.value) && condition.value.length === 2) {
            const [start, end] = condition.value as [unknown, unknown];
            const dateValue = new Date(value as any);
            const startDate = (typeof start === 'string' || typeof start === 'number' || start instanceof Date)
              ? new Date(start as any)
              : null;
            const endDate = (typeof end === 'string' || typeof end === 'number' || end instanceof Date)
              ? new Date(end as any)
              : null;
            if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
              return false;
            }
            return dateValue >= startDate && dateValue <= endDate;
          }
          return false;
        }
        
        default:
          return false;
      }
    });
  }

  /**
   * Execute rule actions
   */
  executeActions(
    rule: NotificationRule,
    context: Record<string, any>
  ): Notification | null {
    const notificationAction = rule.actions.find(
      a => a.type === 'show_notification'
    );
    
    if (!notificationAction) return null;
    
    // Replace template variables
    let message = notificationAction.config.message;
    let title = notificationAction.config.title;
    
    Object.keys(context).forEach(key => {
      const value = context[key];
      const formattedValue = typeof value === 'number' && key.includes('amount')
        ? value.toFixed(2)
        : String(value);
      
      message = message.replace(new RegExp(`{{${key}}}`, 'g'), formattedValue);
      title = title.replace(new RegExp(`{{${key}}}`, 'g'), formattedValue);
    });
    
    // Update last triggered time
    rule.lastTriggered = new Date();
    this.saveRules();
    
    // Set cooldown
    if (rule.cooldown) {
      const cooldownUntil = new Date(Date.now() + rule.cooldown * 60 * 1000);
      this.cooldowns.set(rule.id, cooldownUntil);
    }
    
    return {
      id: `${rule.id}-${Date.now()}`,
      type: this.mapPriorityToType(rule.priority),
      title,
      message,
      timestamp: new Date(),
      read: false,
      action: notificationAction.config.actionButton ? {
        label: notificationAction.config.actionButton.label,
        onClick: () => {
          window.location.href = notificationAction.config.actionButton!.action;
        }
      } : undefined
    };
  }

  /**
   * Map priority to notification type
   */
  private mapPriorityToType(
    priority: NotificationRule['priority']
  ): Notification['type'] {
    switch (priority) {
      case 'urgent':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
      default:
        return 'success';
    }
  }

  /**
   * Save rules to storage
   */
  private saveRules(): void {
    try {
      localStorage.setItem('notification-rules', JSON.stringify(this.rules));
    } catch (error) {
      logger.error('Failed to save notification rules:', error);
    }
  }

  /**
   * Get templates
   */
  getTemplates(): NotificationTemplate[] {
    return [...this.templates];
  }

  /**
   * Create rule from template
   */
  createRuleFromTemplate(
    templateId: string,
    customizations: {
      name: string;
      conditions: NotificationCondition[];
      enabled?: boolean;
      cooldown?: number;
    }
  ): NotificationRule | null {
    const template = this.templates.find(t => t.id === templateId);
    if (!template) return null;
    
    return this.addRule({
      name: customizations.name,
      type: template.type,
      enabled: customizations.enabled ?? true,
      conditions: customizations.conditions,
      actions: [{
        type: 'show_notification',
        config: {
          title: template.title,
          message: template.messageTemplate,
          icon: template.icon
        }
      }],
      priority: template.priority,
      cooldown: customizations.cooldown
    });
  }
}

export const ruleEngine = new RuleEngine();
