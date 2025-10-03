import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { importRulesService } from '../services/importRulesService';
import { 
  PlusIcon, 
  EditIcon, 
  DeleteIcon, 
  CheckIcon, 
  XIcon, 
  PlayIcon,
  MagicWandIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from './icons';
import type { ImportRule, ImportRuleCondition, ImportRuleAction } from '../types/importRules';
import type { Category, Account } from '../types';

export default function ImportRulesManager() {
  const { categories, accounts, transactions } = useApp();
  const [rules, setRules] = useState<ImportRule[]>([]);
  const [editingRule, setEditingRule] = useState<ImportRule | null>(null);
  const [showAddRule, setShowAddRule] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [testResults, setTestResults] = useState<Map<string, boolean>>(new Map());
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Partial<ImportRule>[]>([]);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = () => {
    setRules(importRulesService.getRules());
  };

  const handleSaveRule = (rule: Partial<ImportRule>) => {
    if (editingRule) {
      importRulesService.updateRule(editingRule.id, rule);
    } else {
      importRulesService.addRule(rule as Omit<ImportRule, 'id' | 'createdAt' | 'updatedAt'>);
    }
    loadRules();
    setEditingRule(null);
    setShowAddRule(false);
  };

  const handleDeleteRule = (id: string) => {
    if (confirm('Are you sure you want to delete this rule?')) {
      importRulesService.deleteRule(id);
      loadRules();
    }
  };

  const handleToggleRule = (id: string, enabled: boolean) => {
    importRulesService.updateRule(id, { enabled });
    loadRules();
  };

  const handleChangePriority = (id: string, direction: 'up' | 'down') => {
    const index = rules.findIndex(r => r.id === id);
    if (index === -1) return;

    const newPriority = direction === 'up' 
      ? Math.max(1, rules[index].priority - 1)
      : rules[index].priority + 1;

    // Swap priorities with adjacent rule
    const swapIndex = rules.findIndex(r => r.priority === newPriority);
    if (swapIndex !== -1) {
      importRulesService.updateRule(rules[swapIndex].id, { priority: rules[index].priority });
    }
    
    importRulesService.updateRule(id, { priority: newPriority });
    loadRules();
  };

  const testRule = (rule: ImportRule) => {
    // Test against recent transactions
    const recentTransactions = transactions.slice(0, 50);
    let matches = 0;
    
    recentTransactions.forEach(t => {
      if (importRulesService.testRule(rule, {
        description: t.description,
        amount: t.amount,
        accountId: t.accountId,
        date: t.date
      })) {
        matches++;
      }
    });

    setTestResults(prev => new Map(prev).set(rule.id, matches > 0));
  };

  const generateSuggestions = () => {
    const suggested = importRulesService.suggestRules(transactions);
    setSuggestions(suggested);
    setShowSuggestions(true);
  };

  const applySuggestion = (suggestion: Partial<ImportRule>) => {
    importRulesService.addRule(suggestion as Omit<ImportRule, 'id' | 'createdAt' | 'updatedAt'>);
    loadRules();
    setShowSuggestions(false);
  };

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-theme-heading dark:text-white">Import Rules</h2>
        <div className="flex gap-2">
          <button
            onClick={generateSuggestions}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <MagicWandIcon size={16} />
            Suggest Rules
          </button>
          <button
            onClick={() => setShowAddRule(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors"
          >
            <PlusIcon size={16} />
            Add Rule
          </button>
        </div>
      </div>

      <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          Import rules automatically transform transactions during import. Rules are applied in priority order (lower numbers first).
        </p>
      </div>

      {/* Rules List */}
      {rules.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600 dark:text-gray-400 mb-4">No import rules configured</p>
          <button
            onClick={() => setShowAddRule(true)}
            className="text-primary hover:underline"
          >
            Create your first rule
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`p-4 rounded-lg border ${
                rule.enabled
                  ? 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                  : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-medium text-gray-900 dark:text-white">{rule.name}</h3>
                    <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded">
                      Priority: {rule.priority}
                    </span>
                    {testResults.get(rule.id) !== undefined && (
                      <span className={`text-xs px-2 py-1 rounded ${
                        testResults.get(rule.id) 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {testResults.get(rule.id) ? 'Matches found' : 'No matches'}
                      </span>
                    )}
                  </div>
                  
                  {rule.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{rule.description}</p>
                  )}

                  <div className="text-sm">
                    <div className="mb-1">
                      <span className="font-medium text-gray-700 dark:text-gray-300">Conditions:</span>
                      <ul className="ml-4 mt-1">
                        {rule.conditions.map((condition, i) => (
                          <li key={i} className="text-gray-600 dark:text-gray-400">
                            • {condition.field} {condition.operator} "{condition.value}"
                            {condition.value2 && ` and "${condition.value2}"`}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Actions:</span>
                      <ul className="ml-4 mt-1">
                        {rule.actions.map((action, i) => (
                          <li key={i} className="text-gray-600 dark:text-gray-400">
                            • {action.type}
                            {action.value && `: "${action.value}"`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleChangePriority(rule.id, 'up')}
                    className="p-1 text-gray-600 dark:text-gray-400 hover:text-primary"
                    disabled={rule.priority === 1}
                  >
                    <ArrowUpIcon size={16} />
                  </button>
                  <button
                    onClick={() => handleChangePriority(rule.id, 'down')}
                    className="p-1 text-gray-600 dark:text-gray-400 hover:text-primary"
                    disabled={rule.priority === rules.length}
                  >
                    <ArrowDownIcon size={16} />
                  </button>
                  <button
                    onClick={() => testRule(rule)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary"
                    title="Test rule"
                  >
                    <PlayIcon size={16} />
                  </button>
                  <button
                    onClick={() => setEditingRule(rule)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary"
                  >
                    <EditIcon size={16} />
                  </button>
                  <button
                    onClick={() => handleToggleRule(rule.id, !rule.enabled)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary"
                  >
                    {rule.enabled ? <CheckIcon size={16} /> : <XIcon size={16} />}
                  </button>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600"
                  >
                    <DeleteIcon size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Rule Modal */}
      {(showAddRule || editingRule) && (
        <RuleFormModal
          rule={editingRule}
          categories={categories}
          accounts={accounts}
          onSave={handleSaveRule}
          onClose={() => {
            setShowAddRule(false);
            setEditingRule(null);
          }}
        />
      )}

      {/* Suggestions Modal */}
      {showSuggestions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Suggested Rules
                </h3>
                <button
                  onClick={() => setShowSuggestions(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XIcon size={20} />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {suggestions.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400 text-center">
                  No suggestions available. Import more transactions to generate suggestions.
                </p>
              ) : (
                <div className="space-y-3">
                  {suggestions.map((suggestion, i) => (
                    <div key={i} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {suggestion.name}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {suggestion.description}
                          </p>
                        </div>
                        <button
                          onClick={() => applySuggestion(suggestion)}
                          className="px-3 py-1 bg-primary text-white rounded hover:bg-secondary text-sm"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Rule Form Modal Component
interface RuleFormModalProps {
  rule: ImportRule | null;
  categories: Category[];
  accounts: Account[];
  onSave: (rule: Partial<ImportRule>) => void;
  onClose: () => void;
}

function RuleFormModal({ rule, categories, accounts, onSave, onClose }: RuleFormModalProps) {
  const [formData, setFormData] = useState<Partial<ImportRule>>({
    name: rule?.name || '',
    description: rule?.description || '',
    enabled: rule?.enabled ?? true,
    priority: rule?.priority || 1,
    conditions: rule?.conditions || [{
      field: 'description',
      operator: 'contains',
      value: '',
      caseSensitive: false
    }],
    actions: rule?.actions || [{
      type: 'setCategory',
      value: ''
    }]
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const addCondition = () => {
    setFormData({
      ...formData,
      conditions: [...(formData.conditions || []), {
        field: 'description',
        operator: 'contains',
        value: '',
        caseSensitive: false
      }]
    });
  };

  const removeCondition = (index: number) => {
    setFormData({
      ...formData,
      conditions: formData.conditions?.filter((_, i) => i !== index) || []
    });
  };

  const updateCondition = (index: number, updates: Partial<ImportRuleCondition>) => {
    const conditions = [...(formData.conditions || [])];
    conditions[index] = { ...conditions[index], ...updates };
    setFormData({ ...formData, conditions });
  };

  const addAction = () => {
    setFormData({
      ...formData,
      actions: [...(formData.actions || []), {
        type: 'setCategory',
        value: ''
      }]
    });
  };

  const removeAction = (index: number) => {
    setFormData({
      ...formData,
      actions: formData.actions?.filter((_, i) => i !== index) || []
    });
  };

  const updateAction = (index: number, updates: Partial<ImportRuleAction>) => {
    const actions = [...(formData.actions || [])];
    actions[index] = { ...actions[index], ...updates };
    setFormData({ ...formData, actions });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {rule ? 'Edit Rule' : 'New Import Rule'}
            </h3>
          </div>
          
          <div className="p-6 overflow-y-auto max-h-[70vh]">
            {/* Basic Info */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Rule Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Priority
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.enabled}
                      onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Enabled</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Conditions */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-medium text-gray-900 dark:text-white">
                  Conditions (all must match)
                </h4>
                <button
                  type="button"
                  onClick={addCondition}
                  className="text-sm text-primary hover:underline"
                >
                  Add Condition
                </button>
              </div>

              <div className="space-y-3">
                {formData.conditions?.map((condition, index) => (
                  <div key={index} className="flex gap-2 items-start bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                    <select
                      value={condition.field}
                      onChange={(e) => updateCondition(index, { field: e.target.value as ImportRuleCondition['field'] })}
                      className="px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm"
                    >
                      <option value="description">Description</option>
                      <option value="amount">Amount</option>
                      <option value="accountId">Account</option>
                    </select>

                    <select
                      value={condition.operator}
                      onChange={(e) => updateCondition(index, { operator: e.target.value as ImportRuleCondition['operator'] })}
                      className="px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm"
                    >
                      {condition.field === 'amount' ? (
                        <>
                          <option value="equals">Equals</option>
                          <option value="greaterThan">Greater than</option>
                          <option value="lessThan">Less than</option>
                          <option value="between">Between</option>
                        </>
                      ) : (
                        <>
                          <option value="contains">Contains</option>
                          <option value="equals">Equals</option>
                          <option value="startsWith">Starts with</option>
                          <option value="endsWith">Ends with</option>
                          <option value="regex">Regex</option>
                        </>
                      )}
                    </select>

                    <input
                      type={condition.field === 'amount' ? 'number' : 'text'}
                      value={condition.value}
                      onChange={(e) => updateCondition(index, { value: condition.field === 'amount' ? parseFloat(e.target.value) : e.target.value })}
                      placeholder="Value"
                      className="flex-1 px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm"
                    />

                    {condition.operator === 'between' && (
                      <input
                        type="number"
                        value={condition.value2}
                        onChange={(e) => updateCondition(index, { value2: parseFloat(e.target.value) })}
                        placeholder="Max value"
                        className="px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm w-24"
                      />
                    )}

                    {condition.field !== 'amount' && (
                      <label className="flex items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          checked={condition.caseSensitive}
                          onChange={(e) => updateCondition(index, { caseSensitive: e.target.checked })}
                        />
                        Case
                      </label>
                    )}

                    <button
                      type="button"
                      onClick={() => removeCondition(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <XIcon size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-medium text-gray-900 dark:text-white">
                  Actions
                </h4>
                <button
                  type="button"
                  onClick={addAction}
                  className="text-sm text-primary hover:underline"
                >
                  Add Action
                </button>
              </div>

              <div className="space-y-3">
                {formData.actions?.map((action, index) => (
                  <div key={index} className="flex gap-2 items-start bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                    <select
                      value={action.type}
                      onChange={(e) => updateAction(index, { type: e.target.value as ImportRuleAction['type'] })}
                      className="px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm"
                    >
                      <option value="setCategory">Set Category</option>
                      <option value="addTag">Add Tag</option>
                      <option value="modifyDescription">Modify Description</option>
                      <option value="setAccount">Set Account</option>
                      <option value="skip">Skip Transaction</option>
                    </select>

                    {action.type === 'setCategory' && (
                      <select
                        value={action.value}
                        onChange={(e) => updateAction(index, { value: e.target.value })}
                        className="flex-1 px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm"
                      >
                        <option value="">Select category</option>
                        {categories.filter(c => c.type === 'expense' || c.type === 'both').map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    )}

                    {action.type === 'addTag' && (
                      <input
                        type="text"
                        value={action.value}
                        onChange={(e) => updateAction(index, { value: e.target.value })}
                        placeholder="Tag name"
                        className="flex-1 px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm"
                      />
                    )}

                    {action.type === 'modifyDescription' && (
                      <>
                        <select
                          value={action.modification}
                          onChange={(e) => updateAction(index, { modification: e.target.value as ImportRuleAction['modification'] })}
                          className="px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm"
                        >
                          <option value="replace">Replace</option>
                          <option value="prepend">Prepend</option>
                          <option value="append">Append</option>
                          <option value="regex">Regex Replace</option>
                        </select>
                        {action.modification === 'regex' ? (
                          <>
                            <input
                              type="text"
                              value={action.pattern}
                              onChange={(e) => updateAction(index, { pattern: e.target.value })}
                              placeholder="Pattern"
                              className="flex-1 px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm"
                            />
                            <input
                              type="text"
                              value={action.replacement}
                              onChange={(e) => updateAction(index, { replacement: e.target.value })}
                              placeholder="Replacement"
                              className="flex-1 px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm"
                            />
                          </>
                        ) : (
                          <input
                            type="text"
                            value={action.value}
                            onChange={(e) => updateAction(index, { value: e.target.value })}
                            placeholder="Text"
                            className="flex-1 px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm"
                          />
                        )}
                      </>
                    )}

                    {action.type === 'setAccount' && (
                      <select
                        value={action.value}
                        onChange={(e) => updateAction(index, { value: e.target.value })}
                        className="flex-1 px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm"
                      >
                        <option value="">Select account</option>
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.id}>{acc.name}</option>
                        ))}
                      </select>
                    )}

                    <button
                      type="button"
                      onClick={() => removeAction(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <XIcon size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary"
            >
              {rule ? 'Save Changes' : 'Create Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}