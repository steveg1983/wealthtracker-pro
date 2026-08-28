export interface ImportRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number; // Lower number = higher priority
  conditions: ImportRuleCondition[];
  actions: ImportRuleAction[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ImportRuleCondition {
  field: 'description' | 'amount' | 'accountId' | 'date';
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan' | 'between' | 'regex';
  value: string | number;
  value2?: string | number; // For 'between' operator
  caseSensitive?: boolean;
}

export interface ImportRuleAction {
  type: 'setCategory' | 'addTag' | 'modifyDescription' | 'setAccount' | 'skip';
  value?: string;
  // For modifyDescription action
  modification?: 'replace' | 'prepend' | 'append' | 'regex';
  pattern?: string; // For regex replacement
  replacement?: string; // For regex replacement
}

export interface ImportRuleTest {
  description: string;
  amount: number;
  accountId?: string;
  date?: Date;
}
/**
 * The only fields the rules engine reads or writes.
 *
 * Declared here rather than reusing the app's `Transaction` because the engine
 * now runs on the SERVER too, inside a bank sync. Importing the app's type
 * barrel there dragged the DOM into a build that has none — `HTMLElement`,
 * `window`, `import.meta.env` — and failed the API's typecheck outright
 * (28 Aug). A rule cares about a description, an amount, an account, a date
 * and what it may set; that is the whole contract, and stating it plainly is
 * what lets one engine serve both editions and both runtimes.
 */
export interface RuleTarget {
  description?: string;
  amount?: number;
  accountId?: string;
  date?: Date | string;
  category?: string | null;
  categoryConfirmed?: boolean;
  tags?: string[];
}
