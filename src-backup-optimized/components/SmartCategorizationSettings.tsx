/**
 * SmartCategorizationSettings Component - Configure AI-powered transaction categorization
 *
 * Features:
 * - Auto-categorization rules configuration
 * - Machine learning model settings
 * - Custom categorization patterns
 * - Category confidence thresholds
 * - Manual override preferences
 */

import React, { useState, useEffect } from 'react';
import { lazyLogger } from '../services/serviceFactory';

const logger = lazyLogger.getLogger('SmartCategorizationSettings');

export interface CategorizationRule {
  id: string;
  name: string;
  description: string;
  pattern: string;
  category_id: string;
  confidence_threshold: number;
  enabled: boolean;
  priority: number;
  conditions: CategorizationCondition[];
  created_at: string;
  updated_at: string;
}

export interface CategorizationCondition {
  id: string;
  field: 'description' | 'amount' | 'merchant' | 'account' | 'date';
  operator: 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'regex';
  value: string | number;
  case_sensitive: boolean;
}

export interface SmartCategorizationConfig {
  enabled: boolean;
  confidence_threshold: number;
  auto_apply_high_confidence: boolean;
  require_manual_review: boolean;
  learn_from_manual_changes: boolean;
  use_merchant_database: boolean;
  use_historical_patterns: boolean;
  fallback_category_id?: string;
}

export interface CategorySuggestion {
  category_id: string;
  category_name: string;
  confidence: number;
  reasoning: string;
  rules_matched: string[];
}

interface SmartCategorizationSettingsProps {
  onSettingsChange?: (config: SmartCategorizationConfig) => void;
  onRuleChange?: (rules: CategorizationRule[]) => void;
  onClose?: () => void;
  className?: string;
}

export function SmartCategorizationSettings({
  onSettingsChange,
  onRuleChange,
  onClose,
  className = ''
}: SmartCategorizationSettingsProps): React.JSX.Element {
  const [config, setConfig] = useState<SmartCategorizationConfig>({
    enabled: true,
    confidence_threshold: 0.8,
    auto_apply_high_confidence: true,
    require_manual_review: false,
    learn_from_manual_changes: true,
    use_merchant_database: true,
    use_historical_patterns: true
  });

  const [rules, setRules] = useState<CategorizationRule[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedRule, setSelectedRule] = useState<CategorizationRule | null>(null);
  const [isEditingRule, setIsEditingRule] = useState(false);
  const [testDescription, setTestDescription] = useState('');
  const [testResults, setTestResults] = useState<CategorySuggestion[]>([]);
  const [activeTab, setActiveTab] = useState<'settings' | 'rules' | 'test'>('settings');

  useEffect(() => {
    loadCategories();
    loadRules();
  }, []);

  const loadCategories = async (): Promise<void> => {
    logger.info('Loading categories for smart categorization');

    try {
      // Mock categories
      const mockCategories = [
        { id: 'cat-1', name: 'Food & Dining' },
        { id: 'cat-2', name: 'Transportation' },
        { id: 'cat-3', name: 'Shopping' },
        { id: 'cat-4', name: 'Entertainment' },
        { id: 'cat-5', name: 'Bills & Utilities' },
        { id: 'cat-6', name: 'Healthcare' },
        { id: 'cat-7', name: 'Income' },
        { id: 'cat-8', name: 'Groceries' },
        { id: 'cat-9', name: 'Gas & Fuel' },
        { id: 'cat-10', name: 'Other' }
      ];

      setCategories(mockCategories);
    } catch (error) {
      logger.error('Error loading categories:', error);
    }
  };

  const loadRules = async (): Promise<void> => {
    logger.info('Loading categorization rules');

    try {
      // Mock rules
      const mockRules: CategorizationRule[] = [
        {
          id: 'rule-1',
          name: 'Fast Food Restaurants',
          description: 'Automatically categorize fast food purchases',
          pattern: 'McDonald|Burger King|KFC|Subway|Pizza',
          category_id: 'cat-1',
          confidence_threshold: 0.9,
          enabled: true,
          priority: 1,
          conditions: [
            {
              id: 'cond-1',
              field: 'description',
              operator: 'contains',
              value: 'McDonald',
              case_sensitive: false
            }
          ],
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z'
        },
        {
          id: 'rule-2',
          name: 'Gas Stations',
          description: 'Categorize fuel purchases',
          pattern: 'Shell|BP|Exxon|Chevron|Texaco|Gas Station',
          category_id: 'cat-9',
          confidence_threshold: 0.85,
          enabled: true,
          priority: 2,
          conditions: [
            {
              id: 'cond-2',
              field: 'description',
              operator: 'contains',
              value: 'Shell',
              case_sensitive: false
            }
          ],
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z'
        }
      ];

      setRules(mockRules);
    } catch (error) {
      logger.error('Error loading rules:', error);
    }
  };

  const handleConfigChange = (updates: Partial<SmartCategorizationConfig>): void => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onSettingsChange?.(newConfig);
  };

  const handleRuleCreate = (): void => {
    const newRule: CategorizationRule = {
      id: `rule-${Date.now()}`,
      name: '',
      description: '',
      pattern: '',
      category_id: categories[0]?.id || '',
      confidence_threshold: 0.8,
      enabled: true,
      priority: rules.length + 1,
      conditions: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setSelectedRule(newRule);
    setIsEditingRule(true);
  };

  const handleRuleEdit = (rule: CategorizationRule): void => {
    setSelectedRule({ ...rule });
    setIsEditingRule(true);
  };

  const handleRuleSave = (): void => {
    if (!selectedRule) return;

    const updatedRules = selectedRule.id.startsWith('rule-') && rules.find(r => r.id === selectedRule.id)
      ? rules.map(r => r.id === selectedRule.id ? selectedRule : r)
      : [...rules, selectedRule];

    setRules(updatedRules);
    onRuleChange?.(updatedRules);
    setSelectedRule(null);
    setIsEditingRule(false);

    logger.info('Rule saved', { ruleId: selectedRule.id });
  };

  const handleRuleDelete = (ruleId: string): void => {
    const updatedRules = rules.filter(r => r.id !== ruleId);
    setRules(updatedRules);
    onRuleChange?.(updatedRules);

    if (selectedRule?.id === ruleId) {
      setSelectedRule(null);
      setIsEditingRule(false);
    }

    logger.info('Rule deleted', { ruleId });
  };

  const handleRuleToggle = (ruleId: string): void => {
    const updatedRules = rules.map(r =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    );

    setRules(updatedRules);
    onRuleChange?.(updatedRules);
  };

  const handleTestCategorization = (): void => {
    if (!testDescription) return;

    logger.info('Testing categorization', { description: testDescription });

    // Mock test results
    const mockResults: CategorySuggestion[] = [
      {
        category_id: 'cat-1',
        category_name: 'Food & Dining',
        confidence: 0.92,
        reasoning: 'Contains "McDonald" - matches fast food pattern',
        rules_matched: ['Fast Food Restaurants']
      },
      {
        category_id: 'cat-8',
        category_name: 'Groceries',
        confidence: 0.15,
        reasoning: 'Low confidence - no strong patterns matched',
        rules_matched: []
      }
    ].filter(result =>
      testDescription.toLowerCase().includes('mcdonald') ||
      testDescription.toLowerCase().includes('food') ||
      result.confidence < 0.5
    );

    setTestResults(mockResults);
  };

  const getCategoryName = (categoryId: string): string => {
    return categories.find(c => c.id === categoryId)?.name || 'Unknown';
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className={`bg-white dark:bg-gray-900 ${className}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Smart Categorization Settings
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Configure AI-powered transaction categorization
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-700"
            >
              Close
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            {(['settings', 'rules', 'test'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-1 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* General Settings */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                General Settings
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Enable Smart Categorization
                    </label>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Automatically suggest categories for new transactions
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => handleConfigChange({ enabled: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Confidence Threshold ({Math.round(config.confidence_threshold * 100)}%)
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={config.confidence_threshold}
                    onChange={(e) => handleConfigChange({ confidence_threshold: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Minimum confidence required for auto-categorization
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Auto-apply High Confidence
                    </label>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Automatically apply categories with high confidence
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.auto_apply_high_confidence}
                    onChange={(e) => handleConfigChange({ auto_apply_high_confidence: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Learn from Manual Changes
                    </label>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Improve suggestions based on your manual categorizations
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.learn_from_manual_changes}
                    onChange={(e) => handleConfigChange({ learn_from_manual_changes: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Use Merchant Database
                    </label>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Use known merchant categorizations
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.use_merchant_database}
                    onChange={(e) => handleConfigChange({ use_merchant_database: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Fallback Category
                  </label>
                  <select
                    value={config.fallback_category_id || ''}
                    onChange={(e) => handleConfigChange({ fallback_category_id: e.target.value || undefined })}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">No fallback category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Default category when no rules match
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rules Tab */}
        {activeTab === 'rules' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Categorization Rules ({rules.length})
              </h3>
              <button
                onClick={handleRuleCreate}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
              >
                Add Rule
              </button>
            </div>

            {rules.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                  No Rules Configured
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Create your first categorization rule to get started.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={() => handleRuleToggle(rule.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {rule.name}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {rule.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4 mt-2">
                        <span className="text-xs text-gray-500">
                          Category: {getCategoryName(rule.category_id)}
                        </span>
                        <span className="text-xs text-gray-500">
                          Confidence: {Math.round(rule.confidence_threshold * 100)}%
                        </span>
                        <span className="text-xs text-gray-500">
                          Priority: {rule.priority}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleRuleEdit(rule)}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleRuleDelete(rule.id)}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Rule Editor Modal */}
            {isEditingRule && selectedRule && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    {selectedRule.id.startsWith('rule-') ? 'Edit Rule' : 'Create Rule'}
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Rule Name
                      </label>
                      <input
                        type="text"
                        value={selectedRule.name}
                        onChange={(e) => setSelectedRule({ ...selectedRule, name: e.target.value })}
                        className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white"
                        placeholder="Enter rule name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Description
                      </label>
                      <textarea
                        value={selectedRule.description}
                        onChange={(e) => setSelectedRule({ ...selectedRule, description: e.target.value })}
                        className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white"
                        rows={2}
                        placeholder="Describe what this rule does"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Pattern
                      </label>
                      <input
                        type="text"
                        value={selectedRule.pattern}
                        onChange={(e) => setSelectedRule({ ...selectedRule, pattern: e.target.value })}
                        className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white"
                        placeholder="Enter search pattern (e.g., McDonald|Burger King)"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Category
                        </label>
                        <select
                          value={selectedRule.category_id}
                          onChange={(e) => setSelectedRule({ ...selectedRule, category_id: e.target.value })}
                          className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white"
                        >
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Confidence Threshold ({Math.round(selectedRule.confidence_threshold * 100)}%)
                        </label>
                        <input
                          type="range"
                          min="0.1"
                          max="1.0"
                          step="0.05"
                          value={selectedRule.confidence_threshold}
                          onChange={(e) => setSelectedRule({
                            ...selectedRule,
                            confidence_threshold: parseFloat(e.target.value)
                          })}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end space-x-3 mt-6">
                    <button
                      onClick={() => {
                        setSelectedRule(null);
                        setIsEditingRule(false);
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRuleSave}
                      disabled={!selectedRule.name || !selectedRule.pattern}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
                    >
                      Save Rule
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Test Tab */}
        {activeTab === 'test' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Test Categorization
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Transaction Description
                  </label>
                  <div className="flex space-x-3">
                    <input
                      type="text"
                      value={testDescription}
                      onChange={(e) => setTestDescription(e.target.value)}
                      className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white"
                      placeholder="Enter a transaction description to test..."
                    />
                    <button
                      onClick={handleTestCategorization}
                      disabled={!testDescription}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
                    >
                      Test
                    </button>
                  </div>
                </div>

                {testResults.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                      Category Suggestions
                    </h4>
                    <div className="space-y-2">
                      {testResults.map((result, index) => (
                        <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-medium text-gray-900 dark:text-white">
                              {result.category_name}
                            </h5>
                            <span className={`text-sm font-medium ${getConfidenceColor(result.confidence)}`}>
                              {Math.round(result.confidence * 100)}%
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {result.reasoning}
                          </p>
                          {result.rules_matched.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {result.rules_matched.map((ruleName) => (
                                <span
                                  key={ruleName}
                                  className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 text-xs rounded"
                                >
                                  {ruleName}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SmartCategorizationSettings;