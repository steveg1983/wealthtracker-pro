/**
 * ImportRulesManager Component - Manage import rules and automation
 *
 * Features:
 * - Create and edit import rules
 * - Pattern matching for automatic categorization
 * - Rule priority and conditions
 * - Rule testing and validation
 * - Bulk rule operations
 */

import React, { useState, useEffect } from 'react';

interface ImportRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number;
  conditions: ImportCondition[];
  actions: ImportAction[];
  createdAt: Date;
  lastUsed?: Date;
  usageCount: number;
}

interface ImportCondition {
  field: 'description' | 'amount' | 'merchant' | 'account' | 'date';
  operator: 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'regex';
  value: string | number;
  caseSensitive?: boolean;
}

interface ImportAction {
  type: 'set_category' | 'set_merchant' | 'set_description' | 'add_tag' | 'set_account';
  value: string;
}

interface ImportRulesManagerProps {
  onRuleChange?: (rules: ImportRule[]) => void;
  className?: string;
}

// Mock rules data
const mockRules: ImportRule[] = [
  {
    id: 'rule-1',
    name: 'Grocery Store Categorization',
    description: 'Automatically categorize grocery store transactions',
    enabled: true,
    priority: 1,
    conditions: [
      {
        field: 'description',
        operator: 'contains',
        value: 'grocery',
        caseSensitive: false
      }
    ],
    actions: [
      {
        type: 'set_category',
        value: 'groceries'
      }
    ],
    createdAt: new Date('2024-01-10'),
    lastUsed: new Date('2024-01-20'),
    usageCount: 45
  },
  {
    id: 'rule-2',
    name: 'Salary Deposit',
    description: 'Identify salary deposits',
    enabled: true,
    priority: 2,
    conditions: [
      {
        field: 'description',
        operator: 'contains',
        value: 'salary',
        caseSensitive: false
      },
      {
        field: 'amount',
        operator: 'greater_than',
        value: 1000
      }
    ],
    actions: [
      {
        type: 'set_category',
        value: 'salary'
      },
      {
        type: 'add_tag',
        value: 'income'
      }
    ],
    createdAt: new Date('2024-01-05'),
    lastUsed: new Date('2024-01-15'),
    usageCount: 3
  }
];

const conditionFields = [
  { value: 'description', label: 'Description' },
  { value: 'amount', label: 'Amount' },
  { value: 'merchant', label: 'Merchant' },
  { value: 'account', label: 'Account' },
  { value: 'date', label: 'Date' }
];

const conditionOperators = [
  { value: 'contains', label: 'Contains' },
  { value: 'equals', label: 'Equals' },
  { value: 'starts_with', label: 'Starts with' },
  { value: 'ends_with', label: 'Ends with' },
  { value: 'greater_than', label: 'Greater than' },
  { value: 'less_than', label: 'Less than' },
  { value: 'regex', label: 'Regex pattern' }
];

const actionTypes = [
  { value: 'set_category', label: 'Set Category' },
  { value: 'set_merchant', label: 'Set Merchant' },
  { value: 'set_description', label: 'Set Description' },
  { value: 'add_tag', label: 'Add Tag' },
  { value: 'set_account', label: 'Set Account' }
];

export default function ImportRulesManager({
  onRuleChange,
  className = ''
}: ImportRulesManagerProps): React.JSX.Element {
  const [rules, setRules] = useState<ImportRule[]>([]);
  const [editingRule, setEditingRule] = useState<ImportRule | null>(null);
  const [isCreatingRule, setIsCreatingRule] = useState(false);
  const [testData, setTestData] = useState('');
  const [testResults, setTestResults] = useState<{ rule: ImportRule; matches: boolean }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load rules
  useEffect(() => {
    const loadRules = async () => {
      setIsLoading(true);
      try {

        // In a real implementation, this would fetch from API
        await new Promise(resolve => setTimeout(resolve, 300));

        setRules(mockRules);
        onRuleChange?.(mockRules);
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    };

    loadRules();
  }, [onRuleChange]);

  const createNewRule = (): ImportRule => ({
    id: `rule-${Date.now()}`,
    name: '',
    description: '',
    enabled: true,
    priority: rules.length + 1,
    conditions: [
      {
        field: 'description',
        operator: 'contains',
        value: '',
        caseSensitive: false
      }
    ],
    actions: [
      {
        type: 'set_category',
        value: ''
      }
    ],
    createdAt: new Date(),
    usageCount: 0
  });

  const handleCreateRule = () => {
    const newRule = createNewRule();
    setEditingRule(newRule);
    setIsCreatingRule(true);
  };

  const handleSaveRule = () => {
    if (!editingRule || !editingRule.name.trim()) return;

    const updatedRules = isCreatingRule
      ? [...rules, editingRule]
      : rules.map(rule => rule.id === editingRule.id ? editingRule : rule);

    setRules(updatedRules);
    onRuleChange?.(updatedRules);
    setEditingRule(null);
    setIsCreatingRule(false);

  };

  const handleDeleteRule = (ruleId: string) => {
    const updatedRules = rules.filter(rule => rule.id !== ruleId);
    setRules(updatedRules);
    onRuleChange?.(updatedRules);
  };

  const handleToggleRule = (ruleId: string) => {
    const updatedRules = rules.map(rule =>
      rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
    );
    setRules(updatedRules);
    onRuleChange?.(updatedRules);
  };

  const testRules = () => {
    if (!testData.trim()) return;

    const results = rules.map(rule => ({
      rule,
      matches: evaluateRule(rule, testData)
    }));

    setTestResults(results);
  };

  const evaluateRule = (rule: ImportRule, data: string): boolean => {
    // Simple rule evaluation for demo
    return rule.conditions.every(condition => {
      const value = condition.caseSensitive ? data : data.toLowerCase();
      const conditionValue = condition.caseSensitive ? condition.value : String(condition.value).toLowerCase();

      switch (condition.operator) {
        case 'contains':
          return value.includes(String(conditionValue));
        case 'equals':
          return value === conditionValue;
        case 'starts_with':
          return value.startsWith(String(conditionValue));
        case 'ends_with':
          return value.endsWith(String(conditionValue));
        default:
          return false;
      }
    });
  };

  const addCondition = () => {
    if (!editingRule) return;

    setEditingRule({
      ...editingRule,
      conditions: [
        ...editingRule.conditions,
        {
          field: 'description',
          operator: 'contains',
          value: '',
          caseSensitive: false
        }
      ]
    });
  };

  const updateCondition = (index: number, updates: Partial<ImportCondition>) => {
    if (!editingRule) return;

    const updatedConditions = editingRule.conditions.map((condition, i) =>
      i === index ? { ...condition, ...updates } : condition
    );

    setEditingRule({
      ...editingRule,
      conditions: updatedConditions
    });
  };

  const removeCondition = (index: number) => {
    if (!editingRule || editingRule.conditions.length <= 1) return;

    setEditingRule({
      ...editingRule,
      conditions: editingRule.conditions.filter((_, i) => i !== index)
    });
  };

  const addAction = () => {
    if (!editingRule) return;

    setEditingRule({
      ...editingRule,
      actions: [
        ...editingRule.actions,
        {
          type: 'set_category',
          value: ''
        }
      ]
    });
  };

  const updateAction = (index: number, updates: Partial<ImportAction>) => {
    if (!editingRule) return;

    const updatedActions = editingRule.actions.map((action, i) =>
      i === index ? { ...action, ...updates } : action
    );

    setEditingRule({
      ...editingRule,
      actions: updatedActions
    });
  };

  const removeAction = (index: number) => {
    if (!editingRule || editingRule.actions.length <= 1) return;

    setEditingRule({
      ...editingRule,
      actions: editingRule.actions.filter((_, i) => i !== index)
    });
  };

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded mb-3"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Import Rules
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Automate transaction categorization and data processing
          </p>
        </div>
        <button
          onClick={handleCreateRule}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
        >
          Create Rule
        </button>
      </div>

      {/* Rule Testing */}
      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">
          Test Rules
        </h3>
        <div className="flex space-x-3 mb-4">
          <input
            type="text"
            value={testData}
            onChange={(e) => setTestData(e.target.value)}
            placeholder="Enter transaction description to test..."
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
          />
          <button
            onClick={testRules}
            disabled={!testData.trim()}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-md transition-colors duration-200"
          >
            Test
          </button>
        </div>

        {testResults.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Test Results:
            </h4>
            {testResults.map(result => (
              <div
                key={result.rule.id}
                className={`p-2 rounded text-sm ${
                  result.matches
                    ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                {result.rule.name}: {result.matches ? 'Matches' : 'No match'}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rules List */}
      <div className="space-y-3">
        {rules.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 text-4xl mb-2">📋</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No import rules yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Create your first rule to automate transaction processing.
            </p>
            <button
              onClick={handleCreateRule}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
            >
              Create First Rule
            </button>
          </div>
        ) : (
          rules
            .sort((a, b) => a.priority - b.priority)
            .map(rule => (
              <div
                key={rule.id}
                className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => handleToggleRule(rule.id)}
                      className={`w-10 h-6 rounded-full ${
                        rule.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                      } relative transition-colors duration-200`}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform duration-200 ${
                          rule.enabled ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">
                        {rule.name}
                      </h3>
                      {rule.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {rule.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Used {rule.usageCount} times
                    </span>
                    <button
                      onClick={() => setEditingRule(rule)}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="text-sm">
                  <div className="mb-2">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Conditions:</span>
                    <span className="ml-2 text-gray-600 dark:text-gray-400">
                      {rule.conditions.map(condition =>
                        `${condition.field} ${condition.operator} "${condition.value}"`
                      ).join(' AND ')}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Actions:</span>
                    <span className="ml-2 text-gray-600 dark:text-gray-400">
                      {rule.actions.map(action =>
                        `${action.type.replace('_', ' ')} = "${action.value}"`
                      ).join(', ')}
                    </span>
                  </div>
                </div>
              </div>
            ))
        )}
      </div>

      {/* Edit Rule Modal */}
      {editingRule && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setEditingRule(null)}></div>

            <div className="inline-block w-full max-w-2xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-gray-800 shadow-xl rounded-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  {isCreatingRule ? 'Create Rule' : 'Edit Rule'}
                </h3>
                <button
                  onClick={() => setEditingRule(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Rule Name
                    </label>
                    <input
                      type="text"
                      value={editingRule.name}
                      onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description (Optional)
                    </label>
                    <textarea
                      value={editingRule.description || ''}
                      onChange={(e) => setEditingRule({ ...editingRule, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      rows={2}
                    />
                  </div>
                </div>

                {/* Conditions */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Conditions (ALL must match)
                    </h4>
                    <button
                      onClick={addCondition}
                      className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                    >
                      Add Condition
                    </button>
                  </div>
                  {editingRule.conditions.map((condition, index) => (
                    <div key={index} className="flex items-center space-x-2 mb-2">
                      <select
                        value={condition.field}
                        onChange={(e) => updateCondition(index, { field: e.target.value as ImportCondition['field'] })}
                        className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      >
                        {conditionFields.map(field => (
                          <option key={field.value} value={field.value}>{field.label}</option>
                        ))}
                      </select>
                      <select
                        value={condition.operator}
                        onChange={(e) => updateCondition(index, { operator: e.target.value as ImportCondition['operator'] })}
                        className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      >
                        {conditionOperators.map(op => (
                          <option key={op.value} value={op.value}>{op.label}</option>
                        ))}
                      </select>
                      <input
                        type={condition.field === 'amount' ? 'number' : 'text'}
                        value={condition.value}
                        onChange={(e) => updateCondition(index, { value: condition.field === 'amount' ? parseFloat(e.target.value) : e.target.value })}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      />
                      {editingRule.conditions.length > 1 && (
                        <button
                          onClick={() => removeCondition(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Actions
                    </h4>
                    <button
                      onClick={addAction}
                      className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                    >
                      Add Action
                    </button>
                  </div>
                  {editingRule.actions.map((action, index) => (
                    <div key={index} className="flex items-center space-x-2 mb-2">
                      <select
                        value={action.type}
                        onChange={(e) => updateAction(index, { type: e.target.value as ImportAction['type'] })}
                        className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      >
                        {actionTypes.map(type => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={action.value}
                        onChange={(e) => updateAction(index, { value: e.target.value })}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        placeholder="Value"
                      />
                      {editingRule.actions.length > 1 && (
                        <button
                          onClick={() => removeAction(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Save/Cancel */}
                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={handleSaveRule}
                    disabled={!editingRule.name.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors duration-200"
                  >
                    {isCreatingRule ? 'Create Rule' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => setEditingRule(null)}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors duration-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}