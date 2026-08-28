import type { ImportRule, ImportRuleTest } from '../types/importRules';
import type { Transaction } from '../types';
import { applyRules, checkCondition } from './importRules/engine';
import { isWellFormed } from './importRules/ruleShape';
import { defaultRulesStore, type RulesStore } from '@rules-store';

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

  /**
   * Where rules are kept beyond this browser — or `null`, meaning this machine
   * IS where they are kept.
   *
   * The seam answers, not this file: `@rules-store` resolves to the account in
   * the cloud build and to nothing in a desktop window, which is why a desktop
   * bundle contains no database client. `editions/rulesStore.ts` argues it.
   *
   * When there is a store it is the truth and this array is a cache of it.
   * Every consumer reads rules SYNCHRONOUSLY — the CSV importer applies them
   * inside a loop over thousands of rows — so the shape is: hydrate once, read
   * from memory, write through to both.
   */
  private hydrated = false;

  constructor(options: ImportRulesServiceOptions = {}) {
    this.storage = options.storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    const fallbackLogger = typeof console !== 'undefined' ? console : undefined;
    this.logger = {
      error: options.logger?.error ?? (fallbackLogger?.error?.bind(fallbackLogger) ?? (() => {}))
    };
    this.nowProvider = options.now ?? (() => new Date());
    this.loadRules();
  }

  /**
   * Load the rules that belong to whoever is signed in, carrying any that only
   * exist in this browser up into the store first.
   *
   * A no-op where there is no store, which is every desktop window and every
   * signed-out browser: rules then stay local, exactly as they always were.
   * Idempotent — the carry-over only fires when the store is empty and this
   * browser is not, so a second call after a good first is a plain read.
   */
  async hydrate(): Promise<void> {
    const store = defaultRulesStore();
    if (!store) return;

    try {
      let stored = await store.list();

      if (stored.length === 0 && this.rules.length > 0) {
        // Rules written before there was anywhere else to put them. These are
        // the owner's own work; losing them on the way past would be the worst
        // outcome this change could have. The local copy is LEFT where it is
        // rather than deleted — an upload that half-worked should be
        // repeatable — and anything malformed is reported, never dropped
        // silently.
        const carried = this.rules.filter(isWellFormed);
        const skipped = this.rules.length - carried.length;
        if (skipped > 0) {
          this.logger.error(
            `Import rules: ${skipped} local rule(s) were malformed and were not moved into your account`,
            new Error('malformed local import rules')
          );
        }
        for (const rule of carried) {
          await store.insert(rule);
        }
        stored = await store.list();
      }

      this.rules = stored;
      this.hydrated = true;
    } catch (error) {
      // Rules failing to load must never take an import down: without them an
      // import simply transforms nothing, which is the experience of someone
      // who has written no rules.
      this.logger.error('Could not load your rules:', error as Error);
    }
  }

  /** Whether the rules in memory came from a store rather than this browser. */
  isHydrated(): boolean {
    return this.hydrated;
  }

  /**
   * Write one change through to the store, if there is one.
   *
   * Failures are reported rather than thrown: the change is already in memory
   * and in localStorage, so the user's next import behaves as they expect —
   * but a rule that looks saved and is not is precisely what this move was
   * meant to end, so it must not pass in silence.
   */
  private persist(what: string, change: (store: RulesStore) => Promise<void>): void {
    const store = defaultRulesStore();
    if (!store || !this.hydrated) return;
    void change(store).catch(error =>
      this.logger.error(`Could not save ${what} to your account:`, error as Error)
    );
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
    // The store mints the real id. Swap it in when it arrives, so the next
    // edit or delete addresses the row that exists rather than the timestamp
    // this browser invented.
    this.persist('that rule', async store => {
      const saved = await store.insert(rule);
      const index = this.rules.findIndex(r => r.id === newRule.id);
      if (index !== -1) {
        this.rules[index] = saved;
        this.saveRules();
      }
    });
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
      this.persist('that change', store => store.update(id, updates));
    }
  }

  deleteRule(id: string): void {
    this.rules = this.rules.filter(rule => rule.id !== id);
    this.saveRules();
    this.persist('that deletion', store => store.remove(id));
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
      // A merge that moved a category has to move the rules pointing at it in
      // the store too, or the rule goes on filing imports under an id that no
      // longer exists — on every device, not just this one.
      for (const rule of this.rules) {
        if (rule.actions.some(a => a.type === 'setCategory' && a.value === toCategoryId)) {
          this.persist('that re-pointed rule', store => store.update(rule.id, { actions: rule.actions }));
        }
      }
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
