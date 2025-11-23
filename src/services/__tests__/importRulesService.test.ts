/**
 * ImportRulesService Tests
 * Tests for import rules service that manages rule-based transaction processing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ImportRulesService } from '../importRulesService';
import type { ImportRule } from '../../types/importRules';
import type { Transaction } from '../../types';

const createStorage = () => ({
  getItem: vi.fn(() => null),
  setItem: vi.fn()
});

describe('ImportRulesService', () => {
  let service: ImportRulesService;
  let mockRule: ImportRule;
  let storage: ReturnType<typeof createStorage>;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = createStorage();
    service = new ImportRulesService({
      storage,
      now: () => new Date('2025-01-20T00:00:00Z')
    });
    
    mockRule = {
      id: '1',
      name: 'Test Rule',
      description: 'Test rule description',
      enabled: true,
      priority: 1,
      conditions: [
        {
          field: 'description',
          operator: 'contains',
          value: 'AMAZON',
          caseSensitive: false
        }
      ],
      actions: [
        {
          type: 'setCategory',
          value: 'Shopping'
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('initializes with empty rules when no saved data', () => {
      const rules = service.getRules();
      expect(rules).toEqual([]);
    });

    it('loads rules from localStorage on initialization', () => {
      const savedRules = [mockRule];
      storage.getItem.mockReturnValue(JSON.stringify(savedRules));
      
      const newService = new ImportRulesService({ storage });
      const rules = newService.getRules();
      
      expect(storage.getItem).toHaveBeenCalledWith('wealthtracker_import_rules');
      expect(rules).toHaveLength(1);
      expect(rules[0].name).toBe('Test Rule');
    });

    it('handles corrupted localStorage data gracefully', () => {
      storage.getItem.mockReturnValue('invalid json');
      
      const newService = new ImportRulesService({ storage });
      const rules = newService.getRules();
      
      expect(rules).toEqual([]);
    });
  });

  describe('rule management', () => {
    it('adds new rule with generated ID and timestamps', () => {
      const ruleData = {
        name: 'New Rule',
        description: 'New rule description',
        enabled: true,
        priority: 1,
        conditions: [],
        actions: []
      };
      
      const addedRule = service.addRule(ruleData);
      
      expect(addedRule.id).toBeDefined();
      expect(addedRule.name).toBe('New Rule');
      expect(addedRule.createdAt).toBeInstanceOf(Date);
      expect(addedRule.updatedAt).toBeInstanceOf(Date);
      expect(storage.setItem).toHaveBeenCalled();
    });

    it('updates existing rule', () => {
      const addedRule = service.addRule(mockRule);
      
      service.updateRule(addedRule.id, {
        name: 'Updated Rule',
        enabled: false
      });
      
      const updatedRule = service.getRule(addedRule.id);
      expect(updatedRule?.name).toBe('Updated Rule');
      expect(updatedRule?.enabled).toBe(false);
      expect(updatedRule?.updatedAt).toBeInstanceOf(Date);
      expect(updatedRule?.createdAt).toEqual(addedRule.createdAt);
    });

    it('deletes rule by ID', () => {
      const addedRule = service.addRule(mockRule);
      
      service.deleteRule(addedRule.id);
      
      const rules = service.getRules();
      expect(rules).toHaveLength(0);
      expect(storage.setItem).toHaveBeenCalled();
    });

    it('gets rule by ID', () => {
      const addedRule = service.addRule(mockRule);
      
      const foundRule = service.getRule(addedRule.id);
      
      expect(foundRule).toBeDefined();
      expect(foundRule?.id).toBe(addedRule.id);
    });

    it('returns undefined for non-existent rule', () => {
      const foundRule = service.getRule('non-existent');
      
      expect(foundRule).toBeUndefined();
    });

    it('returns rules sorted by priority', () => {
      const rule1 = { ...mockRule, id: '1', priority: 3 };
      const rule2 = { ...mockRule, id: '2', priority: 1 };
      const rule3 = { ...mockRule, id: '3', priority: 2 };
      
      service.addRule(rule1);
      service.addRule(rule2);
      service.addRule(rule3);
      
      const rules = service.getRules();
      
      expect(rules[0].priority).toBe(1);
      expect(rules[1].priority).toBe(2);
      expect(rules[2].priority).toBe(3);
    });
  });

  describe('condition matching', () => {
    let transaction: Partial<Transaction>;

    beforeEach(() => {
      transaction = {
        description: 'AMAZON PURCHASE',
        amount: -50.00,
        accountId: 'acc1',
        date: new Date()
      };
    });

    it('matches contains condition (case insensitive)', () => {
      const rule: ImportRule = {
        ...mockRule,
        conditions: [
          {
            field: 'description',
            operator: 'contains',
            value: 'amazon',
            caseSensitive: false
          }
        ]
      };
      
      service.addRule(rule);
      const result = service.applyRules(transaction);
      
      expect(result?.category).toBe('Shopping');
    });

    it('matches contains condition (case sensitive)', () => {
      const rule: ImportRule = {
        ...mockRule,
        conditions: [
          {
            field: 'description',
            operator: 'contains',
            value: 'amazon',
            caseSensitive: true
          }
        ]
      };
      
      service.addRule(rule);
      const result = service.applyRules(transaction);
      
      expect(result?.category).toBeUndefined();
    });

    it('matches equals condition for amounts', () => {
      const rule: ImportRule = {
        ...mockRule,
        conditions: [
          {
            field: 'amount',
            operator: 'equals',
            value: 50.00,
            caseSensitive: false
          }
        ]
      };
      
      service.addRule(rule);
      const result = service.applyRules(transaction);
      
      expect(result?.category).toBe('Shopping');
    });

    it('matches startsWith condition', () => {
      const rule: ImportRule = {
        ...mockRule,
        conditions: [
          {
            field: 'description',
            operator: 'startsWith',
            value: 'AMAZON',
            caseSensitive: false
          }
        ]
      };
      
      service.addRule(rule);
      const result = service.applyRules(transaction);
      
      expect(result?.category).toBe('Shopping');
    });

    it('matches endsWith condition', () => {
      const rule: ImportRule = {
        ...mockRule,
        conditions: [
          {
            field: 'description',
            operator: 'endsWith',
            value: 'PURCHASE',
            caseSensitive: false
          }
        ]
      };
      
      service.addRule(rule);
      const result = service.applyRules(transaction);
      
      expect(result?.category).toBe('Shopping');
    });

    it('matches greaterThan condition', () => {
      const rule: ImportRule = {
        ...mockRule,
        conditions: [
          {
            field: 'amount',
            operator: 'greaterThan',
            value: 25.00,
            caseSensitive: false
          }
        ]
      };
      
      service.addRule(rule);
      const result = service.applyRules(transaction);
      
      expect(result?.category).toBe('Shopping');
    });

    it('matches lessThan condition', () => {
      const rule: ImportRule = {
        ...mockRule,
        conditions: [
          {
            field: 'amount',
            operator: 'lessThan',
            value: 75.00,
            caseSensitive: false
          }
        ]
      };
      
      service.addRule(rule);
      const result = service.applyRules(transaction);
      
      expect(result?.category).toBe('Shopping');
    });

    it('matches between condition', () => {
      const rule: ImportRule = {
        ...mockRule,
        conditions: [
          {
            field: 'amount',
            operator: 'between',
            value: 40.00,
            value2: 60.00,
            caseSensitive: false
          }
        ]
      };
      
      service.addRule(rule);
      const result = service.applyRules(transaction);
      
      expect(result?.category).toBe('Shopping');
    });

    it('matches regex condition', () => {
      const rule: ImportRule = {
        ...mockRule,
        conditions: [
          {
            field: 'description',
            operator: 'regex',
            value: '^AMAZON.*PURCHASE$',
            caseSensitive: false
          }
        ]
      };
      
      service.addRule(rule);
      const result = service.applyRules(transaction);
      
      expect(result?.category).toBe('Shopping');
    });

    it('handles invalid regex gracefully', () => {
      const rule: ImportRule = {
        ...mockRule,
        conditions: [
          {
            field: 'description',
            operator: 'regex',
            value: '[invalid regex',
            caseSensitive: false
          }
        ]
      };
      
      service.addRule(rule);
      const result = service.applyRules(transaction);
      
      expect(result?.category).toBeUndefined();
    });

    it('requires all conditions to match', () => {
      const rule: ImportRule = {
        ...mockRule,
        conditions: [
          {
            field: 'description',
            operator: 'contains',
            value: 'AMAZON',
            caseSensitive: false
          },
          {
            field: 'amount',
            operator: 'greaterThan',
            value: 100.00,
            caseSensitive: false
          }
        ]
      };
      
      service.addRule(rule);
      const result = service.applyRules(transaction);
      
      expect(result?.category).toBeUndefined(); // Amount condition fails
    });
  });

  describe('action application', () => {
    let transaction: Partial<Transaction>;
    let rule: ImportRule;

    beforeEach(() => {
      transaction = {
        description: 'AMAZON PURCHASE',
        amount: -50.00,
        accountId: 'acc1',
        date: new Date(),
        tags: []
      };

      rule = {
        ...mockRule,
        conditions: [
          {
            field: 'description',
            operator: 'contains',
            value: 'AMAZON',
            caseSensitive: false
          }
        ]
      };
    });

    it('applies setCategory action', () => {
      rule.actions = [
        {
          type: 'setCategory',
          value: 'Online Shopping'
        }
      ];
      
      service.addRule(rule);
      const result = service.applyRules(transaction);
      
      expect(result?.category).toBe('Online Shopping');
    });

    it('applies addTag action', () => {
      rule.actions = [
        {
          type: 'addTag',
          value: 'online'
        }
      ];
      
      service.addRule(rule);
      const result = service.applyRules(transaction);
      
      expect(result?.tags).toContain('online');
    });

    it('does not duplicate tags', () => {
      transaction.tags = ['online'];
      rule.actions = [
        {
          type: 'addTag',
          value: 'online'
        }
      ];
      
      service.addRule(rule);
      const result = service.applyRules(transaction);
      
      expect(result?.tags).toEqual(['online']);
    });

    it('applies modifyDescription replace action', () => {
      rule.actions = [
        {
          type: 'modifyDescription',
          modification: 'replace',
          value: 'Amazon Purchase'
        }
      ];
      
      service.addRule(rule);
      const result = service.applyRules(transaction);
      
      expect(result?.description).toBe('Amazon Purchase');
    });

    it('applies modifyDescription prepend action', () => {
      rule.actions = [
        {
          type: 'modifyDescription',
          modification: 'prepend',
          value: 'Online: '
        }
      ];
      
      service.addRule(rule);
      const result = service.applyRules(transaction);
      
      expect(result?.description).toBe('Online: AMAZON PURCHASE');
    });

    it('applies modifyDescription append action', () => {
      rule.actions = [
        {
          type: 'modifyDescription',
          modification: 'append',
          value: ' - Shopping'
        }
      ];
      
      service.addRule(rule);
      const result = service.applyRules(transaction);
      
      expect(result?.description).toBe('AMAZON PURCHASE - Shopping');
    });

    it('applies modifyDescription regex action', () => {
      rule.actions = [
        {
          type: 'modifyDescription',
          modification: 'regex',
          pattern: 'AMAZON',
          replacement: 'Amazon'
        }
      ];
      
      service.addRule(rule);
      const result = service.applyRules(transaction);
      
      expect(result?.description).toBe('Amazon PURCHASE');
    });

    it('handles invalid regex in modifyDescription', () => {
      rule.actions = [
        {
          type: 'modifyDescription',
          modification: 'regex',
          pattern: '[invalid',
          replacement: 'Amazon'
        }
      ];
      
      service.addRule(rule);
      const result = service.applyRules(transaction);
      
      expect(result?.description).toBe('AMAZON PURCHASE'); // Unchanged
    });

    it('applies setAccount action', () => {
      rule.actions = [
        {
          type: 'setAccount',
          value: 'acc2'
        }
      ];
      
      service.addRule(rule);
      const result = service.applyRules(transaction);
      
      expect(result?.accountId).toBe('acc2');
    });

    it('applies skip action', () => {
      rule.actions = [
        {
          type: 'skip'
        }
      ];
      
      service.addRule(rule);
      const result = service.applyRules(transaction);
      
      expect(result).toBeNull();
    });

    it('applies multiple actions in sequence', () => {
      rule.actions = [
        {
          type: 'setCategory',
          value: 'Shopping'
        },
        {
          type: 'addTag',
          value: 'online'
        },
        {
          type: 'modifyDescription',
          modification: 'prepend',
          value: 'Online: '
        }
      ];
      
      service.addRule(rule);
      const result = service.applyRules(transaction);
      
      expect(result?.category).toBe('Shopping');
      expect(result?.tags).toContain('online');
      expect(result?.description).toBe('Online: AMAZON PURCHASE');
    });
  });

  describe('rule processing', () => {
    it('processes rules in priority order', () => {
      const rule1: ImportRule = {
        ...mockRule,
        id: '1',
        priority: 2,
        actions: [{ type: 'setCategory', value: 'Category1' }]
      };
      
      const rule2: ImportRule = {
        ...mockRule,
        id: '2',
        priority: 1,
        actions: [{ type: 'setCategory', value: 'Category2' }]
      };
      
      service.addRule(rule1);
      service.addRule(rule2);
      
      const transaction = { description: 'AMAZON PURCHASE', amount: -50 };
      const result = service.applyRules(transaction);
      
      // Rule2 should apply first (priority 1), but rule1 should overwrite (priority 2)
      expect(result?.category).toBe('Category1');
    });

    it('skips disabled rules', () => {
      const rule: ImportRule = {
        ...mockRule,
        enabled: false
      };
      
      service.addRule(rule);
      
      const transaction = { description: 'AMAZON PURCHASE', amount: -50 };
      const result = service.applyRules(transaction);
      
      expect(result?.category).toBeUndefined();
    });

    it('stops processing after skip action', () => {
      const rule1: ImportRule = {
        ...mockRule,
        id: '1',
        priority: 1,
        actions: [{ type: 'skip' }]
      };
      
      const rule2: ImportRule = {
        ...mockRule,
        id: '2',
        priority: 2,
        actions: [{ type: 'setCategory', value: 'Category2' }]
      };
      
      service.addRule(rule1);
      service.addRule(rule2);
      
      const transaction = { description: 'AMAZON PURCHASE', amount: -50 };
      const result = service.applyRules(transaction);
      
      expect(result).toBeNull(); // Should be skipped
    });
  });

  describe('rule testing', () => {
    it('tests rule against sample data', () => {
      const rule: ImportRule = {
        ...mockRule,
        conditions: [
          {
            field: 'description',
            operator: 'contains',
            value: 'AMAZON',
            caseSensitive: false
          }
        ]
      };
      
      const testData = {
        description: 'AMAZON PURCHASE',
        amount: -50.00,
        accountId: 'acc1'
      };
      
      const matches = service.testRule(rule, testData);
      
      expect(matches).toBe(true);
    });

    it('returns false for non-matching test data', () => {
      const rule: ImportRule = {
        ...mockRule,
        conditions: [
          {
            field: 'description',
            operator: 'contains',
            value: 'WALMART',
            caseSensitive: false
          }
        ]
      };
      
      const testData = {
        description: 'AMAZON PURCHASE',
        amount: -50.00,
        accountId: 'acc1'
      };
      
      const matches = service.testRule(rule, testData);
      
      expect(matches).toBe(false);
    });
  });

  describe('rule suggestions', () => {
    it('suggests rules based on transaction patterns', () => {
      const transactions: Transaction[] = [
        {
          id: '1',
          description: 'STARBUCKS COFFEE',
          amount: -5.50,
          accountId: 'acc1',
          date: new Date(),
          category: 'Food & Dining'
        },
        {
          id: '2',
          description: 'STARBUCKS COFFEE',
          amount: -4.75,
          accountId: 'acc1',
          date: new Date(),
          category: 'Food & Dining'
        },
        {
          id: '3',
          description: 'STARBUCKS COFFEE',
          amount: -6.00,
          accountId: 'acc1',
          date: new Date(),
          category: 'Food & Dining'
        }
      ];
      
      const suggestions = service.suggestRules(transactions);
      
      expect(suggestions.length).toBeGreaterThan(0);
      const starbucksRule = suggestions.find(s => s.name?.includes('starbucks'));
      expect(starbucksRule).toBeDefined();
      expect(starbucksRule?.actions?.[0].value).toBe('Food & Dining');
    });

    it('only suggests for patterns with 3+ occurrences', () => {
      const transactions: Transaction[] = [
        {
          id: '1',
          description: 'RARE MERCHANT',
          amount: -10.00,
          accountId: 'acc1',
          date: new Date(),
          category: 'Shopping'
        },
        {
          id: '2',
          description: 'RARE MERCHANT',
          amount: -15.00,
          accountId: 'acc1',
          date: new Date(),
          category: 'Shopping'
        }
      ];
      
      const suggestions = service.suggestRules(transactions);
      
      expect(suggestions.length).toBe(0);
    });

    it('limits suggestions to top 10', () => {
      const transactions: Transaction[] = [];
      
      // Create 15 different merchant patterns with 3+ transactions each
      for (let i = 0; i < 15; i++) {
        for (let j = 0; j < 3; j++) {
          transactions.push({
            id: `${i}-${j}`,
            description: `MERCHANT${i} STORE`,
            amount: -10.00,
            accountId: 'acc1',
            date: new Date(),
            category: 'Shopping'
          });
        }
      }
      
      const suggestions = service.suggestRules(transactions);
      
      expect(suggestions.length).toBe(10);
    });
  });

  describe('edge cases', () => {
    it('handles null/undefined transaction fields', () => {
      const rule: ImportRule = {
        ...mockRule,
        conditions: [
          {
            field: 'description',
            operator: 'contains',
            value: 'test',
            caseSensitive: false
          }
        ]
      };
      
      service.addRule(rule);
      
      const transaction = {
        description: null,
        amount: undefined,
        accountId: '',
        date: null
      };
      
      const result = service.applyRules(transaction);
      
      expect(result?.category).toBeUndefined();
    });

    it('handles empty conditions array', () => {
      const rule: ImportRule = {
        ...mockRule,
        conditions: []
      };
      
      service.addRule(rule);
      
      const transaction = { description: 'TEST', amount: -10 };
      const result = service.applyRules(transaction);
      
      expect(result?.category).toBe('Shopping'); // Should match (no conditions)
    });

    it('handles empty actions array', () => {
      const rule: ImportRule = {
        ...mockRule,
        actions: []
      };
      
      service.addRule(rule);
      
      const transaction = { description: 'AMAZON PURCHASE', amount: -10 };
      const result = service.applyRules(transaction);
      
      expect(result).toEqual(transaction); // Should be unchanged
    });
  });
});
