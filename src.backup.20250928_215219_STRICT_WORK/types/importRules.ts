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