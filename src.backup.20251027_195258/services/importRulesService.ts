import type { ImportRule, ImportRuleCondition, ImportRuleAction, ImportRuleTest } from '../types/importRules';
import type { Transaction } from '../types';
import { logger } from './loggingService';

interface TransactionWithSkip extends Partial<Transaction> {
  __skip?: boolean;
}

export class ImportRulesService {
  private rules: ImportRule[] = [];

  constructor() {
    this.loadRules();
  }

  private loadRules(): void {
    try {
      const saved = localStorage.getItem('wealthtracker_import_rules');
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        this.rules = Array.isArray(parsed)
          ? parsed.map(rule => this.normalizeRule(rule))
          : [];
      }
    } catch (error) {
      logger.error('Error loading import rules:', error);
      this.rules = [];
    }
  }

  private saveRules(): void {
    localStorage.setItem('wealthtracker_import_rules', JSON.stringify(this.rules));
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private normalizeRule(raw: unknown): ImportRule {
    const candidate = this.toRecord(raw);
    const conditions = this.normalizeConditions(candidate.conditions);
    const actions = this.normalizeActions(candidate.actions);

    const normalized: ImportRule = {
      id: typeof candidate.id === 'string' ? candidate.id : this.generateId(),
      name:
        typeof candidate.name === 'string' && candidate.name.trim().length > 0
          ? candidate.name
          : 'Untitled rule',
      description: typeof candidate.description === 'string' ? candidate.description : undefined,
      enabled: typeof candidate.enabled === 'boolean' ? candidate.enabled : true,
      priority: typeof candidate.priority === 'number' ? candidate.priority : 1,
      conditions,
      actions,
      createdAt: candidate.createdAt ? new Date(candidate.createdAt as string | number | Date) : new Date(),
      updatedAt: candidate.updatedAt ? new Date(candidate.updatedAt as string | number | Date) : new Date()
    };

    return normalized;
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private normalizeConditions(rawConditions: unknown): ImportRuleCondition[] {
    if (!Array.isArray(rawConditions)) {
      return [];
    }

    const validFields: ImportRuleCondition['field'][] = ['description', 'amount', 'accountId', 'date'];
    const validOperators: ImportRuleCondition['operator'][] = [
      'contains',
      'equals',
      'startsWith',
      'endsWith',
      'greaterThan',
      'lessThan',
      'between',
      'regex'
    ];

    return rawConditions.flatMap((condition) => {
      if (!condition || typeof condition !== 'object') {
        return [];
      }

      const candidate = condition as Record<string, unknown>;
      if (!condition) {
        return [];
      }

      const field = candidate.field;
      if (!validFields.includes(field)) {
        return [];
      }

      const operator = candidate.operator;
      if (!validOperators.includes(operator)) {
        return [];
      }

      const primaryValue = this.normalizeConditionValue(field, candidate.value);
      if (primaryValue === null) {
        return [];
      }

      const normalized: ImportRuleCondition = {
        field,
        operator,
        value: primaryValue,
        caseSensitive: typeof candidate.caseSensitive === 'boolean' ? candidate.caseSensitive : undefined
      };

      if (operator === 'between') {
        const secondary = this.normalizeConditionValue(field, candidate.value2);
        if (secondary !== null) {
          normalized.value2 = secondary;
        }
      }

      if (normalized.caseSensitive === undefined) {
        delete normalized.caseSensitive;
      }

      return [normalized];
    });
  }

  private normalizeConditionValue(
    field: ImportRuleCondition['field'],
    rawValue: unknown
  ): string | number | null {
    if (rawValue === null || rawValue === undefined) {
      return null;
    }

    switch (field) {
      case 'amount':
        if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
          return rawValue;
        }
        if (typeof rawValue === 'string') {
          const parsed = Number(rawValue);
          return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
      case 'date':
        if (rawValue instanceof Date) {
          return rawValue.getTime();
        }
        if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
          return rawValue;
        }
        if (typeof rawValue === 'string') {
          const timestamp = Date.parse(rawValue);
          return Number.isFinite(timestamp) ? timestamp : null;
        }
        return null;
      case 'accountId':
      case 'description':
      default:
        if (typeof rawValue === 'string') {
          return rawValue;
        }
        return String(rawValue);
    }
  }

  private normalizeActions(rawActions: unknown): ImportRuleAction[] {
    if (!Array.isArray(rawActions)) {
      return [];
    }

    const validTypes: ImportRuleAction['type'][] = [
      'setCategory',
      'addTag',
      'modifyDescription',
      'setAccount',
      'skip'
    ];

    return rawActions.flatMap((action) => {
      if (!action || typeof action !== 'object') {
        return [];
      }

      const candidate = action as Record<string, unknown>;

      if (!validTypes.includes(candidate.type as ImportRuleAction['type'])) {
        return [];
      }

      const normalized: ImportRuleAction = {
        type: candidate.type as ImportRuleAction['type']
      };

      if (typeof candidate.value === 'string' && candidate.value.length > 0) {
        normalized.value = candidate.value;
      } else if (candidate.value !== undefined && candidate.value !== null) {
        normalized.value = String(candidate.value);
      }

      if (normalized.type === 'modifyDescription') {
        const allowedModifications: Array<NonNullable<ImportRuleAction['modification']>> = [
          'replace',
          'prepend',
          'append',
          'regex'
        ];
        if (allowedModifications.includes(candidate.modification as NonNullable<ImportRuleAction['modification']>)) {
          normalized.modification = candidate.modification as NonNullable<ImportRuleAction['modification']>;
        }
        if (typeof candidate.pattern === 'string' && candidate.pattern.length > 0) {
          normalized.pattern = candidate.pattern;
        }
        if (typeof candidate.replacement === 'string') {
          normalized.replacement = candidate.replacement;
        }
      }

      if (normalized.modification === undefined) {
        delete normalized.modification;
      }
      if (normalized.pattern === undefined) {
        delete normalized.pattern;
      }
      if (normalized.replacement === undefined) {
        delete normalized.replacement;
      }

      if (normalized.value === undefined) {
        delete normalized.value;
      }

      return [normalized];
    });
  }

  private sanitizeRuleUpdates(
    updates: Partial<Omit<ImportRule, 'id' | 'createdAt'>>
  ): Partial<Omit<ImportRule, 'id' | 'createdAt'>> {
    const sanitized: Partial<Omit<ImportRule, 'id' | 'createdAt'>> = {};

    if ('name' in updates && updates.name !== undefined) {
      sanitized.name = updates.name;
    }

    if ('description' in updates && updates.description !== undefined) {
      sanitized.description = updates.description;
    }

    if ('enabled' in updates && updates.enabled !== undefined) {
      sanitized.enabled = updates.enabled;
    }

    if ('priority' in updates && updates.priority !== undefined) {
      sanitized.priority = updates.priority;
    }

    if ('conditions' in updates && updates.conditions !== undefined) {
      sanitized.conditions = this.normalizeConditions(updates.conditions);
    }

    if ('actions' in updates && updates.actions !== undefined) {
      sanitized.actions = this.normalizeActions(updates.actions);
    }

    return sanitized;
  }

  getRules(): ImportRule[] {
    return [...this.rules].sort((a, b) => a.priority - b.priority);
  }

  getRule(id: string): ImportRule | undefined {
    return this.rules.find(rule => rule.id === id);
  }

  addRule(rule: Omit<ImportRule, 'id' | 'createdAt' | 'updatedAt'>): ImportRule {
    const newRule = this.normalizeRule({
      ...rule,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    } satisfies Partial<ImportRule>);
    this.rules.push(newRule);
    this.saveRules();
    return newRule;
  }

  updateRule(id: string, updates: Partial<Omit<ImportRule, 'id' | 'createdAt'>>): void {
    const index = this.rules.findIndex(rule => rule.id === id);
    if (index === -1) {
      return;
    }

    const current = this.rules[index];
    if (!current) {
      return;
    }

    const sanitizedUpdates = this.sanitizeRuleUpdates(updates);
    this.rules[index] = {
      ...current,
      ...sanitizedUpdates,
      updatedAt: new Date()
    };
    this.saveRules();
  }

  deleteRule(id: string): void {
    this.rules = this.rules.filter(rule => rule.id !== id);
    this.saveRules();
  }

  private checkCondition(condition: ImportRuleCondition, transaction: Partial<Transaction>): boolean {
    let fieldValue: string | number | Date | null;
    
    switch (condition.field) {
      case 'description':
        fieldValue = transaction.description || '';
        break;
      case 'amount':
        fieldValue = Math.abs(transaction.amount || 0);
        break;
      case 'accountId':
        fieldValue = transaction.accountId || '';
        break;
      case 'date':
        fieldValue = transaction.date ? new Date(transaction.date) : null;
        break;
    }

    if (fieldValue === null || fieldValue === undefined) return false;

    switch (condition.operator) {
      case 'contains':
        if (typeof fieldValue !== 'string') return false;
        return condition.caseSensitive 
          ? fieldValue.includes(condition.value as string)
          : fieldValue.toLowerCase().includes((condition.value as string).toLowerCase());
      
      case 'equals':
        if (condition.field === 'amount' && typeof fieldValue === 'number') {
          return Math.abs(fieldValue - (condition.value as number)) < 0.01;
        }
        return condition.caseSensitive
          ? fieldValue === condition.value
          : fieldValue.toString().toLowerCase() === condition.value.toString().toLowerCase();
      
      case 'startsWith':
        if (typeof fieldValue !== 'string') return false;
        return condition.caseSensitive
          ? fieldValue.startsWith(condition.value as string)
          : fieldValue.toLowerCase().startsWith((condition.value as string).toLowerCase());
      
      case 'endsWith':
        if (typeof fieldValue !== 'string') return false;
        return condition.caseSensitive
          ? fieldValue.endsWith(condition.value as string)
          : fieldValue.toLowerCase().endsWith((condition.value as string).toLowerCase());
      
      case 'greaterThan':
        if (typeof fieldValue !== 'number') return false;
        return fieldValue > (condition.value as number);
      
      case 'lessThan':
        if (typeof fieldValue !== 'number') return false;
        return fieldValue < (condition.value as number);
      
      case 'between':
        if (typeof fieldValue !== 'number') return false;
        return fieldValue >= (condition.value as number) && 
               fieldValue <= (condition.value2 as number);
      
      case 'regex':
        if (typeof fieldValue !== 'string') return false;
        try {
          const regex = new RegExp(condition.value as string, condition.caseSensitive ? '' : 'i');
          return regex.test(fieldValue);
        } catch {
          return false;
        }
      
      default:
        return false;
    }
  }

  private applyAction(action: ImportRuleAction, transaction: Partial<Transaction>): TransactionWithSkip {
    const result: TransactionWithSkip = { ...transaction };

    switch (action.type) {
      case 'setCategory':
        if (action.value) {
          result.category = action.value;
        }
        break;
      
      case 'addTag':
        if (action.value) {
          result.tags = result.tags || [];
          if (!result.tags.includes(action.value)) {
            result.tags.push(action.value);
          }
        }
        break;
      
      case 'modifyDescription':
        if (result.description && action.modification) {
          switch (action.modification) {
            case 'replace':
              result.description = action.value || '';
              break;
            case 'prepend':
              result.description = (action.value || '') + result.description;
              break;
            case 'append':
              result.description = result.description + (action.value || '');
              break;
            case 'regex':
              if (action.pattern) {
                try {
                  const regex = new RegExp(action.pattern, 'g');
                  result.description = result.description.replace(regex, action.replacement || '');
                } catch {
                  // Invalid regex, skip
                }
              }
              break;
          }
        }
        break;
      
      case 'setAccount':
        if (action.value) {
          result.accountId = action.value;
        }
        break;
      
      case 'skip':
        // Mark transaction to be skipped
        result.__skip = true;
        break;
    }

    return result;
  }

  applyRules(transaction: Partial<Transaction>): Partial<Transaction> | null {
    let result: TransactionWithSkip = { ...transaction };
    const enabledRules = this.rules
      .filter(rule => rule.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const rule of enabledRules) {
      // Check if all conditions match
      const allConditionsMatch = rule.conditions.every(condition => 
        this.checkCondition(condition, result)
      );

      if (allConditionsMatch) {
        // Apply all actions
        for (const action of rule.actions) {
          result = this.applyAction(action, result);
          
          // If transaction should be skipped, return null
          if (result.__skip) {
            return null;
          }
        }
      }
    }

    // Remove temporary skip flag if it exists
    delete result.__skip;
    return result;
  }

  testRule(rule: ImportRule, testData: ImportRuleTest): boolean {
    const transaction: Partial<Transaction> = {
      date: testData.date ? new Date(testData.date) : new Date()
    };

    if (typeof testData.description === 'string') {
      transaction.description = testData.description;
    }

    if (typeof testData.amount === 'number') {
      transaction.amount = testData.amount;
    }

    if (typeof testData.accountId === 'string' && testData.accountId.length > 0) {
      transaction.accountId = testData.accountId;
    }

    return rule.conditions.every(condition => 
      this.checkCondition(condition, transaction)
    );
  }

  // Get suggested rules based on existing transactions
  suggestRules(transactions: Transaction[]): Partial<ImportRule>[] {
    const suggestions: Partial<ImportRule>[] = [];
    
    // Group transactions by common patterns
    const descriptionPatterns = new Map<string, { count: number; category?: string }>();
    
    transactions.forEach(t => {
      if (!t.description) {
        return;
      }

      const words = t.description.toLowerCase().split(/\s+/);
      
      // Look for merchant names (first 2-3 words)
      const merchantKey = words.slice(0, 2).join(' ');
      if (merchantKey.length > 3) {
        const existing = descriptionPatterns.get(merchantKey) || { count: 0 };
        existing.count++;
        if (t.category && (!existing.category || existing.count === 1)) {
          existing.category = t.category;
        }
        descriptionPatterns.set(merchantKey, existing);
      }
    });

    // Create suggestions for frequently occurring patterns
    descriptionPatterns.forEach((data, pattern) => {
      if (data.count >= 3 && data.category) {
        suggestions.push({
          name: `Auto-categorize "${pattern}"`,
          description: `Automatically categorize transactions containing "${pattern}"`,
          enabled: true,
          priority: suggestions.length + 1,
          conditions: [{
            field: 'description',
            operator: 'contains',
            value: pattern,
            caseSensitive: false
          }],
          actions: [{
            type: 'setCategory',
            value: data.category
          }]
        });
      }
    });

    return suggestions.slice(0, 10); // Return top 10 suggestions
  }
}

export const importRulesService = new ImportRulesService();
