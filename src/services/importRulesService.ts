import type { ImportRule, ImportRuleTest } from '../types/importRules';
import type { Transaction } from '../types';
import { applyRules, checkCondition } from './importRules/engine';

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

  /**
   * Re-point every "set category" action from one category to another, and
   * report how many rules changed.
   *
   * Rules are the third place a category id is stored (transactions and budgets
   * are the others), and the only one that lives in this browser rather than
   * the database — so a category merge cannot carry them along inside its
   * transaction. It calls this immediately afterwards instead: a rule left
   * pointing at a merged-away category would go on matching imports and file
   * them under an id that no longer exists, which is worse than either
   * outcome the merge offers.
   *
   * Nothing is written when no rule refers to `fromCategoryId`.
   */
  remapCategory(fromCategoryId: string, toCategoryId: string): number {
    if (!fromCategoryId || !toCategoryId || fromCategoryId === toCategoryId) {
      return 0;
    }

    let changed = 0;
    this.rules = this.rules.map(rule => {
      if (!rule.actions.some(a => a.type === 'setCategory' && a.value === fromCategoryId)) {
        return rule;
      }
      changed += 1;
      return {
        ...rule,
        actions: rule.actions.map(action =>
          action.type === 'setCategory' && action.value === fromCategoryId
            ? { ...action, value: toCategoryId }
            : action
        ),
        updatedAt: this.nowProvider()
      };
    });

    if (changed > 0) {
      this.saveRules();
    }
    return changed;
  }

  applyRules(transaction: Partial<Transaction>): Partial<Transaction> | null {
    return applyRules(transaction, this.rules);
  }

  testRule(rule: ImportRule, testData: ImportRuleTest): boolean {
    const transaction: Partial<Transaction> = {
      description: testData.description,
      amount: testData.amount,
      accountId: testData.accountId,
      date: testData.date || this.nowProvider()
    };

    return rule.conditions.every(condition => checkCondition(condition, transaction));
  }

  // Get suggested rules based on existing transactions
  suggestRules(transactions: Transaction[]): Partial<ImportRule>[] {
    const suggestions: Partial<ImportRule>[] = [];
    
    // Group transactions by common patterns
    const descriptionPatterns = new Map<string, { count: number; category?: string }>();
    
    transactions.forEach(t => {
      // A transfer is never the basis of a merchant rule. Its category names
      // the OTHER ACCOUNT, which is a fact about one movement, not a habit a
      // payee has — and a rule that stamped it on future imports would file
      // ordinary spending as half a transfer. (The rule editor's own picker
      // refuses transfer categories for the same reason; this stops one being
      // proposed to the user in the first place.)
      if (t.type === 'transfer') return;
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
