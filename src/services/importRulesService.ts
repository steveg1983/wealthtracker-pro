import type { ImportRule, ImportRuleCondition, ImportRuleAction, ImportRuleTest } from '../types/importRules';
import type { Transaction } from '../types';

interface TransactionWithSkip extends Partial<Transaction> {
  __skip?: boolean;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
type Logger = Pick<Console, 'error'>;
type NowFn = () => Date;

export interface ImportRulesServiceOptions {
  storage?: StorageLike | null;
  logger?: Logger;
  now?: NowFn;
}

export class ImportRulesService {
  private rules: ImportRule[] = [];
  private readonly storage: StorageLike | null;
  private readonly logger: Logger;
  private readonly nowProvider: NowFn;
  private readonly storageKey = 'wealthtracker_import_rules';

  constructor(options: ImportRulesServiceOptions = {}) {
    this.storage = options.storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    const fallbackLogger = typeof console !== 'undefined' ? console : undefined;
    this.logger = {
      error: options.logger?.error ?? (fallbackLogger?.error?.bind(fallbackLogger) ?? (() => {}))
    };
    this.nowProvider = options.now ?? (() => new Date());
    this.loadRules();
  }

  private loadRules(): void {
    if (!this.storage) {
      this.rules = [];
      return;
    }
    try {
      const saved = this.storage.getItem(this.storageKey);
      if (saved) {
        this.rules = JSON.parse(saved);
      }
    } catch (error) {
      this.logger.error('Error loading import rules:', error as Error);
      this.rules = [];
    }
  }

  private saveRules(): void {
    if (!this.storage) return;
    this.storage.setItem(this.storageKey, JSON.stringify(this.rules));
  }

  getRules(): ImportRule[] {
    return [...this.rules].sort((a, b) => a.priority - b.priority);
  }

  getRule(id: string): ImportRule | undefined {
    return this.rules.find(rule => rule.id === id);
  }

  addRule(rule: Omit<ImportRule, 'id' | 'createdAt' | 'updatedAt'>): ImportRule {
    const timestamp = this.nowProvider();
    const newRule: ImportRule = {
      ...rule,
      id: timestamp.getTime().toString(),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.rules.push(newRule);
    this.saveRules();
    return newRule;
  }

  updateRule(id: string, updates: Partial<Omit<ImportRule, 'id' | 'createdAt'>>): void {
    const index = this.rules.findIndex(rule => rule.id === id);
    if (index !== -1) {
      this.rules[index] = {
        ...this.rules[index],
        ...updates,
        updatedAt: this.nowProvider()
      };
      this.saveRules();
    }
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
      description: testData.description,
      amount: testData.amount,
      accountId: testData.accountId,
      date: testData.date || this.nowProvider()
    };

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
